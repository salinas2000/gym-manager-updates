const { createClient } = require('@supabase/supabase-js');
const dbManager = require('../db/database');
const settingsService = require('./settings.service');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
// Ensure dotenv is loaded if main.js hasn't loaded it yet (safety)
require('dotenv').config();

// NOTE: Credentials now loaded from .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const DEFAULT_GYM_ID = 'GYM-PRO-MAIN';

class CloudService {
    constructor() {
        this.supabase = null;
        this.mainWindow = null; // Stored for IPC notifications
        this.init();
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    init() {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn('CloudService: Supabase credentials not found in .env');
            return;
        }
        this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Setup Realtime if gym_id is known
        const gymId = settingsService.get('gym_id');
        if (gymId) {
            this.setupRealtime(gymId);
        }
    }

    setupRealtime(gymId) {
        if (!this.supabase) return;

        console.log('📡 [CloudService] Setting up Realtime for gym:', gymId);

        this.supabase
            .channel(`remote_loads_${gymId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'cloud_remote_loads',
                    filter: `gym_id=eq.${gymId}`
                },
                (payload) => {
                    console.log('🚀 [CloudService] Instant push signal received:', payload);
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('cloud:remote-load-pending', {
                            gym_id: gymId,
                            timestamp: payload.new.created_at,
                            load_id: payload.new.id
                        });
                    }
                }
            )
            .subscribe();
    }

    _resolveGymId(overrideId) {
        if (overrideId) return overrideId;
        const name = settingsService.get('gym_name');
        return name ? name.trim().replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() : DEFAULT_GYM_ID;
    }

    async performFullBackup(gymId) {
        const targetGymId = this._resolveGymId(gymId);

        if (!this.supabase) {
            return { success: false, error: 'Supabase client not initialized.' };
        }

        const db = dbManager.getInstance();
        const results = {
            tables: {},
            fileBackup: null,
            errors: []
        };

        try {
            console.log(`CloudService: Starting FULL SYNC for ${targetGymId}`);

            // === PART 1: ROW SYNC (Upsert + Prune) ===

            // Helper to sync a table
            const syncTable = async (localTable, cloudTable, mapFn, rowsOverride = null) => {
                const rows = rowsOverride || db.prepare(`SELECT * FROM ${localTable}`).all();
                const localIds = rows.map(r => r.id);

                // 1. Upsert
                if (rows.length > 0) {
                    const cloudRows = rows.map(r => ({
                        ...mapFn(r),
                        gym_id: targetGymId,
                        synced_at: new Date().toISOString()
                    }));
                    const { error } = await this.supabase.from(cloudTable).upsert(cloudRows, { onConflict: 'gym_id, local_id' });
                    if (error) throw new Error(`${localTable} Upsert: ${error.message}`);
                }

                // 2. Prune (Delete from cloud what is not in local)
                let deleteQuery = this.supabase.from(cloudTable).delete().eq('gym_id', targetGymId);

                if (localIds.length > 0) {
                    deleteQuery = deleteQuery.not('local_id', 'in', `(${localIds.join(',')})`);
                }

                const { error: deleteError } = await deleteQuery;
                if (deleteError) throw new Error(`${localTable} Prune: ${deleteError.message}`);

                return rows.length;
            };

            // 1. Tariffs
            results.tables.tariffs = await syncTable('tariffs', 'cloud_tariffs', t => ({
                local_id: t.id, name: t.name, amount: t.amount, color_theme: t.color_theme
            }));

            // 2. Customers
            results.tables.customers = await syncTable('customers', 'cloud_customers', c => ({
                local_id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email,
                phone: c.phone, active: c.active, tariff_id: c.tariff_id, created_at: c.created_at
            }));

            // 3. Memberships
            results.tables.memberships = await syncTable('memberships', 'cloud_memberships', m => ({
                local_id: m.id, customer_id: m.customer_id, start_date: m.start_date, end_date: m.end_date
            }));

            // 4. Payments
            results.tables.payments = await syncTable('payments', 'cloud_payments', p => ({
                local_id: p.id, customer_id: p.customer_id, amount: p.amount,
                payment_date: p.payment_date, tariff_name: p.tariff_name
            }));

            // 5. Training
            results.tables.categories = await syncTable('exercise_categories', 'cloud_exercise_categories', c => ({
                local_id: c.id, name: c.name, icon: c.icon, is_system: c.is_system ? 1 : 0
            }));

            results.tables.subcategories = await syncTable('exercise_subcategories', 'cloud_exercise_subcategories', s => ({
                local_id: s.id, category_id: s.category_id, name: s.name
            }));

            results.tables.exercises = await syncTable('exercises', 'cloud_exercises', e => ({
                local_id: e.id, name: e.name, subcategory_id: e.subcategory_id, video_url: e.video_url,
                default_sets: e.default_sets, default_reps: e.default_reps, is_failure: e.is_failure ? 1 : 0
            }));

            // FILTERING TEMPLATES (Require customer_id NOT NULL in cloud)
            const allMesocycles = db.prepare('SELECT * FROM mesocycles').all();
            const validMesocycles = allMesocycles.filter(m => m.customer_id != null);
            const validMesoIds = validMesocycles.map(m => m.id);

            results.tables.mesocycles = await syncTable('mesocycles', 'cloud_mesocycles', m => ({
                local_id: m.id, customer_id: m.customer_id, name: m.name, start_date: m.start_date,
                end_date: m.end_date, active: m.active, notes: m.notes, created_at: m.created_at
            }), validMesocycles); // Pass filtered list

            // Filter Routines (Only those belonging to valid mesocycles)
            const allRoutines = db.prepare('SELECT * FROM routines').all();
            const validRoutines = allRoutines.filter(r => validMesoIds.includes(r.mesocycle_id));
            const validRoutineIds = validRoutines.map(r => r.id);

            results.tables.routines = await syncTable('routines', 'cloud_routines', r => ({
                local_id: r.id, mesocycle_id: r.mesocycle_id, name: r.name, day_group: r.day_group,
                notes: r.notes, created_at: r.created_at
            }), validRoutines);

            // Filter Routine Items (Only those belonging to valid routines)
            const allItems = db.prepare('SELECT * FROM routine_items').all();
            const validItems = allItems.filter(i => validRoutineIds.includes(i.routine_id));

            results.tables.items = await syncTable('routine_items', 'cloud_routine_items', i => ({
                local_id: i.id, routine_id: i.routine_id, exercise_id: i.exercise_id, series: i.series,
                reps: i.reps, rpe: i.rpe, notes: i.notes, order_index: i.order_index
            }), validItems);


            // === PART 2: FILE SNAPSHOT (Physical DB) ===
            console.log('CloudService: Starting DB Snapshot Upload...');
            const snapshotUrl = await this.backupDatabaseFile(targetGymId);
            results.fileBackup = snapshotUrl;

            const finalResult = { success: true, data: results };
            console.log('CloudService: Sync Complete.', JSON.stringify(finalResult));
            return finalResult;

        } catch (error) {
            console.error('CloudService: Backup failed.', error);
            return { success: false, error: error.message };
        }
    }

    async backupDatabaseFile(targetGymId) {
        try {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'gym_manager.db');

            if (!fs.existsSync(dbPath)) {
                console.warn('No database file found at ' + dbPath);
                return null;
            }

            // Read file into buffer
            // NOTE: In high traffic apps, we might want to copy it first or use sqlite backup API.
            // For desktop single user, reading is usually fine even if locked (WAL mode allows readers).
            const fileBuffer = fs.readFileSync(dbPath);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `${targetGymId}/sys_backups/${timestamp}_gym_manager.db`;

            const { data, error } = await this.supabase
                .storage
                .from('training_files') // Using existing bucket
                .upload(fileName, fileBuffer, {
                    contentType: 'application/x-sqlite3',
                    upsert: true
                });

            if (error) throw error;

            // Get public URL? Sys backups might be better private, but for now we follow pattern
            // const { data: publicData } = this.supabase.storage.from('training_files').getPublicUrl(fileName);
            // return publicData.publicUrl;
            return fileName;

        } catch (err) {
            console.error('Snapshot Upload Error:', err);
            throw new Error('Error subiendo archivo .db: ' + err.message);
        }
    }

    async uploadTrainingFile(gymId, customerId, buffer, fileName) {
        if (!this.supabase) return null;
        const targetGymId = this._resolveGymId(gymId);
        const year = new Date().getFullYear();
        const filePath = `${targetGymId}/${customerId}/${year}/${fileName}`;

        const { data, error } = await this.supabase
            .storage
            .from('training_files')
            .upload(filePath, buffer, {
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                upsert: true
            });

        if (error) {
            console.error('Storage Upload Error:', error);
            throw error;
        }

        const { data: publicData } = this.supabase.storage.from('training_files').getPublicUrl(filePath);
        return publicData.publicUrl;
    }
    async exportDatabase(targetPath) {
        try {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'gym_manager.db');

            if (!fs.existsSync(dbPath)) {
                throw new Error('Database file not found');
            }

            // Simple copy
            fs.copyFileSync(dbPath, targetPath);
            return { success: true };
        } catch (err) {
            console.error('Export Local DB Error:', err);
            return { success: false, error: err.message };
        }
    }

    async importDatabase(sourcePath) {
        try {
            if (!fs.existsSync(sourcePath)) {
                throw new Error('Archivo de origen no encontrado');
            }

            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'gym_manager.db');

            // 1. Close current connection
            dbManager.close();

            // 2. Overwrite file
            fs.copyFileSync(sourcePath, dbPath);
            console.log('Database file overwritten successfully.');

            // 3. Re-initialize
            dbManager.init();

            return { success: true };
        } catch (err) {
            console.error('Import Local DB Error:', err);
            // Attempt to re-init if it failed mid-way
            try { dbManager.init(); } catch (e) { }
            return { success: false, error: err.message };
        }
    }

    /**
     * Periodically checks if the Administrator has pushed a new database version.
     */
    async checkRemoteLoad(gymId) {
        if (!this.supabase || !gymId) return;

        try {
            const fileName = `${gymId}/remote_load/gym_manager.db`;
            const { data, error } = await this.supabase
                .storage
                .from('training_files')
                .list(`${gymId}/remote_load/`);

            if (error) return;

            const hasRemoteLoad = data && data.some(file => file.name === 'gym_manager.db');

            if (hasRemoteLoad && this.mainWindow) {
                console.log('📡 [CloudService] Remote load detected for gym:', gymId);
                this.mainWindow.webContents.send('cloud:remote-load-pending', {
                    gym_id: gymId,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (e) {
            console.error('[CloudService] checkRemoteLoad Error:', e);
        }
    }

    async applyRemoteLoad(gymId, loadId = null) {
        if (!this.supabase || !gymId) throw new Error('Cargador no inicializado.');

        const remotePath = `${gymId}/remote_load/gym_manager.db`;

        try {
            // 1. Download the file
            const { data, error } = await this.supabase
                .storage
                .from('training_files')
                .download(remotePath);

            if (error) throw error;

            // 2. Save temporarily to disk
            const tempPath = path.join(app.getPath('temp'), `remote_load_${Date.now()}.db`);
            const arrayBuffer = await data.arrayBuffer();
            fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));

            // 3. Import (using existing logic)
            const importRes = await this.importDatabase(tempPath);
            if (!importRes.success) throw new Error(importRes.error);

            // 4. Cleanup cloud (Delete the load file so it doesn't trigger again)
            await this.supabase.storage.from('training_files').remove([remotePath]);

            // 5. Update status in tracking table
            if (loadId) {
                await this.supabase
                    .from('cloud_remote_loads')
                    .update({
                        status: 'applied',
                        applied_at: new Date().toISOString()
                    })
                    .eq('id', loadId);
            } else {
                // If no loadId (legacy poll), update all pending for this gym
                await this.supabase
                    .from('cloud_remote_loads')
                    .update({
                        status: 'applied',
                        applied_at: new Date().toISOString()
                    })
                    .eq('gym_id', gymId)
                    .eq('status', 'pending');
            }

            // 6. Cleanup temp file
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            return { success: true };
        } catch (err) {
            console.error('[CloudService] applyRemoteLoad Error:', err);
            if (loadId) {
                await this.supabase
                    .from('cloud_remote_loads')
                    .update({
                        status: 'failed',
                        error: err.message
                    })
                    .eq('id', loadId);
            }
            throw err;
        }
    }
}

module.exports = new CloudService();
