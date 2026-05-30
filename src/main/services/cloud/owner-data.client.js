/**
 * owner-data HTTP client.
 *
 * Catch-all for the remaining direct supabase queries in cloud.service.js
 * (cloud_remote_loads admin workflow, cloud_customers lookups). The
 * supabase-fluent API (`.eq().in().order().limit()`) is collapsed into a
 * single `filters` object that the Edge Function expands on the server.
 */

const licenseService = require('../local/license.service');
const credentialManager = require('../../config/credentials');

const TIMEOUT_MS = 15_000;

class OwnerDataClient {
    async _call(op, args) {
        if (!credentialManager.isLoaded()) return { success: false, error: 'credentials_not_loaded' };
        const url = credentialManager.get()?.supabase?.url;
        if (!url) return { success: false, error: 'no_supabase_url' };
        const token = licenseService.getOwnerToken();
        if (!token) return { success: false, error: 'no_owner_token' };

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(`${url}/functions/v1/owner-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ op, ...args }),
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            let body = null;
            try { body = await res.json(); } catch { /* */ }
            if (!res.ok) {
                return { success: false, error: body?.error || `HTTP ${res.status}`, status: res.status };
            }
            return body || { success: true };
        } catch (err) {
            clearTimeout(timer);
            return { success: false, error: err.name === 'AbortError' ? 'timeout' : `network_${err.message}` };
        }
    }

    /**
     * Select with filters.
     *   await client.select('cloud_customers', {
     *     gymId: 'abc',
     *     columns: 'local_id, name',
     *     filters: { active: 1, local_id: { op: 'in', value: [1,2,3] } },
     *     order: 'created_at',
     *     ascending: false,
     *     limit: 50,
     *   });
     */
    async select(table, { gymId, columns, filters, order, ascending, limit } = {}) {
        const res = await this._call('select', {
            table,
            gym_id: gymId,
            columns,
            filters,
            order,
            ascending,
            limit,
        });
        // Edge Function returns { success, data: [...] }. Normalize so callers
        // can read either .rows or .data uniformly.
        if (res?.success && Array.isArray(res.data) && !res.rows) res.rows = res.data;
        return res;
    }

    async upsert(table, rows, { onConflict, gymId, returning } = {}) {
        return await this._call('upsert', { table, rows, onConflict, gym_id: gymId, returning });
    }

    /**
     * Insert rows (no upsert semantics). Pass `returning: true` to get the
     * inserted rows back in the response under `.data`.
     */
    async insert(table, rows, { gymId, returning } = {}) {
        return await this._call('insert', { table, rows, gym_id: gymId, returning });
    }

    /**
     * Update rows matching `filters`. Same filter shape as `select`.
     *   await client.update('gym_class_events',
     *     { cancelled: true },
     *     { filters: { id: eventId } });
     */
    async update(table, values, { gymId, filters } = {}) {
        return await this._call('update', { table, values, filters, gym_id: gymId });
    }

    async deleteMatch(table, match, { gymId } = {}) {
        return await this._call('deleteMatch', { table, match, gym_id: gymId });
    }
}

module.exports = new OwnerDataClient();
