const { app, BrowserWindow } = require('electron');
// Load environment variables immediately
require('dotenv').config();

const path = require('path');
const fs = require('fs');
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
        width: 1200,
        height: 800,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Important for better-sqlite3
        },
        backgroundColor: '#020617', // Match bg-slate-950
    });

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}

app.whenReady().then(() => {
    // 1. Initialize DB
    try {
        console.log('Initializing Database...');
        dbManager.init();
        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize database:', err);
    }

    // 2. Register IPC Handlers
    registerHandlers();

    // 3. Create Window
    createWindow();

    // 4. Initialize Updater
    const { initUpdater, autoUpdater } = require('./services/updater.service');
    // Wait a bit for window to load
    setTimeout(() => {
        if (mainWindow) initUpdater(mainWindow);

        // Auto-check in dev or prod (usually only prod)
        if (app.isPackaged) {
            autoUpdater.checkForUpdatesAndNotify();
        }
    }, 3000);

    // Register Updater IPC
    const { ipcMain } = require('electron');
    ipcMain.handle('updater:getVersion', () => app.getVersion());
    ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates());
    ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
    ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
