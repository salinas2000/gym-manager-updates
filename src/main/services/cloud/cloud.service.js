const { createClient } = require('@supabase/supabase-js');
const dbManager = require('../../db/database');
const settingsService = require('../local/settings.service');
const credentialManager = require('../../config/credentials');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_GYM_ID = 'GYM-PRO-MAIN';

class CloudService {
    constructor() {
        this.supabase = null;
        this.mainWindow = null;
        this.activeChannels = new Set(); // Track active subscriptions
        this.credentials = null;
        this.init();
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    init() {
        try {
            // Load credentials from secure manager
            if (!credentialManager.isLoaded()) {
                console.warn('[CLOUD_SYNC] ⚠️ Credentials not loaded. Supabase disabled.');
                return;
            }

            this.credentials = credentialManager.get();
            const { supabase } = this.credentials;

            if (!supabase?.url || !supabase?.key) {
                console.warn('[CLOUD_SYNC] ⚠️ Supabase credentials incomplete');
                return;
            }

            console.log('[CLOUD_SYNC] ✅ Initializing with secure credentials');
            this.supabase = createClient(supabase.url, supabase.key);
        } catch (error) {
            console.error('[CLOUD_SYNC] ❌ Failed to initialize:', error.message);
            return;
        }

        // Setup Realtime if gym_id is known
        const gymId = settingsService.get('gym_id');
        if (gymId) {
            this.setupRealtime(gymId);
        }
    }

    setupRealtime(gymId) {
        if (!this.supabase || !gymId) return;
        if (this.activeChannels.has(gymId)) {
            console.log('📡 [CLOUD_SYNC] Realtime already active for gym:', gymId);
            return;
        }

        console.log('📡 [CLOUD_SYNC] Setting up Realtime for gym:', gymId);

        const channel = this.supabase
            .channel(`remote_loads_${gymId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'cloud_remote_loads'
                    // Remove strict filter to handle it in JS with better logging
                },
                (payload) => {
                    const receivedGymId = payload.new.gym_id;
                    console.log(`🚀 [CLOUD_SYNC] Realtime Push Signal: For Gym[${receivedGymId}] (Local Gym is [${gymId}])`);

                    if (receivedGymId === gymId) {
                        console.log('✅ [CLOUD_SYNC] Gym ID Match! Sending notification to UI...');
                        if (this.mainWindow) {
                            this.mainWindow.webContents.send('cloud:remote-load-pending', {
                                gym_id: receivedGymId,
                                timestamp: payload.new.created_at,
                                load_id: payload.new.id
                            });
                        }
                    } else {
                        console.log('ℹ️ [CLOUD_SYNC] Post-filtered event: Gym ID mismatch. Ignored.');
                    }
                }
            );

        channel.subscribe((status, err) => {
            console.log(`📡 [CLOUD_SYNC] Realtime channel status: ${status}`, err || '');
            if (status === 'SUBSCRIBED') {
                this.activeChannels.add(gymId);
                console.log('✅ [CLOUD_SYNC] Realtime SUBSCRIBED for gym:', gymId);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ [CLOUD_SYNC] Realtime CHANNEL_ERROR:', err);
            } else if (status === 'TIMED_OUT') {
                console.error('❌ [CLOUD_SYNC] Realtime TIMED_OUT');
            } else if (status === 'CLOSED') {
                console.warn('⚠️ [CLOUD_SYNC] Realtime channel CLOSED');
                this.activeChannels.delete(gymId);
            }
        });
    }

    _resolveGymId(overrideId) {
        if (overrideId) return overrideId;

        // 1. Try retrieving from License Service (Authoritative Source)
        try {
            const licenseService = require('../local/license.service');
            const data = licenseService.getLicenseData();
            if (data && data.gym_id) return data.gym_id;
        } catch (e) {
            console.warn('[CLOUD_SYNC] Failed to resolve ID from LicenseService:', e);
        }

        const id = settingsService.get('gym_id');
        if (id) return id;

        // Fallback (Should rarely happen in enabled app)
        const name = settingsService.get('gym_name');
        return name ? name.trim().replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() : DEFAULT_GYM_ID;
    }

    async performFullBackup(gymId) {
        const targetGymId = this._resolveGymId(gymId);

        if (!this.supabase) {
            return { success: false, error: 'Supabase client not initialized.' };
        }

        try {
            console.log(`[CLOUD_SYNC] Starting FULL BACKUP SET for ${targetGymId}`);

            // Unified ID for this backup set
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Format: YYYY-MM-DDTHH-mm-ss-msZ

            console.log('[CLOUD_SYNC] Starting DB Snapshot Upload...');
            const snapshotUrl = await this.backupDatabaseFile(targetGymId, timestamp);

            console.log('[CLOUD_SYNC] Starting Template Config Upload...');
            const configUrl = await this.backupTemplateConfig(targetGymId, timestamp);

            console.log('[CLOUD_SYNC] Starting Template Excel Upload...');
            const excelUrl = await this.backupTemplateExcel(targetGymId, timestamp);

            const finalResult = {
                success: true,
                data: {
                    tables: {},
                    backupId: timestamp,
                    fileBackup: snapshotUrl,
                    configBackup: configUrl,
                    excelBackup: excelUrl
                }
            };

            console.log('[CLOUD_SYNC] Backup Set Complete.', JSON.stringify(finalResult));
            return finalResult;

        } catch (error) {
            console.error('[CLOUD_SYNC] Backup snapshot failed.', error);
            return { success: false, error: error.message };
        }
    }

    async backupDatabaseFile(targetGymId, backupId) {
        try {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'gym_manager.db');

            if (!fs.existsSync(dbPath)) return null;

            const fileBuffer = fs.readFileSync(dbPath);
            // Naming convention: {TIMESTAMP}_gym_manager.db
            const fileName = `${targetGymId}/sys_backups/${backupId}_gym_manager.db`;

            const { error } = await this.supabase
                .storage
                .from('training_files')
                .upload(fileName, fileBuffer, {
                    contentType: 'application/x-sqlite3',
                    upsert: true
                });

            if (error) throw error;
            return fileName;

        } catch (err) {
            console.error('Snapshot Upload Error:', err);
            throw new Error('Error subiendo archivo .db: ' + err.message);
        }
    }

    async backupTemplateConfig(targetGymId, backupId) {
        try {
            const userDataPath = app.getPath('userData');
            const configPath = path.join(userDataPath, 'templates', targetGymId, 'template_config.json');

            if (!fs.existsSync(configPath)) return null;

            const fileBuffer = fs.readFileSync(configPath);
            // Standardized Naming: {TIMESTAMP}_template_config.json
            const fileName = `${targetGymId}/sys_backups/${backupId}_template_config.json`;

            const { error } = await this.supabase
                .storage
                .from('training_files')
                .upload(fileName, fileBuffer, {
                    contentType: 'application/json',
                    upsert: true
                });

            if (error) throw error;
            return fileName;
        } catch (err) {
            console.error('[CLOUD_SYNC] Template Config Backup Error:', err);
            return null;
        }
    }

    async backupTemplateExcel(targetGymId, backupId) {
        try {
            const userDataPath = app.getPath('userData');
            const excelPath = path.join(userDataPath, 'templates', targetGymId, 'org_template.xlsx');

            if (!fs.existsSync(excelPath)) return null;

            const fileBuffer = fs.readFileSync(excelPath);
            // Standardized Naming: {TIMESTAMP}_org_template.xlsx
            const fileName = `${targetGymId}/sys_backups/${backupId}_org_template.xlsx`;

            const { error } = await this.supabase
                .storage
                .from('training_files')
                .upload(fileName, fileBuffer, {
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    upsert: true
                });

            if (error) throw error;
            return fileName;
        } catch (err) {
            console.error('[CLOUD_SYNC] Template Excel Backup Error:', err);
            return null;
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

            // Validate the imported file is a valid SQLite database
            const Database = require('better-sqlite3');
            let testDb;
            try {
                testDb = new Database(sourcePath, { readonly: true });
                // Check it has at least one expected table
                const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
                const tableNames = tables.map(t => t.name);
                const requiredTables = ['customers', 'payments', 'memberships'];
                const missing = requiredTables.filter(t => !tableNames.includes(t));
                if (missing.length > 0) {
                    throw new Error(`Base de datos inválida: faltan tablas requeridas (${missing.join(', ')})`);
                }
                // Quick integrity check
                const integrity = testDb.pragma('integrity_check');
                if (integrity[0]?.integrity_check !== 'ok') {
                    throw new Error('Base de datos corrupta: integrity check fallido');
                }
            } catch (validationErr) {
                if (validationErr.message.includes('inválida') || validationErr.message.includes('corrupta')) {
                    throw validationErr;
                }
                throw new Error(`El archivo seleccionado no es una base de datos SQLite válida: ${validationErr.message}`);
            } finally {
                if (testDb) try { testDb.close(); } catch (e) { }
            }

            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'gym_manager.db');
            const backupPath = path.join(userDataPath, 'gym_manager_pre_import.bak');

            // 1. Backup current DB before overwriting
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, backupPath);
                console.log('[Import] Pre-import backup created at:', backupPath);
            }

            // 2. Close current connection
            dbManager.close();

            // 3. Overwrite file
            fs.copyFileSync(sourcePath, dbPath);
            console.log('Database file overwritten successfully.');

            // 4. Re-initialize
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
     * Tracks lastModified timestamp to detect re-uploads of the same file.
     */
    async checkRemoteLoad(gymId) {
        if (!this.supabase || !gymId) return;

        try {
            const { data, error } = await this.supabase
                .storage
                .from('training_files')
                .list(`${gymId}/remote_load/`);

            if (error) return;

            const remoteFile = data && data.find(file => file.name === 'gym_manager.db');

            if (remoteFile && this.mainWindow) {
                const fileTimestamp = remoteFile.updated_at || remoteFile.created_at;

                // Only notify if this is a NEW file or a NEWER version
                if (fileTimestamp !== this._lastRemoteLoadTimestamp) {
                    console.log('📡 [CLOUD_SYNC] Remote load detected for gym:', gymId, '| Modified:', fileTimestamp);
                    this.mainWindow.webContents.send('cloud:remote-load-pending', {
                        gym_id: gymId,
                        timestamp: fileTimestamp || new Date().toISOString()
                    });
                    this._lastRemoteLoadTimestamp = fileTimestamp;
                }
            } else {
                // File was consumed/cleaned — reset tracker
                this._lastRemoteLoadTimestamp = null;
            }
        } catch (e) {
            console.error('[CLOUD_SYNC] checkRemoteLoad Error:', e);
        }
    }

    async applyRemoteLoad(gymId, loadId = null) {
        if (!this.supabase || !gymId) throw new Error('Cargador no inicializado.');

        const remotePath = `${gymId}/remote_load/gym_manager.db`;

        try {
            // 1. Download the Database
            const { data, error } = await this.supabase
                .storage
                .from('training_files')
                .download(remotePath);

            if (error) throw error;

            // 2. Save temporarily to disk
            const tempPath = path.join(app.getPath('temp'), `remote_load_${Date.now()}.db`);
            const arrayBuffer = await data.arrayBuffer();
            fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));

            // 3. Import DB
            const importRes = await this.importDatabase(tempPath);
            if (!importRes.success) throw new Error(importRes.error);

            // 4. Cleanup DB from cloud
            await this.supabase.storage.from('training_files').remove([remotePath]);

            // 5. Restore Templates (Priority: Remote Load staging -> Fallback: Sys Backups)
            await this._restoreTemplateFiles(gymId);

            // 6. Update status in tracking table
            if (loadId) {
                await this.supabase
                    .from('cloud_remote_loads')
                    .update({ status: 'applied', applied_at: new Date().toISOString() })
                    .eq('id', loadId);
            } else {
                await this.supabase
                    .from('cloud_remote_loads')
                    .update({ status: 'applied', applied_at: new Date().toISOString() })
                    .eq('gym_id', gymId)
                    .eq('status', 'pending');
            }

            // 7. Cleanup temp file
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            return { success: true };
        } catch (err) {
            console.error('[CLOUD_SYNC] applyRemoteLoad Error:', err);
            if (loadId) {
                await this.supabase
                    .from('cloud_remote_loads')
                    .update({ status: 'failed', error: err.message })
                    .eq('id', loadId);
            }
            throw err;
        }
    }

    async _restoreTemplateFiles(gymId) {
        try {
            console.log(`[CLOUD_SYNC] Restore Templates for gym: ${gymId}`);
            const userDataPath = app.getPath('userData');
            const targetDir = path.join(userDataPath, 'templates', gymId);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            // STRATEGY A: Check for explicitly pushed templates in remote_load/ (Exact Restore)
            const filesToCheck = ['template_config.json', 'org_template.xlsx'];
            let restoredCount = 0;

            for (const file of filesToCheck) {
                const remotePath = `${gymId}/remote_load/${file}`;
                const { data, error } = await this.supabase.storage.from('training_files').download(remotePath);

                if (data && !error) {
                    console.log(`[CLOUD_SYNC] ✅ Found EXACT MATCH restore for ${file}`);
                    fs.writeFileSync(path.join(targetDir, file), Buffer.from(await data.arrayBuffer()));
                    // Cleanup remote staging
                    await this.supabase.storage.from('training_files').remove([remotePath]);
                    restoredCount++;
                }
            }

            if (restoredCount === 2) {
                console.log('[CLOUD_SYNC] Full exact template restoration complete.');
                return;
            }

            // STRATEGY B: Fallback to latest in sys_backups (Legacy / Partial Restore)
            if (restoredCount < 2) {
                console.log('[CLOUD_SYNC] Exact templates not found. Falling back to LATEST from sys_backups (Legacy Mode).');
                const { data: files, error } = await this.supabase
                    .storage
                    .from('training_files')
                    .list(`${gymId}/sys_backups`, { // Removed trailing slash fix
                        limit: 100,
                        sortBy: { column: 'name', order: 'desc' }
                    });

                if (error || !files) return;

                const latestConfig = files.find(f => f.name.startsWith('template_config_'));
                const latestExcel = files.find(f => f.name.startsWith('org_template_'));

                // Only download if we didn't already restore the exact one
                if (latestConfig && !fs.existsSync(path.join(targetDir, 'template_config.json'))) {
                    console.log('[CLOUD_SYNC] Downloading latest template_config (fallback)...');
                    const { data } = await this.supabase.storage.from('training_files').download(`${gymId}/sys_backups/${latestConfig.name}`);
                    if (data) fs.writeFileSync(path.join(targetDir, 'template_config.json'), Buffer.from(await data.arrayBuffer()));
                }

                if (latestExcel && !fs.existsSync(path.join(targetDir, 'org_template.xlsx'))) {
                    console.log('[CLOUD_SYNC] Downloading latest org_template (fallback)...');
                    const { data } = await this.supabase.storage.from('training_files').download(`${gymId}/sys_backups/${latestExcel.name}`);
                    if (data) fs.writeFileSync(path.join(targetDir, 'org_template.xlsx'), Buffer.from(await data.arrayBuffer()));
                }
            }

        } catch (err) {
            console.error('[CLOUD_SYNC] Template Restoration failed:', err);
        }
    }
}

module.exports = new CloudService();
