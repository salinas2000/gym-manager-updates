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
| Storage (signedUpload / signedDownload / publicUrl / remove / list) | `owner-storage` | `owner-storage.client.js` | ✅ Live (cloud.service.js call sites migrated) |
| Generic DB (cloud_remote_loads / cloud_customers select/upsert/delete) | `owner-data` | `owner-data.client.js` | ✅ Live (cloud.service.js call sites migrated) |
| Push notifications | `send-push` | mobile + SQL triggers | ✅ Live |
| Realtime channels | anon-key (legacy JWT) + RLS + `ws` transport | n/a | ✅ Verified SUBSCRIBED end-to-end |

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

## Call sites migration — DONE ✅

Every direct `this.supabase.from(...)` / `this.supabase.storage(...)` /
`this.supabase.auth(...)` call in `cloud.service.js` has been replaced
with the corresponding Edge Function client. Only the realtime channel
subscriptions (`setupRealtime`) still use `this.supabase` — and that's
by design (realtime is anon-key + RLS).

The `inviteToMobile_LEGACY` dead-code path has been deleted.

### Realtime channels (`cloud.service.js::setupRealtime`)

Two channels:
- `remote_loads_${gymId}` listening for INSERTs on `cloud_remote_loads`
- `bookings_${gymId}` listening for INSERTs on `gym_class_bookings`

These work with the **anon key** (legacy JWT form — `sb_publishable_*`
times out realtime websockets in supabase-js v2.91.1). Final RLS state
after migration `realtime_reenable_rls_secure`:

```sql
ALTER TABLE cloud_remote_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_class_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon reads remote_loads" ON cloud_remote_loads
    FOR SELECT TO anon USING (true);
CREATE POLICY "anon reads class bookings" ON gym_class_bookings
    FOR SELECT TO anon USING (true);
-- anon must never write to these (the key ships in the installer):
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON cloud_remote_loads FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON gym_class_bookings FROM anon;
```

> ⚠️ **Realtime needs a WebSocket transport.** Electron's main process
> has no global `WebSocket`, so realtime-js silently TIMES_OUT. The fix
> lives in `cloud.service.js`: `require('ws')` is passed as
> `realtime.transport` to `createClient`. `ws` is a direct dependency.

Open SELECT to `anon` is acceptable for both tables because:

- `cloud_remote_loads` contains only opaque payload paths + status. No PII.
- `gym_class_bookings` only has `customer_local_id` (an integer) + date.
  No names, no emails. The mobile UX still goes through authenticated
  reads via `mobile_client_links`.

**No INSERT/UPDATE/DELETE policy is granted to `anon`** (and the table
grants were REVOKEd too) — mutations all
go through Edge Functions + owner_token.

## Final manual step (one-time) — switch the key in `.env.local`

The desktop now reads `SUPABASE_KEY` from `.env.local`. After deploy:

1. Replace `SUPABASE_KEY=<service_role JWT>` with
   `SUPABASE_KEY=sb_publishable_OZFScC5Mv_SmL4ffYxMV8w_hdxUYWDM` (the
   publishable key).
2. Rebuild the installer. The publishable key is public-safe — embedding
   it is fine.
3. On boot, `cloud.service.js::init` logs a loud warning if it still
   detects a JWT-shaped key (`startsWith('eyJ')` + long length). Watch
   the log to confirm the swap took effect.
4. Optionally remove `.env.local` from `package.json::build.extraResources`
   if you want zero secrets in the installer at all (then GH_TOKEN and
   SMTP creds move to electron-store via a first-run wizard).

## Attack surface today

With **all 7 layers migrated**, the desktop installer no longer needs
the `SERVICE_ROLE_KEY` to function. Once `.env.local` ships with the
publishable key only:

- ❌ **CANNOT** create / delete auth users
- ❌ **CANNOT** invite or revoke any customer
- ❌ **CANNOT** send password-reset emails
- ❌ **CANNOT** modify any cloud_* row through sync
- ❌ **CANNOT** modify licenses
- ❌ **CANNOT** read/write the `training_files` bucket of any gym
- ❌ **CANNOT** read/write `cloud_remote_loads` of any gym
- ⚠️ **CAN** subscribe to realtime channels (SELECT-only, no PII, by design)

All mutations require the per-gym `owner_token`, which is encrypted in
electron-store with a hardware-bound key — copying the file off the
PC fails to decrypt.

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
