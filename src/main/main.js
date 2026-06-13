// CRITICAL: Initialize secure credential system FIRST
const path = require('path');
const fs = require('fs');

console.log('🔐 Initializing Secure Credential Manager...');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGGING CONFIGURATION - Redirect ALL console output to file
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const log = require('electron-log');

// Configure log file location
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// Override console methods to use electron-log
console.log = log.log.bind(log);
console.info = log.info.bind(log);
console.warn = log.warn.bind(log);
console.error = log.error.bind(log);
console.debug = log.debug.bind(log);

// Catch-all for unhandled rejections to help debugging
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 LOGGING CONFIGURED');
console.log('📁 Log file location:', log.transports.file.getFile().path);
console.log('💡 To view logs, open this file in a text editor');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const { app, BrowserWindow } = require('electron');

// Initialize secure credential manager AFTER electron app is loaded
const credentialManager = require('./config/credentials');
const credentialsLoaded = credentialManager.init();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔐 SECURE CREDENTIALS STATUS');
if (credentialsLoaded) {
    const creds = credentialManager.get();
    console.log('✅ Credentials loaded successfully');
    console.log('☁️ Supabase:', creds.supabase?.url ? '✅ Configured' : '❌ Missing');
    console.log('🔑 Google OAuth:', creds.google?.clientId ? '✅ Configured' : 'ℹ️ Optional (not configured)');
    console.log('🐙 GitHub Token:', creds.github?.token ? '✅ Configured' : 'ℹ️ Optional (not configured)');
} else {
    console.warn('⚠️ Credentials not loaded - App may have limited functionality');
    console.warn('ℹ️ See documentation for credential configuration');
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const dbManager = require('./db/database');
const { registerHandlers } = require('./ipc/handlers');

// Force restart timestamp: 2026-01-26 10:45 (Service Fix)
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;

function createWindow() {
    const preloadPath = path.resolve(__dirname, '../preload/index.js');
    console.log('Main Process: Loading Preload from:', preloadPath);

    if (!fs.existsSync(preloadPath)) {
        console.error('CRITICAL: Preload script not found at:', preloadPath);
    }

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        backgroundColor: '#0f172a',
        frame: false, // Custom titlebar
        show: false, // Wait until ready-to-show
        icon: path.join(__dirname, '../../resources/icon.png'), // Icon for prod
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Required for some native modules
            webSecurity: true
        }
    });

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // PRODUCTION DEBUGGING
        const appPath = app.getAppPath();
        const distIndex = path.join(appPath, 'dist/index.html');

        console.log('--- DEBUG INFO ---');
        console.log('App Path (ASAR root):', appPath);
        console.log('Target Index:', distIndex);

        try {
            // Verify if dist exists
            const distPath = path.join(appPath, 'dist');
            if (fs.existsSync(distPath)) {
                console.log('Contents of dist:', fs.readdirSync(distPath));
            } else {
                console.error('CRITICAL: dist folder NOT found in ASAR at', distPath);
                // Fallback: List root of ASAR to see what IS there
                console.log('Contents of ASAR root:', fs.readdirSync(appPath));
            }
        } catch (e) {
            console.error('FS Error:', e);
        }
        console.log('------------------');

        mainWindow.loadFile(distIndex).catch(e => {
            console.error('FAILED to load index.html:', e);
        });
    }

    mainWindow.once('ready-to-show', () => {
        // Reset zoom on every launch so users never get stuck with a tiny UI
        // (e.g. after accidentally pressing Ctrl+- multiple times)
        try {
            mainWindow.webContents.setZoomFactor(1.0);
            mainWindow.webContents.setZoomLevel(0);
        } catch (_) { /* noop */ }
        mainWindow.show();
    });

    // Reset zoom whenever the page reloads/navigates
    mainWindow.webContents.on('did-finish-load', () => {
        try {
            // Only reset if zoom is extremely off (user might have set it intentionally)
            const currentLevel = mainWindow.webContents.getZoomLevel();
            if (Math.abs(currentLevel) > 5) {
                mainWindow.webContents.setZoomLevel(0);
            }
        } catch (_) { /* noop */ }
    });

    // Global keyboard shortcuts for zoom — handle them in main process
    // because some keyboards/Electron versions ignore the default Ctrl++ binding
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!input.control && !input.meta) return;
        // Ctrl/Cmd + 0 → reset to 100%
        if (input.key === '0') {
            mainWindow.webContents.setZoomLevel(0);
            event.preventDefault();
        }
        // Ctrl/Cmd + Plus (or shift+plus on layouts requiring shift)
        else if (input.key === '+' || input.key === '=') {
            const current = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(Math.min(current + 0.5, 5));
            event.preventDefault();
        }
        // Ctrl/Cmd + Minus
        else if (input.key === '-') {
            const current = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(Math.max(current - 0.5, -3));
            event.preventDefault();
        }
    });

    // Notify renderer when maximize state changes
    mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-changed', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-changed', false));
}

app.whenReady().then(() => {
    const licenseService = require('./services/local/license.service');
    const { ipcMain } = require('electron');

    // 0. Window Control Handlers (custom titlebar)
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
    });
    ipcMain.on('window:close', () => mainWindow?.close());
    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

    // 1. Initialize Licenser Handlers
    ipcMain.handle('license:activate', async (event, key) => {
        const result = await licenseService.activate(key);
        // If successful, close activation window and open main window
        const activationWin = BrowserWindow.fromWebContents(event.sender);
        if (activationWin) activationWin.close();

        // CRITICAL FIX: Must call startApp() to register handlers, NOT createWindow() directly
        startApp();

        return result;
    });

    ipcMain.handle('license:getData', () => licenseService.getLicenseData());

    ipcMain.handle('license:getHardwareId', () => licenseService.hardwareId);

    // Register Updater IPC EARLY (before any window loads to avoid race condition)
    ipcMain.handle('updater:getVersion', () => app.getVersion());
    ipcMain.handle('updater:check', () => {
        const { autoUpdater } = require('./services/local/updater.service');
        return autoUpdater.checkForUpdates();
    });
    ipcMain.handle('updater:download', () => {
        const { autoUpdater } = require('./services/local/updater.service');
        return autoUpdater.downloadUpdate();
    });
    ipcMain.handle('updater:install', () => {
        const { autoUpdater } = require('./services/local/updater.service');
        return autoUpdater.quitAndInstall();
    });

    // 2. Check License
    if (licenseService.isAuthenticated()) {
        console.log('✅ License Verified. Starting App...');
        startApp();
    } else {
        console.log('🔒 License Required. Opening Activation Window...');
        createActivationWindow();
    }

    function startApp() {
        // 1. Initialize DB
        try {
            console.log('Initializing Database...');
            dbManager.init();
            console.log('Database initialized successfully.');
        } catch (err) {
            console.error('Failed to initialize database:', err);
            return; // STOP initialization if DB is fundamentally broken
        }

        // 2. Register IPC Handlers
        registerHandlers();

        // 3. Create Window
        createWindow();

        // 4. Initialize Updater
        // Initialize Services (Dev & Prod)
        const cloudService = require('./services/cloud/cloud.service');
        const licenseService = require('./services/local/license.service');
        const syncService = require('./services/cloud/sync.service');
        cloudService.setMainWindow(mainWindow);
        syncService.setMainWindow(mainWindow);

        // 4. Initialize Updater (Only if supported)
        const { initUpdater, autoUpdater } = require('./services/local/updater.service');
        initUpdater(mainWindow);

        // 5. App Version Update Check
        const runUpdateCheck = () => {
            // Allow checking in Dev to test notifications
            console.log('📡 [Updater] Checking for updates...');
            autoUpdater.checkForUpdatesAndNotify().catch(err => {
                console.warn('📡 [Updater] Check failed (Common in Dev if not configured):', err.message);
            });
        };

        // 6. Remote Database Load Check (Polling + Realtime attempt)
        // Realtime is set up ONCE; if it fails, it retries with its own backoff.
        // The polling interval only runs checkRemoteLoad (lightweight HTTP check).
        const initRealtime = () => {
            const lic = licenseService.getLicenseData();
            if (lic) cloudService.setupRealtime(lic.gym_id);
        };
        const runRemoteLoadCheck = () => {
            const lic = licenseService.getLicenseData();
            if (lic) cloudService.checkRemoteLoad(lic.gym_id);
        };
        const runProfileSubmissionsCheck = () => {
            const lic = licenseService.getLicenseData();
            if (lic) cloudService.applyProfileSubmissions(lic.gym_id);
        };

        setTimeout(() => {
            runUpdateCheck();
            initRealtime();       // One-time Realtime setup (self-retries on failure)
            runRemoteLoadCheck();  // First poll
            runProfileSubmissionsCheck(); // Pull client profile edits
        }, 5000);

        // 7. Lease Renewal (Offline Protection) + presence heartbeat.
        // Each renewLease() call also stamps licenses.last_seen in the cloud
        // (via the license-ops Edge Function), which powers the master panel's
        // real online/last-connection status. Running it periodically keeps
        // last_seen fresh while the app stays open.
        const runLeaseRenewal = async () => {
            const renewed = await licenseService.renewLease();
            if (renewed) console.log('✅ [Main] License Lease Renewed successfully.');
        };
        // Initial renewal check
        setTimeout(runLeaseRenewal, 10000);
        // Recurring heartbeat every 10 minutes
        setInterval(runLeaseRenewal, 10 * 60 * 1000);

        // 8. Background Cloud Sync (Push local changes to Supabase)
        const runCloudSync = () => {
            syncService.runFullSync().catch(err => {
                console.warn('[Main] Cloud sync failed:', err.message);
            });
        };
        // Initial sync after 8s (let app fully load first)
        setTimeout(runCloudSync, 8000);

        // 9. Bookings Poll — fetch reservas from Supabase every 30s and notify renderer
        let _lastBookingsHash = '';
        const pollBookings = async () => {
            try {
                const classService = require('./services/local/class.service');
                const today = new Date();
                const endDate = new Date(today);
                endDate.setDate(today.getDate() + 7);
                const startStr = today.toISOString().split('T')[0];
                const endStr = endDate.toISOString().split('T')[0];

                const bookings = await classService.getBookingsForWeek(startStr, endStr);
                const hash = JSON.stringify(bookings.map(b => `${b.id}:${b.status}`));

                if (hash !== _lastBookingsHash) {
                    _lastBookingsHash = hash;
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('bookings:updated', {
                            eventType: 'poll',
                            bookings,
                            timestamp: Date.now(),
                        });
                        console.log(`📅 [BOOKINGS] Poll: ${bookings.length} reservas activas (cambio detectado)`);
                    }
                }
            } catch (err) {
                // Silent — don't spam logs if Supabase is temporarily unreachable
            }
        };
        // Start polling after 12s, then every 30s
        setTimeout(pollBookings, 12000);

        // Background intervals
        setInterval(runUpdateCheck, 30 * 60 * 1000);
        setInterval(runRemoteLoadCheck, 30 * 1000); // Poll every 30s (lightweight HTTP, no Realtime re-setup)
        setInterval(runProfileSubmissionsCheck, 60 * 1000); // Pull client profile edits every 60s
        setInterval(runLeaseRenewal, 60 * 60 * 1000); // Check every hour
        setInterval(runCloudSync, 2 * 60 * 1000); // Sync to cloud every 2 minutes
        setInterval(pollBookings, 30 * 1000); // Poll bookings every 30 seconds
    }

    function createActivationWindow() {
        const win = new BrowserWindow({
            width: 500,
            height: 600,
            frame: false, // Frameless for custom UI
            resizable: false,
            webPreferences: {
                nodeIntegration: false, // SECURITY: Disable Node Integration
                contextIsolation: true, // SECURITY: Enable Context Isolation
                preload: path.join(__dirname, './preload/activation.js') // Use specific preload
            },
            icon: path.join(__dirname, '../../resources/icon.png'),
            backgroundColor: '#0f172a'
        });

        win.loadFile(path.join(__dirname, '../renderer/activation.html'));
    }

    // NOTE: Updater IPC handlers registered at top of whenReady() to avoid race condition

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (licenseService.isAuthenticated()) createWindow();
            else createActivationWindow();
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
