const { contextBridge, ipcRenderer } = require('electron');

// Pass through CLI flag so the activation page can know it's the dev popup.
const isDevTrainerPopup = process.argv.includes('--dev-trainer-mode');
contextBridge.exposeInMainWorld('activationAPI', {
    activate: (key) => ipcRenderer.invoke('license:activate', key),
    getHardwareId: () => ipcRenderer.invoke('license:getHardwareId'),
    trainerSignIn: (email, password, devMode = false) => ipcRenderer.invoke('trainer:signIn', { email, password, devMode }),
    trainerSignInWithGoogle: (devMode = false) => ipcRenderer.invoke('trainer:signInWithGoogle', { devMode }),
    isDevTrainerPopup,
});

window.addEventListener('DOMContentLoaded', () => {
    // Optional: Add any preload DOM manipulation here
});
