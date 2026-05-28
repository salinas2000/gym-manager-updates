/**
 * Sync Service — Automatic background synchronization of local SQLite data to Supabase cloud.
 *
 * Strategy:
 *   - Desktop (SQLite) is always the source of truth
 *   - Reads rows with synced=0, upserts to cloud_* tables, marks synced=1
 *   - Processes sync_deleted_log to delete records from cloud
 *   - Runs on startup (delayed) and every 5 minutes
 *   - Non-blocking: errors are logged but never crash the app
 *
 * Table sync order respects foreign-key dependencies:
 *   tariffs → categories → subcategories → exercises → customers → memberships → payments
 *   → mesocycles → routines → routine_items
 */

const dbManager = require('../../db/database');
const BaseService = require('../BaseService');

// Batch size for upsert operations (Supabase recommends ≤1000 per call)
const BATCH_SIZE = 500;

// Convert empty strings to null (SQLite stores "" where Postgres expects NULL or a typed value)
const emptyToNull = (v) => (v === '' ? null : v);

class SyncService extends BaseService {
    constructor() {
        super();
        this._running = false;
        this._lastSyncAt = null;
        this._mainWindow = null;
        this._debouncedTimer = null;
    }

    /**
     * Schedule a sync after a short delay (debounced).
     * Call this after any local data mutation (create/update/delete)
     * to push changes to cloud quickly without hammering the API.
     */
    scheduleSync(delaySec = 5) {
        if (this._debouncedTimer) clearTimeout(this._debouncedTimer);
        this._debouncedTimer = setTimeout(() => {
            this._debouncedTimer = null;
            this.runFullSync().catch(err => {
                console.warn('[SYNC] Debounced sync failed:', err.message);
            });
        }, delaySec * 1000);
    }

    setMainWindow(win) {
        this._mainWindow = win;
    }

    /**
     * Get the shared Supabase client from CloudService.
     * Lazy-loaded to avoid circular dependency issues at startup.
     */
    _getSupabase() {
        const cloudService = require('./cloud.service');
        return cloudService.supabase;
    }

    /**
     * Send sync status to renderer via IPC (optional UI indicator).
     */
    _notifyRenderer(status, detail = null) {
        if (this._mainWindow && !this._mainWindow.isDestroyed()) {
            this._mainWindow.webContents.send('cloud:sync-status', { status, detail, timestamp: Date.now() });
        }
    }

    // ─── TABLE MAPPING DEFINITIONS ──────────────────────────────────────────────
    // Each entry defines: localTable, cloudTable, and a mapFn to transform a local row to cloud format.
    // Order matters: parent tables must sync before child tables.

    _getTableMappings() {
        return [
            {
                local: 'tariffs',
                cloud: 'cloud_tariffs',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    name: r.name,
                    amount: r.amount,
                    color_theme: r.color_theme,
                    billing_months: r.billing_months || 1,
                    amount_is_total: r.amount_is_total || 0,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'exercise_categories',
                cloud: 'cloud_exercise_categories',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    name: r.name,
                    icon: r.icon,
                    is_system: r.is_system,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'exercise_subcategories',
                cloud: 'cloud_exercise_subcategories',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    category_id: r.category_id,
                    name: r.name,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'exercises',
                cloud: 'cloud_exercises',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    name: r.name,
                    subcategory_id: emptyToNull(r.subcategory_id),
                    video_url: emptyToNull(r.video_url),
                    notes: emptyToNull(r.notes),
                    default_sets: emptyToNull(r.default_sets),
                    default_reps: emptyToNull(r.default_reps),
                    is_failure: r.is_failure,
                    default_intensity: emptyToNull(r.default_intensity),
                    custom_fields: r.custom_fields ? JSON.parse(r.custom_fields) : null,
                    category: emptyToNull(r.category),
                    equipment: emptyToNull(r.equipment),
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'customers',
                cloud: 'cloud_customers',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    email: emptyToNull(r.email),
                    phone: emptyToNull(r.phone),
                    active: r.active,
                    tariff_id: emptyToNull(r.tariff_id),
                    dni: emptyToNull(r.dni),
                    address: emptyToNull(r.address),
                    height_cm: emptyToNull(r.height_cm),
                    weight_kg: emptyToNull(r.weight_kg),
                    birth_date: emptyToNull(r.birth_date),
                    medical_info: r.medical_info ? JSON.parse(r.medical_info) : null,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'memberships',
                cloud: 'cloud_memberships',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    customer_id: r.customer_id,
                    start_date: r.start_date,
                    end_date: r.end_date,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'payments',
                cloud: 'cloud_payments',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    customer_id: r.customer_id,
                    amount: r.amount,
                    payment_date: r.payment_date,
                    tariff_name: emptyToNull(r.tariff_name),
                    payment_method: emptyToNull(r.payment_method),
                    payment_group_id: emptyToNull(r.payment_group_id),
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'mesocycles',
                cloud: 'cloud_mesocycles',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    customer_id: r.customer_id,
                    name: r.name,
                    start_date: emptyToNull(r.start_date),
                    end_date: emptyToNull(r.end_date),
                    active: r.active,
                    is_template: r.is_template,
                    days_per_week: emptyToNull(r.days_per_week),
                    notes: emptyToNull(r.notes),
                    drive_link: emptyToNull(r.drive_link),
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'routines',
                cloud: 'cloud_routines',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    mesocycle_id: r.mesocycle_id,
                    name: r.name,
                    day_group: emptyToNull(r.day_group),
                    notes: emptyToNull(r.notes),
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'routine_items',
                cloud: 'cloud_routine_items',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    routine_id: r.routine_id,
                    exercise_id: emptyToNull(r.exercise_id),
                    series: emptyToNull(r.series),
                    reps: emptyToNull(r.reps),
                    rpe: emptyToNull(r.rpe),
                    notes: emptyToNull(r.notes),
                    intensity: emptyToNull(r.intensity),
                    order_index: r.order_index ?? 0,
                    custom_fields: r.custom_fields ? JSON.parse(r.custom_fields) : null,
                    synced_at: new Date().toISOString(),
                }),
            },
            // ── Classes Module ──
            {
                local: 'gym_classes',
                cloud: 'cloud_gym_classes',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    name: r.name,
                    description: r.description,
                    instructor: r.instructor,
                    color_theme: r.color_theme,
                    max_capacity: r.max_capacity,
                    duration_minutes: r.duration_minutes,
                    active: r.active,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'gym_class_schedules',
                cloud: 'cloud_gym_class_schedules',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    class_id: r.class_id,
                    day_of_week: r.day_of_week,
                    start_time: r.start_time,
                    end_time: r.end_time,
                    synced_at: new Date().toISOString(),
                }),
            },
        ];
    }

    // ─── CORE SYNC LOGIC ────────────────────────────────────────────────────────

    /**
     * Sync a single table: read unsynced rows, upsert to cloud, mark synced.
     * Processes in batches to avoid Supabase payload limits.
     */
    async _syncTable(localTable, cloudTable, mapFn, gymId) {
        const db = dbManager.getInstance();

        const rows = db.prepare(
            `SELECT * FROM ${localTable} WHERE gym_id = ? AND synced = 0`
        ).all(gymId);

        if (!rows.length) return 0;

        const supabase = this._getSupabase();
        let syncedCount = 0;

        // Process in batches
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const mapped = [];

            for (const row of batch) {
                try {
                    mapped.push(mapFn(row));
                } catch (mapErr) {
                    console.warn(`[SYNC] ⚠️ Skipping ${localTable} id=${row.id}: ${mapErr.message}`);
                }
            }

            if (!mapped.length) continue;

            const { error } = await supabase
                .from(cloudTable)
                .upsert(mapped, { onConflict: 'gym_id,local_id' });

            if (error) {
                console.error(`[SYNC] ❌ ${localTable} → ${cloudTable} batch error:`, error.message);
                continue; // Skip this batch, try next
            }

            // Mark synced in local DB
            const ids = batch.map((r) => r.id);
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(
                `UPDATE ${localTable} SET synced = 1 WHERE id IN (${placeholders})`
            ).run(...ids);

            syncedCount += ids.length;
        }

        if (syncedCount > 0) {
            console.log(`[SYNC] ✅ ${localTable}: ${syncedCount}/${rows.length} synced`);
        }
        return syncedCount;
    }

    /**
     * Process deletion log: delete from cloud, then clear local log entries.
     */
    async _syncDeletions(gymId) {
        const db = dbManager.getInstance();
        const supabase = this._getSupabase();

        const deletions = db.prepare(
            'SELECT * FROM sync_deleted_log WHERE gym_id = ?'
        ).all(gymId);

        if (!deletions.length) return 0;

        let deletedCount = 0;
        const processedIds = [];

        // Whitelist of valid table names to prevent injection via sync_deleted_log
        const validTables = new Set(this._getTableMappings().map(m => m.local));

        for (const del of deletions) {
            if (!validTables.has(del.table_name)) {
                console.warn(`[SYNC] ⚠️ Skipping unknown table in sync_deleted_log: ${del.table_name}`);
                processedIds.push(del.id); // Clean up the invalid entry
                continue;
            }
            const cloudTable = `cloud_${del.table_name}`;

            try {
                const { error } = await supabase
                    .from(cloudTable)
                    .delete()
                    .match({ gym_id: del.gym_id, local_id: del.local_id });

                if (error) {
                    // If table doesn't exist or row doesn't exist, still consider it processed
                    if (error.code === '42P01' || error.code === 'PGRST116') {
                        console.warn(`[SYNC] ⚠️ Delete skip (table/row not found): ${cloudTable} id=${del.local_id}`);
                    } else {
                        console.error(`[SYNC] ❌ Delete failed: ${cloudTable} id=${del.local_id}:`, error.message);
                        continue; // Don't mark as processed
                    }
                }

                processedIds.push(del.id);
                deletedCount++;
            } catch (err) {
                console.error(`[SYNC] ❌ Delete exception: ${cloudTable} id=${del.local_id}:`, err.message);
            }
        }

        // Clear processed log entries
        if (processedIds.length > 0) {
            const placeholders = processedIds.map(() => '?').join(',');
            db.prepare(
                `DELETE FROM sync_deleted_log WHERE id IN (${placeholders})`
            ).run(...processedIds);
            console.log(`[SYNC] 🗑️ Deletions: ${deletedCount}/${deletions.length} processed`);
        }

        return deletedCount;
    }

    // ─── PUBLIC API ─────────────────────────────────────────────────────────────

    /**
     * Run a full sync cycle: all tables + deletions.
     * Guarded against concurrent execution.
     */
    async runFullSync() {
        if (this._running) {
            console.log('[SYNC] ⏳ Sync already in progress, skipping...');
            return;
        }

        const supabase = this._getSupabase();
        if (!supabase) {
            // Supabase not configured — silently skip
            return;
        }

        const gymId = this.getGymId();
        if (!gymId || gymId === 'LOCAL_DEV') {
            // No license activated — skip sync
            return;
        }

        this._running = true;
        this._notifyRenderer('syncing');

        const startTime = Date.now();
        let totalSynced = 0;
        let totalDeleted = 0;
        let hasErrors = false;

        try {
            // 1. Sync tables in dependency order
            const mappings = this._getTableMappings();
            for (const { local, cloud, map } of mappings) {
                try {
                    const count = await this._syncTable(local, cloud, map, gymId);
                    totalSynced += count;
                } catch (err) {
                    console.error(`[SYNC] ❌ Table ${local} failed:`, err.message);
                    hasErrors = true;
                    // Continue with next table — don't abort entire sync
                }
            }

            // 2. Process deletions
            try {
                totalDeleted = await this._syncDeletions(gymId);
            } catch (err) {
                console.error('[SYNC] ❌ Deletions failed:', err.message);
                hasErrors = true;
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            this._lastSyncAt = new Date();

            if (totalSynced > 0 || totalDeleted > 0) {
                console.log(`[SYNC] ✅ Sync complete in ${elapsed}s — ${totalSynced} upserted, ${totalDeleted} deleted`);
            }

            this._notifyRenderer(hasErrors ? 'partial' : 'idle', {
                synced: totalSynced,
                deleted: totalDeleted,
                elapsed,
                lastSync: this._lastSyncAt.toISOString(),
            });

        } catch (err) {
            console.error('[SYNC] ❌ Full sync failed:', err.message);
            this._notifyRenderer('error', { message: err.message });
        } finally {
            this._running = false;
        }
    }

    /**
     * Get sync status info (for IPC handler).
     */
    getStatus() {
        return {
            running: this._running,
            lastSyncAt: this._lastSyncAt ? this._lastSyncAt.toISOString() : null,
        };
    }
}

module.exports = new SyncService();
