const { createClient } = require('@supabase/supabase-js');
const dbManager = require('../../db/database');
const settingsService = require('../local/settings.service');
const credentialManager = require('../../config/credentials');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Electron's main process (Node) has no global WebSocket, so realtime-js
// silently fails to open the socket and every channel TIMES_OUT. Inject the
// `ws` implementation explicitly as the realtime transport. (In the renderer
// this would be automatic via the browser's native WebSocket.)
let WebSocketImpl = null;
try { WebSocketImpl = require('ws'); }
catch (e) { console.error('[CLOUD_SYNC] ⚠️ ws module unavailable — realtime will not work:', e.message); }

const DEFAULT_GYM_ID = 'GYM-PRO-MAIN';

class CloudService {
    constructor() {
        this.supabase = null;
        this.mainWindow = null;
        this.activeChannels = new Set(); // Track active subscriptions
        this._realtimeRetryCount = 0;    // Exponential backoff counter
        this._realtimeBackoffTimer = null;
        this.credentials = null;
        this.init();
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    /**
     * Inspect a Supabase key and return the role it carries.
     *   - legacy JWT: base64-decode the payload, return `role` claim
     *   - sb_publishable_*: returns 'publishable'
     *   - sb_secret_*: returns 'secret' (a service_role analogue)
     *   - anything else: null
     */
    _extractKeyRole(key) {
        if (typeof key !== 'string' || !key) return null;
        if (key.startsWith('sb_publishable_')) return 'publishable';
        if (key.startsWith('sb_secret_')) return 'secret';
        if (key.startsWith('eyJ') && key.split('.').length === 3) {
            try {
                const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
                const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
                return decoded?.role || null;
            } catch { return null; }
        }
        return null;
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

            // SECURITY (Option C): this client is used ONLY for realtime
            // channel subscriptions on cloud_remote_loads and
            // gym_class_bookings. Every CRUD / storage / admin operation now
            // routes through Edge Functions authenticated with the per-gym
            // owner_token (see owner-sync.client.js, owner-storage.client.js,
            // owner-data.client.js, _callOwnerAdmin, license.service.js).
            //
            // The SUPABASE_KEY env var MUST be a public-safe key — either the
            // legacy anon JWT (role=anon) or the modern sb_publishable_* form.
            // Both are safe to embed because RLS gates every realtime SELECT.
            // What is NOT safe is a service_role JWT in the installer — that
            // grants god-mode to anyone who unpacks the .exe. Detect by
            // decoding the JWT payload and checking the `role` claim.
            const detectedRole = this._extractKeyRole(supabase.key);
            if (detectedRole === 'service_role') {
                console.warn('[CLOUD_SYNC] ⚠️ SECURITY: SUPABASE_KEY is a service_role JWT. Replace with the anon JWT or sb_publishable_* key. Service_role grants god-mode if extracted from the installer.');
            } else {
                console.log(`[CLOUD_SYNC] ✅ Initializing realtime client with ${detectedRole || 'public'} key`);
            }
            this.supabase = createClient(supabase.url, supabase.key, {
                realtime: {
                    // The critical fix: provide a WebSocket implementation for
                    // the Node/Electron-main environment. Without this every
                    // channel TIMES_OUT because realtime-js can't open a socket.
                    transport: WebSocketImpl,
                    params: { apikey: supabase.key },
                    // Heartbeat keeps the websocket alive through Windows
                    // sleep/wake cycles; default is 30s.
                    heartbeatIntervalMs: 25000,
                },
                auth: {
                    // Desktop is a "non-browser" client — disable web-only
                    // session detection that adds nothing useful here.
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            });
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
            // Already active — don't create duplicate channels
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
                },
                (payload) => {
                    const receivedGymId = payload.new.gym_id;
                    const payloadType = payload.new.payload_type || 'full_db';
                    const payloadPath = payload.new.payload_path || null;
                    console.log(`🚀 [CLOUD_SYNC] Realtime Push: gym=${receivedGymId} type=${payloadType}`);

                    if (receivedGymId !== gymId) {
                        console.log('ℹ️ [CLOUD_SYNC] Gym ID mismatch. Ignored.');
                        return;
                    }
                    if (!this.mainWindow) return;

                    if (payloadType === 'exercise_dataset') {
                        this.mainWindow.webContents.send('cloud:exercise-dataset-pending', {
                            gym_id: receivedGymId,
                            load_id: payload.new.id,
                            payload_path: payloadPath,
                            timestamp: payload.new.created_at,
                        });
                    } else if (payloadType === 'customer_dataset') {
                        this.mainWindow.webContents.send('cloud:customer-dataset-pending', {
                            gym_id: receivedGymId,
                            load_id: payload.new.id,
                            payload_path: payloadPath,
                            timestamp: payload.new.created_at,
                        });
                    } else {
                        this.mainWindow.webContents.send('cloud:remote-load-pending', {
                            gym_id: receivedGymId,
                            timestamp: payload.new.created_at,
                            load_id: payload.new.id,
                        });
                    }
                }
            );

        channel.subscribe((status, err) => {
            console.log(`📡 [CLOUD_SYNC] Realtime channel status: ${status}`, err || '');
            if (status === 'SUBSCRIBED') {
                this.activeChannels.add(gymId);
                this._realtimeRetryCount = 0; // Reset backoff on success
                console.log('✅ [CLOUD_SYNC] Realtime SUBSCRIBED for gym:', gymId);
            } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                console.error(`❌ [CLOUD_SYNC] Realtime ${status}:`, err || '');
                // Clean up the zombie channel so it doesn't leak
                try { channel.unsubscribe(); } catch (_) {}
                this.activeChannels.delete(gymId);
                // Schedule retry with exponential backoff (30s, 60s, 120s, max 5min)
                this._scheduleRealtimeRetry(gymId);
            } else if (status === 'CLOSED') {
                console.warn('⚠️ [CLOUD_SYNC] Realtime channel CLOSED');
                this.activeChannels.delete(gymId);
            }
        });

        // ── Realtime: bookings (reservas desde móvil) ──────────────────────
        const bookingsChannel = this.supabase
            .channel(`bookings_${gymId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'gym_class_bookings',
                    filter: `gym_id=eq.${gymId}`,
                },
                (payload) => {
                    const eventType = payload.eventType;
                    const booking = payload.new;
                    console.log(`📅 [BOOKINGS] Realtime ${eventType}: schedule=${booking.schedule_id} status=${booking.status}`);

                    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

                    this.mainWindow.webContents.send('bookings:updated', {
                        eventType,
                        booking,
                        timestamp: Date.now(),
                    });
                }
            );

        bookingsChannel.subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ [BOOKINGS] Realtime SUBSCRIBED for gym:', gymId);
            } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                console.warn(`⚠️ [BOOKINGS] Realtime ${status}:`, err || '');
                // Clean up zombie bookings channel
                try { bookingsChannel.unsubscribe(); } catch (_) {}
            }
        });
    }

    /**
     * Schedule a Realtime reconnection with exponential backoff.
     * Delays: 30s → 60s → 120s → 300s (cap)
     */
    _scheduleRealtimeRetry(gymId) {
        if (this._realtimeBackoffTimer) {
            clearTimeout(this._realtimeBackoffTimer);
        }
        const baseDelay = 30000; // 30 seconds
        const delay = Math.min(baseDelay * Math.pow(2, this._realtimeRetryCount), 300000);
        this._realtimeRetryCount++;
        console.log(`📡 [CLOUD_SYNC] Realtime retry #${this._realtimeRetryCount} in ${delay / 1000}s`);
        this._realtimeBackoffTimer = setTimeout(() => {
            this._realtimeBackoffTimer = null;
            this.setupRealtime(gymId);
        }, delay);
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
            const fileName = `${targetGymId}/sys_backups/${backupId}_gym_manager.db`;
            const ownerStorage = require('./owner-storage.client');
            const res = await ownerStorage.upload(fileName, fileBuffer, 'application/x-sqlite3', { upsert: true });
            if (!res?.success) throw new Error(res?.error || 'upload_failed');
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
            const fileName = `${targetGymId}/sys_backups/${backupId}_template_config.json`;
            const ownerStorage = require('./owner-storage.client');
            const res = await ownerStorage.upload(fileName, fileBuffer, 'application/json', { upsert: true });
            if (!res?.success) throw new Error(res?.error || 'upload_failed');
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
            const fileName = `${targetGymId}/sys_backups/${backupId}_org_template.xlsx`;
            const ownerStorage = require('./owner-storage.client');
            const res = await ownerStorage.upload(
                fileName, fileBuffer,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                { upsert: true }
            );
            if (!res?.success) throw new Error(res?.error || 'upload_failed');
            return fileName;
        } catch (err) {
            console.error('[CLOUD_SYNC] Template Excel Backup Error:', err);
            return null;
        }
    }

    async uploadTrainingFile(gymId, customerId, buffer, fileName) {
        const targetGymId = this._resolveGymId(gymId);
        const year = new Date().getFullYear();
        const filePath = `${targetGymId}/${customerId}/${year}/${fileName}`;
        const ownerStorage = require('./owner-storage.client');
        const upRes = await ownerStorage.upload(
            filePath, buffer,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            { upsert: true }
        );
        if (!upRes?.success) {
            console.error('Storage Upload Error:', upRes?.error);
            throw new Error(upRes?.error || 'upload_failed');
        }
        const urlRes = await ownerStorage.getPublicUrl(filePath);
        return urlRes?.success ? urlRes.url : null;
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
        if (!gymId) return;

        try {
            const ownerStorage = require('./owner-storage.client');
            const ownerData = require('./owner-data.client');

            // 1. STORAGE-BASED CHECK (legacy: full DB)
            const listRes = await ownerStorage.list(`${gymId}/remote_load/`);
            if (listRes?.success) {
                const items = listRes.items || [];
                const remoteFile = items.find(file => file.name === 'gym_manager.db');
                if (remoteFile && this.mainWindow) {
                    const fileTimestamp = remoteFile.updated_at || remoteFile.created_at;
                    if (fileTimestamp !== this._lastRemoteLoadTimestamp) {
                        console.log('📡 [CLOUD_SYNC] Remote DB load detected for gym:', gymId);
                        this.mainWindow.webContents.send('cloud:remote-load-pending', {
                            gym_id: gymId,
                            timestamp: fileTimestamp || new Date().toISOString()
                        });
                        this._lastRemoteLoadTimestamp = fileTimestamp;
                    }
                } else {
                    this._lastRemoteLoadTimestamp = null;
                }
            }

            // 2. TABLE-BASED CHECK (Phase 2 fallback when Realtime fails)
            // Look for any pending rows for this gym (exercise_dataset, customer_dataset, etc.)
            const selRes = await ownerData.select('cloud_remote_loads', {
                gymId,
                columns: 'id, gym_id, payload_type, payload_path, created_at',
                filters: { status: 'pending' },
            });
            if (!selRes?.success) return;
            const pendingRows = selRes.rows || [];

            this._notifiedLoadIds = this._notifiedLoadIds || new Set();
            for (const row of pendingRows) {
                if (this._notifiedLoadIds.has(row.id)) continue;
                if (!this.mainWindow) continue;

                const eventName = row.payload_type === 'exercise_dataset' ? 'cloud:exercise-dataset-pending'
                    : row.payload_type === 'customer_dataset' ? 'cloud:customer-dataset-pending'
                    : null;
                if (!eventName) continue; // full_db ya manejado vía storage check arriba

                console.log(`📡 [CLOUD_SYNC] Polling fallback fired ${row.payload_type} for ${gymId}`);
                this.mainWindow.webContents.send(eventName, {
                    gym_id: row.gym_id,
                    load_id: row.id,
                    payload_path: row.payload_path,
                    timestamp: row.created_at,
                });
                this._notifiedLoadIds.add(row.id);
            }
        } catch (e) {
            console.error('[CLOUD_SYNC] checkRemoteLoad Error:', e);
        }
    }

    /**
     * Pull client-submitted profile data (medical + personal) from
     * customer_profile_submissions, apply each to the local customer record
     * (which re-syncs to cloud_customers), and stamp applied_at. Auto-apply:
     * no owner action needed. The owner can still edit afterwards in the desktop.
     */
    async applyProfileSubmissions(gymId) {
        if (!gymId) return;
        try {
            const ownerData = require('./owner-data.client');
            const res = await ownerData.select('customer_profile_submissions', {
                gymId,
                filters: { applied_at: { op: 'is', value: null } },
            });
            if (!res?.success) return;
            const pending = res.rows || res.data || [];
            if (!pending.length) return;

            const customerService = require('../local/customer.service');
            for (const sub of pending) {
                try {
                    const update = {};
                    if (sub.phone != null) update.phone = String(sub.phone);
                    if (sub.dni != null) update.dni = String(sub.dni);
                    if (sub.address != null) update.address = String(sub.address);
                    if (sub.height_cm != null) update.height_cm = Number(sub.height_cm);
                    if (sub.weight_kg != null) update.weight_kg = Number(sub.weight_kg);
                    if (sub.birth_date != null) update.birth_date = String(sub.birth_date);
                    if (sub.medical_info != null && typeof sub.medical_info === 'object') {
                        // Normalize to the {diseases,injuries,allergies,surgeries} shape
                        update.medical_info = {
                            diseases: sub.medical_info.diseases || '',
                            injuries: sub.medical_info.injuries || '',
                            allergies: sub.medical_info.allergies || '',
                            surgeries: sub.medical_info.surgeries || '',
                        };
                    }

                    if (Object.keys(update).length > 0) {
                        customerService.update(sub.customer_local_id, update);
                    }

                    // Mark this submission as applied so we don't re-apply it.
                    await ownerData.update('customer_profile_submissions',
                        { applied_at: new Date().toISOString() },
                        { gymId, filters: { id: sub.id } });

                    // Tell the renderer to refresh the customer if it's open.
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('customer:profile-updated', {
                            customer_local_id: sub.customer_local_id,
                        });
                    }
                    console.log(`[PROFILE] ✅ Applied client submission for customer #${sub.customer_local_id}`);
                } catch (e) {
                    console.error(`[PROFILE] Failed applying submission ${sub.id}:`, e.message);
                }
            }
        } catch (e) {
            console.error('[PROFILE] applyProfileSubmissions error:', e.message);
        }
    }

    async applyRemoteLoad(gymId, loadId = null) {
        if (!gymId) throw new Error('Cargador no inicializado.');

        const ownerStorage = require('./owner-storage.client');
        const ownerData = require('./owner-data.client');
        const remotePath = `${gymId}/remote_load/gym_manager.db`;

        try {
            // 1. Download the Database (presigned URL)
            const dlRes = await ownerStorage.download(remotePath);
            if (!dlRes?.success) throw new Error(dlRes?.error || 'download_failed');

            // 2. Save temporarily to disk — owner-storage already returns a Buffer
            const tempPath = path.join(app.getPath('temp'), `remote_load_${Date.now()}.db`);
            fs.writeFileSync(tempPath, dlRes.data);

            // 3. Import DB
            const importRes = await this.importDatabase(tempPath);
            if (!importRes.success) throw new Error(importRes.error);

            // 4. Cleanup DB from cloud
            await ownerStorage.remove([remotePath]);

            // 5. Restore Templates (Priority: Remote Load staging -> Fallback: Sys Backups)
            await this._restoreTemplateFiles(gymId);

            // 6. Update status in tracking table
            if (loadId) {
                await ownerData.upsert('cloud_remote_loads',
                    [{ id: loadId, status: 'applied', applied_at: new Date().toISOString() }],
                    { onConflict: 'id' });
            } else {
                // Mark every pending row for this gym as applied
                const pendingRes = await ownerData.select('cloud_remote_loads', {
                    gymId,
                    columns: 'id',
                    filters: { status: 'pending' },
                });
                const ids = (pendingRes?.rows || []).map(r => r.id);
                if (ids.length) {
                    const rows = ids.map(id => ({ id, status: 'applied', applied_at: new Date().toISOString() }));
                    await ownerData.upsert('cloud_remote_loads', rows, { onConflict: 'id' });
                }
            }

            // 7. Cleanup temp file
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            return { success: true };
        } catch (err) {
            console.error('[CLOUD_SYNC] applyRemoteLoad Error:', err);
            if (loadId) {
                await ownerData.upsert('cloud_remote_loads',
                    [{ id: loadId, status: 'failed', error: err.message }],
                    { onConflict: 'id' });
            }
            throw err;
        }
    }

    /**
     * Sube un dataset JSON al storage de Supabase y registra una entrada en
     * cloud_remote_loads con el payload_type correspondiente. El gimnasio
     * receptor recibirá un evento Realtime y mostrará una notificación.
     *
     * @param {'exercise_dataset'|'customer_dataset'} kind
     * @param {string} targetGymId
     * @param {object} datasetJson
     */
    async pushDatasetToGym(kind, targetGymId, datasetJson) {
        if (!targetGymId) throw new Error('targetGymId requerido');
        if (!datasetJson) throw new Error('dataset requerido');
        if (!['exercise_dataset', 'customer_dataset'].includes(kind)) {
            throw new Error('Tipo de dataset inválido: ' + kind);
        }

        const ownerStorage = require('./owner-storage.client');
        const ownerData = require('./owner-data.client');

        const folder = kind === 'exercise_dataset' ? 'exercise_dataset' : 'customer_dataset';
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const remotePath = `${targetGymId}/${folder}/${ts}.json`;
        const body = Buffer.from(JSON.stringify(datasetJson, null, 2), 'utf-8');

        // 1. Upload JSON to storage (presigned)
        const upRes = await ownerStorage.upload(remotePath, body, 'application/json', { upsert: false });
        if (!upRes?.success) throw new Error('Error subiendo dataset: ' + (upRes?.error || 'upload_failed'));

        // 2. Register in cloud_remote_loads (triggers Realtime push to receiver)
        const dbRes = await ownerData.upsert('cloud_remote_loads', [{
            gym_id: targetGymId,
            status: 'pending',
            payload_type: kind,
            payload_path: remotePath,
            created_at: new Date().toISOString(),
        }]);
        if (!dbRes?.success) throw new Error('Error registrando push: ' + (dbRes?.error || 'insert_failed'));

        return { success: true, path: remotePath };
    }

    /**
     * Descarga un JSON de dataset desde Supabase Storage y lo aplica localmente
     * vía el service correspondiente (additivo, no destructivo).
     */
    async _applyDataset(kind, payloadPath, loadId) {
        if (!payloadPath) throw new Error('payload_path requerido');

        const ownerStorage = require('./owner-storage.client');
        const ownerData = require('./owner-data.client');

        const dlRes = await ownerStorage.download(payloadPath);
        if (!dlRes?.success) throw new Error('Error descargando dataset: ' + (dlRes?.error || 'download_failed'));

        const text = dlRes.data.toString('utf-8');
        const dataset = JSON.parse(text);

        let stats;
        if (kind === 'exercise_dataset') {
            const trainingService = require('../local/training.service');
            stats = trainingService.importDataset(dataset);
        } else if (kind === 'customer_dataset') {
            const customerService = require('../local/customer.service');
            stats = customerService.importDataset(dataset);
        } else {
            throw new Error('Tipo de dataset inválido: ' + kind);
        }

        // Marcar como aplicado y limpiar el archivo del storage
        if (loadId) {
            await ownerData.upsert('cloud_remote_loads',
                [{ id: loadId, status: 'applied', applied_at: new Date().toISOString() }],
                { onConflict: 'id' });
        }
        try { await ownerStorage.remove([payloadPath]); }
        catch (e) { console.warn('[CLOUD_SYNC] No se pudo borrar storage:', e.message); }

        return stats;
    }

    async applyExerciseDataset(gymId, loadId, payloadPath) {
        return this._applyDataset('exercise_dataset', payloadPath, loadId);
    }
    async applyCustomerDataset(gymId, loadId, payloadPath) {
        return this._applyDataset('customer_dataset', payloadPath, loadId);
    }

    async sendCustomersToGym(targetGymId, customerIds) {
        if (!targetGymId || !customerIds?.length) throw new Error('Gym ID y clientes requeridos');

        const customerService = require('../local/customer.service');
        const customers = customerService.getByIds(customerIds);

        if (customers.length === 0) throw new Error('No se encontraron clientes');

        // Upsert into cloud_customers for the TARGET gym
        const records = customers.map(c => {
            let medicalInfo = null;
            if (c.medical_info) {
                try { medicalInfo = typeof c.medical_info === 'string' ? JSON.parse(c.medical_info) : c.medical_info; } catch (e) { /* ignore */ }
            }

            return {
                gym_id: targetGymId,
                local_id: c.id,
                first_name: c.first_name,
                last_name: c.last_name,
                email: c.email,
                phone: c.phone,
                active: c.active,
                tariff_id: c.tariff_id,
                dni: c.dni,
                address: c.address,
                height_cm: c.height_cm,
                weight_kg: c.weight_kg,
                birth_date: c.birth_date,
                medical_info: medicalInfo,
                created_at: c.created_at,
                synced_at: new Date().toISOString(),
            };
        });

        const ownerData = require('./owner-data.client');
        const res = await ownerData.upsert('cloud_customers', records, {
            onConflict: 'gym_id,local_id',
            gymId: targetGymId,
        });
        if (!res?.success) throw new Error(`Error enviando clientes: ${res?.error || 'upsert_failed'}`);

        console.log(`[CLOUD_SYNC] Sent ${records.length} customers to gym ${targetGymId}`);
        return { success: true, sent: records.length };
    }

    async _restoreTemplateFiles(gymId) {
        try {
            console.log(`[CLOUD_SYNC] Restore Templates for gym: ${gymId}`);
            const ownerStorage = require('./owner-storage.client');
            const userDataPath = app.getPath('userData');
            const targetDir = path.join(userDataPath, 'templates', gymId);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            // STRATEGY A: Check for explicitly pushed templates in remote_load/ (Exact Restore)
            const filesToCheck = ['template_config.json', 'org_template.xlsx'];
            let restoredCount = 0;

            for (const file of filesToCheck) {
                const remotePath = `${gymId}/remote_load/${file}`;
                const dlRes = await ownerStorage.download(remotePath);
                if (dlRes?.success && dlRes.data) {
                    console.log(`[CLOUD_SYNC] ✅ Found EXACT MATCH restore for ${file}`);
                    fs.writeFileSync(path.join(targetDir, file), dlRes.data);
                    // Cleanup remote staging
                    await ownerStorage.remove([remotePath]);
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
                const listRes = await ownerStorage.list(`${gymId}/sys_backups`, {
                    limit: 100,
                    sortBy: { column: 'name', order: 'desc' },
                });
                if (!listRes?.success) return;
                const files = listRes.items || [];

                const latestConfig = files.find(f => f.name.startsWith('template_config_'));
                const latestExcel = files.find(f => f.name.startsWith('org_template_'));

                // Only download if we didn't already restore the exact one
                if (latestConfig && !fs.existsSync(path.join(targetDir, 'template_config.json'))) {
                    console.log('[CLOUD_SYNC] Downloading latest template_config (fallback)...');
                    const dl = await ownerStorage.download(`${gymId}/sys_backups/${latestConfig.name}`);
                    if (dl?.success && dl.data) fs.writeFileSync(path.join(targetDir, 'template_config.json'), dl.data);
                }

                if (latestExcel && !fs.existsSync(path.join(targetDir, 'org_template.xlsx'))) {
                    console.log('[CLOUD_SYNC] Downloading latest org_template (fallback)...');
                    const dl = await ownerStorage.download(`${gymId}/sys_backups/${latestExcel.name}`);
                    if (dl?.success && dl.data) fs.writeFileSync(path.join(targetDir, 'org_template.xlsx'), dl.data);
                }
            }

        } catch (err) {
            console.error('[CLOUD_SYNC] Template Restoration failed:', err);
        }
    }

    // ─── OWNER-ADMIN EDGE FUNCTION CLIENT ───────────────────────────────────────
    //
    // All admin operations (invite/reset/revoke/etc) used to call
    // supabase.auth.admin.* directly with the service_role key bundled in the
    // installer. That key gave anyone with the .exe full backend access. The
    // operations now route through the owner-admin Edge Function, which we
    // authenticate with the per-gym `owner_token` stored encrypted by the
    // license service (hardware-bound electron-store).

    async _callOwnerAdmin(op, args) {
        if (!this.credentials?.supabase?.url) {
            return { success: false, error: 'Supabase no configurado' };
        }
        const licenseService = require('../local/license.service');
        const token = licenseService.getOwnerToken();
        if (!token) {
            return {
                success: false,
                error: 'Sesión de propietario no disponible. Vuelve a iniciar sesión o conéctate a internet para renovar la licencia.'
            };
        }
        const url = `${this.credentials.supabase.url}/functions/v1/owner-admin`;
        try {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 15000);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ op, args }),
                signal: ctrl.signal,
            });
            clearTimeout(timeoutId);
            let body = null;
            try { body = await res.json(); } catch { /* non-json */ }
            if (!res.ok) {
                return {
                    success: false,
                    error: body?.error || `Error ${res.status} al llamar a owner-admin`,
                    status: res.status,
                };
            }
            return body || { success: true };
        } catch (err) {
            return {
                success: false,
                error: err.name === 'AbortError'
                    ? 'Timeout llamando a owner-admin (15s)'
                    : `Error de red: ${err.message}`,
            };
        }
    }

    // ─── MOBILE CLIENT INVITATION ───────────────────────────────────────────────

    /**
     * Invite a gym client to the mobile app. Routes through the owner-admin
     * Edge Function — no service_role key on this side.
     *
     * @param {string} gymId - The gym identifier
     * @param {number} customerId - Local customer ID
     * @param {string} email - Customer's email address
     * @returns {{ success: boolean, message: string }}
     */
    async inviteToMobile(gymId, customerId, email /*, customerName = '' */) {
        if (!email) return { success: false, error: 'El cliente necesita un email para recibir la invitación' };
        return await this._callOwnerAdmin('inviteToMobile', {
            gym_id: this._resolveGymId(gymId),
            customer_local_id: customerId,
            email,
        });
    }

    /**
     * Fetch weight logs that a client has recorded from the mobile app.
     * Routes through the owner-admin Edge Function.
     */
    async getCustomerWeightLogs(gymId, customerLocalId) {
        const resolvedGymId = this._resolveGymId(gymId);
        if (!resolvedGymId) return { success: false, error: 'Gym ID no resuelto', data: [] };
        const res = await this._callOwnerAdmin('getCustomerWeightLogs', {
            gym_id: resolvedGymId,
            customer_local_id: customerLocalId,
        });
        // The Edge Function returns { success, data: [...] }. Normalize so
        // callers that expect `data: []` always get an array even on error.
        if (!res?.success) return { success: false, error: res?.error || 'Error', data: [] };
        return { success: true, data: Array.isArray(res.data) ? res.data : [] };
    }

    /**
     * Check whether a customer has registered in the mobile app.
     * Returns { registered: boolean, invited: boolean, linked_at, invited_at, email }.
     * - registered: TRUE if mobile_client_links has auth_user_id (user signed in)
     * - invited: TRUE if there is a pending invite (row without auth_user_id)
     */
    async getCustomerMobileStatus(gymId, customerLocalId) {
        const resolvedGymId = this._resolveGymId(gymId);
        if (!resolvedGymId) return { success: false, error: 'Gym ID no resuelto', registered: false };
        const res = await this._callOwnerAdmin('getCustomerMobileStatus', {
            gym_id: resolvedGymId,
            customer_local_id: customerLocalId,
        });
        if (!res?.success) return { success: false, error: res?.error || 'Error', registered: false };
        // Edge Function returns the same shape we used to return inline.
        return res;
    }

    /**
     * Bulk fetch: returns an array of customer_local_id values that have
     * an ACTIVE mobile_client_links row (linked + pending). Routes through
     * the owner-admin Edge Function.
     */
    async getMobileLinkedCustomers(gymId) {
        const resolvedGymId = this._resolveGymId(gymId);
        if (!resolvedGymId) return { success: false, error: 'Gym ID no resuelto', data: { linked: [], pending: [] } };
        const res = await this._callOwnerAdmin('getMobileLinkedCustomers', { gym_id: resolvedGymId });
        if (!res?.success) return { success: false, error: res?.error || 'Error', data: { linked: [], pending: [] } };
        const data = res.data || { linked: [], pending: [] };
        return { success: true, data };
    }

    /**
     * Send a password-reset email to the customer's mobile-app account.
     * Only valid if the customer is already linked (auth_user_id present).
     * @param {string} gymId
     * @param {number} customerLocalId
     * @returns {{ success: boolean, message?: string, error?: string }}
     */
    async resetMobilePassword(gymId, customerLocalId) {
        const resolvedGymId = this._resolveGymId(gymId);
        if (!resolvedGymId) return { success: false, error: 'Gym ID no resuelto' };
        return await this._callOwnerAdmin('resetMobilePassword', {
            gym_id: resolvedGymId,
            customer_local_id: customerLocalId,
        });
    }

    /**
     * Revoke a customer's access to the mobile app for THIS gym.
     * Routes through the owner-admin Edge Function.
     */
    async revokeMobileAccess(gymId, customerLocalId) {
        const resolvedGymId = this._resolveGymId(gymId);
        if (!resolvedGymId) return { success: false, error: 'Gym ID no resuelto' };
        return await this._callOwnerAdmin('revokeMobileAccess', {
            gym_id: resolvedGymId,
            customer_local_id: customerLocalId,
        });
    }

    /**
     * Get the publishable (anon) key configuration for the mobile app.
     * The admin can use this to configure the mobile app or generate a QR code.
     */
    getPublishableConfig() {
        if (!this.credentials?.supabase) throw new Error('Supabase no configurado');
        return {
            url: this.credentials.supabase.url,
            // Note: The service_role key is used by the desktop app.
            // The mobile app needs the anon/publishable key which must be
            // configured separately in the Supabase dashboard.
            // This method returns the URL so the admin knows which project to configure.
        };
    }
}

module.exports = new CloudService();
