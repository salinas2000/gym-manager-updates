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
     * Returns true if sync should run — equivalent to "credentials are loaded
     * AND we have an owner_token to authenticate Edge Function calls".
     * (Post-Option C, sync no longer needs a Supabase client directly.)
     */
    _canSync() {
        const credentialManager = require('../../config/credentials');
        const licenseService = require('../local/license.service');
        return credentialManager.isLoaded() && !!licenseService.getOwnerToken();
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
                    tracking_type: r.tracking_type || 'strength',
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
            // ── Exercise field configuration (prescribable & loggable flags) ──
            {
                local: 'exercise_field_config',
                cloud: 'cloud_exercise_field_config',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    field_key: r.field_key,
                    label: r.label,
                    type: r.type || 'text',
                    is_active: r.is_active ?? 1,
                    is_mandatory_in_template: r.is_mandatory_in_template ?? 0,
                    is_loggable: r.is_loggable ?? 0,
                    is_prescribable: r.is_prescribable ?? 1,
                    options: r.options ? JSON.parse(r.options) : null,
                    is_deleted: r.is_deleted ?? 0,
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
            {
                local: 'trainers',
                cloud: 'cloud_trainers',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    name: r.name,
                    color_theme: r.color_theme || 'blue',
                    phone: r.phone,
                    email: r.email,
                    active: r.active,
                    synced_at: new Date().toISOString(),
                }),
            },
            {
                local: 'trainer_schedules',
                cloud: 'cloud_trainer_schedules',
                map: (r) => ({
                    gym_id: r.gym_id,
                    local_id: r.id,
                    trainer_id: r.trainer_id,
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

        const ownerSync = require('./owner-sync.client');
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

            // Route through the owner-sync Edge Function. The Edge Function
            // pins gym_id server-side (defends against cross-tenant writes)
            // and uses service_role internally — never returned to us.
            const result = await ownerSync.upsert(cloudTable, mapped, 'gym_id,local_id', gymId);
            if (!result?.success) {
                console.error(`[SYNC] ❌ ${localTable} → ${cloudTable} batch error:`, result?.error);
                continue; // Skip this batch, try next
            }

            // RACE SAFETY: mark synced=1 ONLY if updated_at hasn't moved since
            // we read the row. If saveMesocycle (or any other writer) bumped
            // updated_at between our SELECT and now, the row got new edits
            // that we never pushed — leaving it synced=0 means the next sync
            // cycle picks them up. The blunt `UPDATE WHERE id IN (...)` we
            // used before silently clobbered those edits.
            const markStmt = db.prepare(
                `UPDATE ${localTable} SET synced = 1 WHERE id = ? AND updated_at = ?`
            );
            const markTx = db.transaction((items) => {
                let marked = 0;
                for (const r of items) {
                    const info = markStmt.run(r.id, r.updated_at);
                    marked += info.changes;
                }
                return marked;
            });
            syncedCount += markTx(batch);
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
        const ownerSync = require('./owner-sync.client');

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
                const result = await ownerSync.deleteMatch(
                    cloudTable,
                    { local_id: del.local_id },
                    del.gym_id
                );
                if (!result?.success) {
                    // Treat unknown-table errors as already processed (idempotent)
                    if (result?.code === '42P01' || result?.code === 'PGRST116') {
                        console.warn(`[SYNC] ⚠️ Delete skip (table/row not found): ${cloudTable} id=${del.local_id}`);
                    } else {
                        console.error(`[SYNC] ❌ Delete failed: ${cloudTable} id=${del.local_id}:`, result?.error);
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

    /**
     * Compare cloud_routines + cloud_routine_items against the local SQLite
     * for this gym, and DELETE anything in cloud that has no matching local
     * row. This catches "ghost" rows left behind by earlier buggy versions of
     * saveMesocycle (the old DELETE+INSERT loop that never tracked deletions).
     *
     * Strategy:
     *   - Pull all routine local_ids the LOCAL believes exist (set L).
     *   - Pull all routine local_ids CLOUD has for this gym (set C).
     *   - Delete (C - L) from cloud_routines (CASCADE drops their items).
     *   - Then do the same for routine_items, in case items were left behind
     *     pointing to routines that DO exist locally.
     *
     * Returns the total number of cloud rows removed.
     */
    async _reconcileGhostRoutines(gymId) {
        const ownerSync = require('./owner-sync.client');
        const db = dbManager.getInstance();
        let removed = 0;

        // ── Routines ──
        const localRoutineIds = new Set(
            db.prepare('SELECT id FROM routines WHERE gym_id = ?').all(gymId).map(r => r.id)
        );

        // SAFETY GATE — if the local has NO routines at all, we are either on
        // a fresh install / restored DB / second device that hasn't pulled yet.
        // Bail out and let a real save populate the local first.
        if (localRoutineIds.size === 0) {
            console.log('[SYNC] 👻 Skipping ghost reconcile — local has 0 routines (fresh DB / pre-pull).');
            return 0;
        }

        const routinesRes = await ownerSync.select('cloud_routines', 'local_id', gymId);
        if (!routinesRes?.success) {
            console.error('[SYNC] ❌ Ghost-reconcile (routines fetch):', routinesRes?.error);
            return 0;
        }
        const orphanRoutineIds = (routinesRes.data || [])
            .map(r => Number(r.local_id))
            .filter(id => !localRoutineIds.has(id));
        if (orphanRoutineIds.length > 0) {
            console.log(`[SYNC] 👻 Found ${orphanRoutineIds.length} orphan routine(s) in cloud`);
            const CHUNK = 100;
            for (let i = 0; i < orphanRoutineIds.length; i += CHUNK) {
                const chunk = orphanRoutineIds.slice(i, i + CHUNK);
                // Drop their items first (no FK CASCADE in cloud)
                const itemsRes = await ownerSync.deleteIn('cloud_routine_items', 'routine_id', chunk, gymId);
                if (!itemsRes?.success) {
                    console.error('[SYNC] ❌ Ghost-reconcile (orphan items chunk):', itemsRes?.error);
                }
                const routinesDelRes = await ownerSync.deleteIn('cloud_routines', 'local_id', chunk, gymId);
                if (!routinesDelRes?.success) {
                    console.error('[SYNC] ❌ Ghost-reconcile (orphan routines chunk):', routinesDelRes?.error);
                } else {
                    removed += chunk.length;
                }
            }
        }

        // ── Routine items ──
        const localItemIds = new Set(
            db.prepare('SELECT id FROM routine_items WHERE gym_id = ?').all(gymId).map(r => r.id)
        );
        if (localItemIds.size === 0) {
            console.log('[SYNC] 👻 Skipping item ghost reconcile — local has 0 items.');
            return removed;
        }
        const itemsRes = await ownerSync.select('cloud_routine_items', 'local_id', gymId);
        if (!itemsRes?.success) {
            console.error('[SYNC] ❌ Ghost-reconcile (items fetch):', itemsRes?.error);
            return removed;
        }
        const orphanItemIds = (itemsRes.data || [])
            .map(i => Number(i.local_id))
            .filter(id => !localItemIds.has(id));
        if (orphanItemIds.length > 0) {
            console.log(`[SYNC] 👻 Found ${orphanItemIds.length} orphan item(s) in cloud:`, orphanItemIds);
            const CHUNK = 100;
            for (let i = 0; i < orphanItemIds.length; i += CHUNK) {
                const chunk = orphanItemIds.slice(i, i + CHUNK);
                const delRes = await ownerSync.deleteIn('cloud_routine_items', 'local_id', chunk, gymId);
                if (!delRes?.success) {
                    console.error('[SYNC] ❌ Ghost-reconcile (delete orphan items chunk):', delRes?.error);
                } else {
                    removed += chunk.length;
                }
            }
        }

        return removed;
    }

    // ─── PUBLIC API ─────────────────────────────────────────────────────────────

    /**
     * Run a full sync cycle: all tables + deletions.
     * Guarded against concurrent execution.
     */
    async runFullSync() {
        if (this._running) {
            // Stuck-sync safety net: if _running has been set for over twice
            // the wall-timeout, the previous sync silently leaked. Forcibly
            // clear so the app recovers without a restart.
            if (this._runningSince && Date.now() - this._runningSince > 5 * 60 * 1000) {
                console.warn('[SYNC] ⚠️ Detected leaked _running flag (>5min). Forcing reset.');
                this._running = false;
            } else {
                console.log('[SYNC] ⏳ Sync already in progress, skipping...');
                return;
            }
        }

        if (!this._canSync()) {
            // Credentials missing or owner_token not yet provisioned — skip
            return;
        }

        const gymId = this.getGymId();
        if (!gymId || gymId === 'LOCAL_DEV') {
            // No license activated — skip sync
            return;
        }

        this._running = true;
        this._runningSince = Date.now();
        this._notifyRenderer('syncing');

        const startTime = Date.now();
        let totalSynced = 0;
        let totalDeleted = 0;
        let hasErrors = false;
        let timeoutId = null;

        // WALL-CLOCK TIMEOUT — Supabase JS doesn't expose AbortSignal on
        // every call, so a hung TCP connection can block the await forever.
        // Race the entire sync against a hard 2-minute deadline; on timeout
        // the catch fires, _running clears, and the next scheduled sync runs
        // cleanly. (The hung in-flight promise still leaks until the OS
        // socket times out, but the app stays responsive.)
        const WALL_TIMEOUT_MS = 120_000;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(
                () => reject(new Error(`Sync wall-timeout after ${WALL_TIMEOUT_MS / 1000}s`)),
                WALL_TIMEOUT_MS
            );
        });

        const syncWork = (async () => {
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

            // 3. Cloud-side reconciliation for routines/items.
            //    Past bugs left "ghost" routines in cloud that local never knew
            //    about (so sync_deleted_log can't reach them). After every sync,
            //    we hard-compare cloud↔local for routines/items in the same gym
            //    and drop anything in cloud that local doesn't have.
            try {
                const ghosts = await this._reconcileGhostRoutines(gymId);
                if (ghosts > 0) {
                    totalDeleted += ghosts;
                    console.log(`[SYNC] 👻 Reconciled ${ghosts} ghost routine/item record(s) in cloud`);
                }
            } catch (err) {
                console.error('[SYNC] ❌ Ghost reconciliation failed:', err.message);
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
        })();

        try {
            await Promise.race([syncWork, timeoutPromise]);
        } catch (err) {
            console.error('[SYNC] ❌ Full sync failed:', err.message);
            this._notifyRenderer('error', { message: err.message });
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            this._running = false;
            this._runningSince = null;
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
