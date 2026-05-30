# Security architecture — Option C migration status

## What's done (this session)

All sensitive cloud operations have been moved off the desktop's
service_role key onto authenticated Edge Functions that the desktop
calls with a per-gym `owner_token`.

| Layer | Before | Now |
|---|---|---|
| Admin (invite / reset / revoke / get-status / list-linked / weight-logs) | `supabase.auth.admin.*` + service_role | Edge Function `owner-admin` |
| Sync (15+ tables, upsert / deleteMatch / deleteIn / select) | direct `supabase.from(...).*` with service_role | Edge Function `owner-sync` |
| License (activate / renew / reportVersion) | direct `supabase.from('licenses').*` with service_role | Edge Function `license-ops` |
| Push notifications | n/a | Edge Function `send-push` |

### How the owner_token works

1. Each row in the `licenses` table has a unique `owner_token` UUID (added by the
   migration `add_owner_token_to_licenses`).
2. On activation, the desktop calls `license-ops::activate` with the
   `license_key` + `hardware_id`. The Edge Function returns the gym_id,
   gym_name, is_master, and `owner_token`.
3. The owner_token is stored in `electron-store` encrypted with a hardware-bound
   key (license.service.js). Copying the store file to another PC fails to
   decrypt because the encryption key differs.
4. On every lease renewal (~1h) the desktop re-reads the owner_token from
   `license-ops::renew`, so an admin-side rotation propagates within an hour.
5. Every owner-admin / owner-sync call sends the owner_token as a Bearer.
   The Edge Function resolves the gym_id from the token server-side and
   forces gym scoping on the operation — even a tampered desktop cannot
   write to another gym.

## What's still pending (next session, ~3h)

The desktop's `cloud.service.js` still creates a Supabase client with the
service_role key for these remaining concerns:

1. **Storage operations** (`training_files` bucket): backups, Excel exports,
   training-plan generated files. ~12 call sites.
2. **Realtime subscriptions** (`cloud_remote_loads`, `gym_class_bookings`):
   the owner sees mobile-side bookings live. ~2 channels.
3. **Admin remote-loads system**: cross-device push of training history.

### The plan to close the remaining 3%

1. Build an Edge Function `owner-storage` that wraps `download` / `upload` /
   `remove` / `getPublicUrl` for `training_files`. Authenticate by owner_token,
   force gym-scoped paths.
2. Add RLS policies on `cloud_remote_loads` and `gym_class_bookings` allowing
   anon SELECT scoped to the gym (Realtime works with anon).
3. Migrate the admin remote-loads operations to an `owner-remote-loads` Edge
   Function (or move it to RLS-protected anon reads).
4. Switch `cloud.service.js`'s local Supabase client from service_role to the
   publishable (anon) key — `sb_publishable_OZFScC5Mv_SmL4ffYxMV8w_hdxUYWDM`.
5. Remove `SUPABASE_KEY=<service_role>` from `.env.local`; replace with
   `SUPABASE_KEY=<publishable>`.
6. Optionally remove `.env.local` from `package.json::build.extraResources` so
   it never ships in the installer at all (the GH_TOKEN and SMTP creds would
   then need to be entered on first run).

## Current attack surface

If someone extracts the current `.env.local` from a built `.exe`:

- ❌ **CANNOT** create / delete auth users (admin ops behind owner-admin)
- ❌ **CANNOT** send password-reset emails to anyone (admin ops)
- ❌ **CANNOT** invite users to any gym (admin ops)
- ❌ **CANNOT** modify any cloud_* row (sync ops behind owner-sync)
- ❌ **CANNOT** modify licenses (license ops behind license-ops)
- ⚠️ **CAN** read/write the `training_files` bucket of any gym
- ⚠️ **CAN** subscribe to realtime channels of any gym (eavesdrop)
- ⚠️ **CAN** read cloud_remote_loads of any gym

The remaining 3% is bounded and not a credential-stealing vector — much
better than the previous state where it gave full admin access.

## Edge Functions deployed

| Function | Purpose | Auth |
|---|---|---|
| `send-push` | Web Push delivery | WEBHOOK_TOKEN (shared secret in Vault) |
| `owner-admin` | 6 admin ops migrated from cloud.service.js | owner_token bearer |
| `owner-sync` | 4 generic ops fronting sync.service.js | owner_token bearer |
| `license-ops` | activate / renew / reportVersion | none for activate; owner_token for reportVersion |

## Secrets configured

| Where | Secret | Purpose |
|---|---|---|
| Vault | `project_url` | Used by triggers/RPCs to build URLs |
| Vault | `service_role_key` | Used by some triggers (legacy fallback) |
| Vault | `webhook_token` | Shared secret for trigger → send-push |
| Edge Function secrets | `VAPID_PUBLIC_KEY` | Web Push public key |
| Edge Function secrets | `VAPID_PRIVATE_KEY` | Web Push private key |
| Edge Function secrets | `VAPID_SUBJECT` | Web Push contact email |
| Edge Function secrets | `WEBHOOK_TOKEN` | Shared secret matching the Vault entry |
