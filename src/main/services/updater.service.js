const { autoUpdater } = require("electron-updater");
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto-downloading initially to give user choice (optional, but good UX)
autoUpdater.autoDownload = false;

function initUpdater(mainWindow) {
    log.info('App starting...');

    // Event Listeners
    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
        mainWindow.webContents.send('updater:status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available.', info);
        mainWindow.webContents.send('updater:status', { status: 'available', info });
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available.', info);
        mainWindow.webContents.send('updater:status', { status: 'up-to-date', info });
    });

    autoUpdater.on('error', (err) => {
        log.info('Error in auto-updater. ' + err);
        mainWindow.webContents.send('updater:status', { status: 'error', error: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        log.info(log_message);

        mainWindow.webContents.send('updater:status', {
            status: 'downloading',
            progress: progressObj.percent
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded');
        mainWindow.webContents.send('updater:status', { status: 'downloaded', info });
    });

    // Handle check update triggers
    // You might call this from IPC too
}

module.exports = {
    autoUpdater,
    initUpdater
};
