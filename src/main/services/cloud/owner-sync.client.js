/**
 * owner-sync HTTP client.
 *
 * Replaces the old `this.supabase.from(table).upsert/delete/select(...)` calls
 * in sync.service.js. Authenticates with the per-gym owner_token (read from
 * encrypted electron-store via license.service) instead of the legacy
 * service_role key that used to be bundled inside the installer.
 *
 * The Edge Function `owner-sync` validates the bearer, resolves the gym_id
 * from `licenses.owner_token`, and forces gym scoping on every operation.
 */

const licenseService = require('../local/license.service');
const credentialManager = require('../../config/credentials');

const TIMEOUT_MS = 20_000;

class OwnerSyncClient {
    /**
     * Make a POST to /functions/v1/owner-sync.
     * Returns a normalized { success, data?, error?, code?, count? } object.
     */
    async _call(op, args) {
        if (!credentialManager.isLoaded()) {
            return { success: false, error: 'credentials_not_loaded' };
        }
        const creds = credentialManager.get();
        const url = creds?.supabase?.url;
        if (!url) return { success: false, error: 'no_supabase_url' };

        const token = licenseService.getOwnerToken();
        if (!token) {
            return { success: false, error: 'no_owner_token' };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(`${url}/functions/v1/owner-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ op, ...args }),
                signal: controller.signal,
            });
            clearTimeout(timer);
            let body = null;
            try { body = await res.json(); } catch { /* non-json */ }
            if (!res.ok) {
                return {
                    success: false,
                    error: body?.error || `HTTP ${res.status}`,
                    code: body?.code || null,
                    status: res.status,
                };
            }
            return body || { success: true };
        } catch (err) {
            clearTimeout(timer);
            return {
                success: false,
                error: err.name === 'AbortError'
                    ? `timeout_${TIMEOUT_MS / 1000}s`
                    : `network_${err.message}`,
            };
        }
    }

    /**
     * Upsert a batch of rows into cloud_* table. The Edge Function will overwrite
     * every row's gym_id with the owner's gym_id — a defensive measure against
     * compromised desktops trying to write cross-tenant data.
     *
     * @param {string} table - cloud_* table name
     * @param {Array<object>} rows - rows to upsert
     * @param {string} onConflict - composite key, e.g. 'gym_id,local_id'
     * @param {string} gymId - the gym the rows belong to (master accounts can pass any; others ignored)
     */
    async upsert(table, rows, onConflict, gymId) {
        return await this._call('upsert', { table, rows, onConflict, gym_id: gymId });
    }

    /**
     * Delete all rows in `table` matching the given column→value map (anded
     * with gym_id automatically). Equivalent to .delete().match(...) on
     * supabase-js, but gym-scoped enforcement is server-side.
     */
    async deleteMatch(table, match, gymId) {
        return await this._call('deleteMatch', { table, match, gym_id: gymId });
    }

    /**
     * Delete rows where `column` IN `values` (and gym_id matches). Used by the
     * ghost-reconcile and by the legacy bulk-delete code paths.
     */
    async deleteIn(table, column, values, gymId) {
        return await this._call('deleteIn', { table, column, values, gym_id: gymId });
    }

    /**
     * SELECT all rows for the gym. `columns` is a comma-separated string
     * (just like supabase-js). Returns { success, data }.
     */
    async select(table, columns, gymId) {
        return await this._call('select', { table, columns, gym_id: gymId });
    }
}

module.exports = new OwnerSyncClient();
