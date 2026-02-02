// CRITICAL: Load .env BEFORE any other requires
// This must happen first to ensure Google OAuth credentials are available
const path = require('path');
const fs = require('fs');

// Determine environment path
// In development: .env is in project root (../../.env from src/main/main.js)
// In production: .env is copied to process.resourcesPath by electron-builder
let envPath;
const devEnvPath = path.join(__dirname, '../../.env');

// Check if we're running from ASAR (production)
if (__dirname.includes('app.asar')) {
    // Production: Use process.resourcesPath which points to the resources folder
    // This is where electron-builder copies extraResources
    envPath = path.join(process.resourcesPath, '.env');
    console.log('🏭 PRODUCTION MODE DETECTED');
    console.log('📁 Resources path:', process.resourcesPath);
} else {
    // Development: .env is in project root
    envPath = devEnvPath;
    console.log('🛠️ DEVELOPMENT MODE DETECTED');
}

// Load environment variables
require('dotenv').config({ path: envPath });

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

// Validate critical environment variables
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Environment loaded from:', envPath);
console.log('📁 File exists:', fs.existsSync(envPath) ? '✅' : '❌');
console.log('🔑 GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ LOADED' : '❌ MISSING');
console.log('🔐 GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ LOADED' : '❌ MISSING');
console.log('☁️ SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ LOADED' : '❌ MISSING');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const { app, BrowserWindow } = require('electron');

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

        // TEMPORARY: Enable DevTools in production for debugging
        mainWindow.webContents.openDevTools();
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    const licenseService = require('./services/local/license.service');
    const { ipcMain } = require('electron');

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
        cloudService.setMainWindow(mainWindow);

        // 4. Initialize Updater (Only if supported)
        const { initUpdater, autoUpdater } = require('./services/local/updater.service');
        initUpdater(mainWindow);

        // 5. App Version Update Check
        const runUpdateCheck = () => {
            if (app.isPackaged) {
                autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('Update check failed:', err));
            } else {
                console.log('📡 [Updater] Update check skipped in Development mode.');
            }
        };

        // 6. Remote Database Load Check (Realtime & Polling)
        const runRemoteLoadCheck = () => {
            const lic = licenseService.getLicenseData();
            if (lic) {
                console.log('📡 [Main] Checking for remote loads for gym:', lic.gym_id);
                // Ensure Realtime is active
                cloudService.setupRealtime(lic.gym_id);
                // Manual Polling Fallback (Every 30m)
                cloudService.checkRemoteLoad(lic.gym_id);
            }
        };

        setTimeout(() => {
            runUpdateCheck();
            runRemoteLoadCheck();
        }, 5000);

        // 7. Lease Renewal (Offline Protection)
        const runLeaseRenewal = async () => {
            const renewed = await licenseService.renewLease();
            if (renewed) console.log('✅ [Main] License Lease Renewed successfully.');
        };
        // Initial renewal check
        setTimeout(runLeaseRenewal, 10000);

        // Background intervals
        setInterval(runUpdateCheck, 30 * 60 * 1000);
        setInterval(runRemoteLoadCheck, 30 * 60 * 1000);
        setInterval(runLeaseRenewal, 60 * 60 * 1000); // Check every hour
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
                preload: path.join(__dirname, '../preload/activation.js') // Use specific preload
            },
            icon: path.join(__dirname, '../../resources/icon.png'),
            backgroundColor: '#0f172a'
        });

        win.loadFile(path.join(__dirname, '../renderer/activation.html'));
    }

    // Register Updater IPC (Moved here to ensure availability)
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
