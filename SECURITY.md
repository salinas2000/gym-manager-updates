# Security architecture — Option C migration

## Current state — what's done

Every cloud operation the desktop performs is now backed by a dedicated
Edge Function authenticated by a per-gym `owner_token`. The desktop's
local Supabase client still uses the legacy service_role for a residual
set of storage / admin reads, but the infrastructure to migrate them is
in place.

| Layer | Edge Function | Desktop client wrapper | Status |
|---|---|---|---|
| Admin (invite / reset / revoke / get-status / list-linked / weight-logs) | `owner-admin` | `cloud.service.js::_callOwnerAdmin` | ✅ Live |
| Sync (15+ tables, upsert / deleteMatch / deleteIn / select) | `owner-sync` | `owner-sync.client.js` | ✅ Live |
| License (activate / renew / reportVersion) | `license-ops` | `license.service.js` | ✅ Live |
| Storage (signedUpload / signedDownload / publicUrl / remove / list) | `owner-storage` | `owner-storage.client.js` | 🟡 Function live, call sites pending migration |
| Generic DB (cloud_remote_loads / cloud_customers select/upsert/delete) | `owner-data` | `owner-data.client.js` | 🟡 Function live, call sites pending migration |
| Push notifications | `send-push` | mobile + SQL triggers | ✅ Live |
| Realtime channels | n/a — needs anon-key client + RLS | n/a yet | 🟡 RLS policies pending |

### How the owner_token works

1. Each row in the `licenses` table has a unique `owner_token` UUID
   (migration `add_owner_token_to_licenses`).
2. On activation, the desktop calls `license-ops::activate` with the
   `license_key` + `hardware_id`. The Edge Function returns the gym_id,
   gym_name, is_master, and `owner_token`.
3. The owner_token is stored in `electron-store` encrypted with a
   hardware-bound key (`license.service.js`). Copying the store to
   another PC fails to decrypt.
4. On every lease renewal (~1h) the desktop re-reads the owner_token
   from `license-ops::renew`, so a cloud-side rotation propagates within
   one hour.
5. Every Edge Function call sends the owner_token as a Bearer header.
   The function resolves the gym_id server-side and forces gym scoping —
   a tampered desktop cannot write to another gym.

## Call sites still using `this.supabase` directly

These all need to be migrated to the corresponding Edge Function client.
The mechanical recipe is the same each time: replace the supabase chain
with a call to the appropriate `owner-*.client.js` method.

### In `src/main/services/cloud/cloud.service.js`

```
Line   Method                          Migrate to
-----  ------------------------------  --------------------------------
~256   uploadDatabaseBackup            ownerStorage.upload(path, buf, contentType)
~286   backupTemplateConfig            ownerStorage.upload(path, buf, contentType)
~313   backupTemplateExcel             ownerStorage.upload(path, buf, contentType)
~335   uploadTrainingFile              ownerStorage.upload(path, buf, contentType)
~348   uploadTrainingFile (publicUrl)  ownerStorage.getPublicUrl(path)
~442   (storage upload, varies)        ownerStorage.upload(...)
~465   cloud_remote_loads select       ownerData.select('cloud_remote_loads', {filters})
~505   storage upload                  ownerStorage.upload(...)
~520   storage remove                  ownerStorage.remove([path])
~528   cloud_remote_loads upsert       ownerData.upsert('cloud_remote_loads', rows)
~533   cloud_remote_loads update       ownerData.upsert with onConflict
~547   cloud_remote_loads delete       ownerData.deleteMatch(...)
~580   storage upload                  ownerStorage.upload(...)
~589   cloud_remote_loads insert       ownerData.upsert
~610   storage download                ownerStorage.download(path)
~630   cloud_remote_loads update       ownerData.upsert with onConflict
~634   storage remove                  ownerStorage.remove([path])
~684   cloud_customers select          ownerData.select('cloud_customers', {filters})
~706   storage download                ownerStorage.download(path)
~712   storage remove                  ownerStorage.remove([path])
~727   storage upload                  ownerStorage.upload(...)
~741   storage download                ownerStorage.download(path)
~747   storage download                ownerStorage.download(path)
~846   mobile_client_links read        (dead code — _LEGACY method, can delete)
~874   mobile_client_links upsert      (dead code — _LEGACY method, can delete)
~898   mobile_client_links insert      (dead code — _LEGACY method, can delete)
~925   mobile_client_links upsert      (dead code — _LEGACY method, can delete)
```

### Realtime channels (`cloud.service.js::setupRealtime`)

Two channels:
- `remote_loads_${gymId}` listening for INSERTs on `cloud_remote_loads`
- `bookings_${gymId}` listening for INSERTs on `gym_class_bookings`

To make these work with the anon key, add the following RLS policies:

```sql
-- cloud_remote_loads: gym owners listen to their own gym only
CREATE POLICY "Owner reads own gym remote_loads"
  ON cloud_remote_loads FOR SELECT TO anon
  USING (gym_id IN (
    SELECT gym_id FROM licenses
    WHERE owner_token = current_setting('request.jwt.claims', true)::jsonb->>'owner_token'
  ));
-- Alternative simpler version (less secure — open SELECT):
-- USING (true)  — then enforce gym filter client-side
```

For `gym_class_bookings`, customers already have RLS via
`mobile_client_links`. The owner needs its own policy:

```sql
CREATE POLICY "Owner reads own gym bookings"
  ON gym_class_bookings FOR SELECT TO anon
  USING (gym_id IN (
    SELECT gym_id FROM licenses
    WHERE owner_token = current_setting('request.jwt.claims', true)::jsonb->>'owner_token'
  ));
```

## Final steps after all call sites migrated

1. In `src/main/services/cloud/cloud.service.js::init`, change the line
   `this.supabase = createClient(supabase.url, supabase.key);` to use a
   second `publishableKey` field added to the credentials.
2. Remove `SUPABASE_KEY=<service_role>` from `.env.local`. The
   publishable key is public-safe — embedding it is fine.
3. Optionally remove `.env.local` from `package.json::build.extraResources`
   if you want zero secrets in the installer at all (then GH_TOKEN and
   SMTP creds move to electron-store via a first-run wizard).

## Attack surface today

With the current state (5 out of 7 layers migrated), if someone extracts
`SERVICE_ROLE_KEY` from `.env.local` they:

- ❌ **CANNOT** create / delete auth users
- ❌ **CANNOT** invite or revoke any customer
- ❌ **CANNOT** send password-reset emails
- ❌ **CANNOT** modify any cloud_* row through sync
- ❌ **CANNOT** modify licenses
- ⚠️ **CAN** read/write the `training_files` bucket of any gym (until storage migration completes)
- ⚠️ **CAN** subscribe to realtime channels of any gym (until RLS is added)
- ⚠️ **CAN** read/write `cloud_remote_loads` of any gym (until data migration completes)

The most dangerous primitives — auth user management and arbitrary
writes — are gone. The remaining surface is bounded: bucket access
(can corrupt backups but not user credentials) and realtime
eavesdropping (can see live events but not modify).

## Edge Functions deployed

| Function | Purpose | Auth |
|---|---|---|
| `send-push` | Web Push delivery | WEBHOOK_TOKEN shared secret |
| `owner-admin` | 6 admin ops | owner_token bearer |
| `owner-sync` | 4 generic sync ops | owner_token bearer |
| `owner-storage` | 5 storage ops via presigned URLs | owner_token bearer |
| `owner-data` | 3 generic cloud_* ops | owner_token bearer |
| `license-ops` | activate / renew / reportVersion | open for activate; owner_token for reportVersion |

## Secrets configured

| Where | Secret | Purpose |
|---|---|---|
| Vault | `project_url` | Used by triggers/RPCs to build URLs |
| Vault | `service_role_key` | Used by legacy triggers (fallback only) |
| Vault | `webhook_token` | Shared secret for trigger → send-push |
| Edge Function secrets | `VAPID_PUBLIC_KEY` | Web Push public key |
| Edge Function secrets | `VAPID_PRIVATE_KEY` | Web Push private key |
| Edge Function secrets | `VAPID_SUBJECT` | Web Push contact email |
| Edge Function secrets | `WEBHOOK_TOKEN` | Shared secret matching Vault entry |
