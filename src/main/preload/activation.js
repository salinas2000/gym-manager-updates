const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('activationAPI', {
    activate: (key) => ipcRenderer.invoke('license:activate', key),
    getHardwareId: () => ipcRenderer.invoke('license:getHardwareId')
});

window.addEventListener('DOMContentLoaded', () => {
    // Optional: Add any preload DOM manipulation here
});
