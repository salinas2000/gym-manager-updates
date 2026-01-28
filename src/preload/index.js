const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    customers: {
        getAll: () => ipcRenderer.invoke('customers:getAll'),
        create: (data) => ipcRenderer.invoke('customers:create', data),
        update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
        toggleActive: (id, mode) => ipcRenderer.invoke('customers:toggleActive', id, mode),
        getHistory: (id) => ipcRenderer.invoke('customers:getHistory', id),
        delete: (id) => ipcRenderer.invoke('customers:delete', id),
    },
    payments: {
        getByCustomer: (customerId) => ipcRenderer.invoke('payments:getByCustomer', customerId),
        create: (data) => ipcRenderer.invoke('payments:create', data),
        delete: (id) => ipcRenderer.invoke('payments:delete', id),
    },
    tariffs: {
        getAll: () => ipcRenderer.invoke('tariffs:getAll'),
        create: (data) => ipcRenderer.invoke('tariffs:create', data),
        update: (id, data) => ipcRenderer.invoke('tariffs:update', id, data),
        delete: (id) => ipcRenderer.invoke('tariffs:delete', id),
    },
    analytics: {
        getDashboardData: (year) => ipcRenderer.invoke('analytics:getDashboardData', year),
        getAvailableYears: () => ipcRenderer.invoke('analytics:getAvailableYears'),
        getRecentTransactions: (limit) => ipcRenderer.invoke('analytics:getRecentTransactions', limit),
    },
    memberships: {
        update: (id, data) => ipcRenderer.invoke('memberships:update', id, data),
        delete: (id) => ipcRenderer.invoke('memberships:delete', id),
    },
    cloud: {
        backup: (gymId) => ipcRenderer.invoke('cloud:backup', gymId),
        exportLocal: () => ipcRenderer.invoke('cloud:exportLocal'),
        onRemoteLoadPending: (callback) => ipcRenderer.on('cloud:remote-load-pending', (event, data) => callback(data)),
        applyRemoteLoad: (data) => ipcRenderer.invoke('cloud:applyRemoteLoad', data),
    },
    training: {
        getExercises: () => ipcRenderer.invoke('training:getExercises'),
        createExercise: (data) => ipcRenderer.invoke('training:createExercise', data),
        updateExercise: (id, data) => ipcRenderer.invoke('training:updateExercise', id, data),
        deleteExercise: (id) => ipcRenderer.invoke('training:deleteExercise', id),

        // Category Management
        getCategories: () => ipcRenderer.invoke('training:getCategories'),
        createCategory: (data) => ipcRenderer.invoke('training:createCategory', data),
        updateCategory: (id, data) => ipcRenderer.invoke('training:updateCategory', id, data),
        deleteCategory: (id) => ipcRenderer.invoke('training:deleteCategory', id),
        createSubcategory: (data) => ipcRenderer.invoke('training:createSubcategory', data),
        deleteSubcategory: (id) => ipcRenderer.invoke('training:deleteSubcategory', id),
        getMesocycles: (customerId) => ipcRenderer.invoke('training:getMesocycles', customerId),
        getMesocycle: (id) => ipcRenderer.invoke('training:getMesocycle', id),
        getTemplates: (daysFilter) => ipcRenderer.invoke('training:getTemplates', daysFilter),
        checkOverlap: (customerId, startDate, endDate, excludeId) => ipcRenderer.invoke('training:checkOverlap', customerId, startDate, endDate, excludeId),
        saveMesocycle: (data) => ipcRenderer.invoke('training:saveMesocycle', data),
        deleteMesocycle: (id) => ipcRenderer.invoke('training:deleteMesocycle', id),
        exportRoutine: (data) => ipcRenderer.invoke('training:exportRoutine', data),
        validateDriveLink: (mesoId, url) => ipcRenderer.invoke('training:validateDriveLink', mesoId, url),
        uploadToDrive: (mesoId) => ipcRenderer.invoke('training:uploadToDrive', mesoId),
    },
    settings: {
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        update: (data) => ipcRenderer.invoke('settings:update', data),
        verifyPassword: (pwd) => ipcRenderer.invoke('settings:verifyPassword', pwd),
        activate: (key) => ipcRenderer.invoke('settings:activate', key),
    },
    license: {
        activate: (key) => ipcRenderer.invoke('license:activate', key),
        deactivate: () => ipcRenderer.invoke('license:deactivate'),
        getData: () => ipcRenderer.invoke('license:getData'),
        getHardwareId: () => ipcRenderer.invoke('license:getHardwareId'),
        getStatus: () => ipcRenderer.invoke('license:getStatus'),
        reportVersion: (v) => ipcRenderer.invoke('license:reportVersion', v),
    },
    google: {
        startAuth: () => ipcRenderer.invoke('google:startAuth'),
        getStatus: () => ipcRenderer.invoke('google:getStatus'),
        signOut: () => ipcRenderer.invoke('google:signOut'),
    },
    updater: {
        getVersion: () => ipcRenderer.invoke('updater:getVersion'),
        check: () => ipcRenderer.invoke('updater:check'),
        download: () => ipcRenderer.invoke('updater:download'),
        install: () => ipcRenderer.invoke('updater:install'),
        onStatus: (callback) => ipcRenderer.on('updater:status', (event, data) => callback(data)),
        removeListener: () => ipcRenderer.removeAllListeners('updater:status')
    },
    admin: {
        getStats: () => ipcRenderer.invoke('admin:getStats'),
        listGyms: () => ipcRenderer.invoke('admin:listGyms'),
        createLicense: (gymName) => ipcRenderer.invoke('admin:createLicense', gymName),
        revokeLicense: (gymId) => ipcRenderer.invoke('admin:revokeLicense', gymId),
        unbindHardware: (gymId) => ipcRenderer.invoke('admin:unbindHardware', gymId),
        getBroadcast: () => ipcRenderer.invoke('admin:getBroadcast'),
        updateBroadcast: (data) => ipcRenderer.invoke('admin:updateBroadcast', data),
        getReleases: () => ipcRenderer.invoke('admin:getReleases'),
        listBackups: (gymId) => ipcRenderer.invoke('admin:listBackups', gymId),
        getPushHistory: (gymId) => ipcRenderer.invoke('admin:getPushHistory', gymId),
        pushDB: (data) => ipcRenderer.invoke('admin:pushDB', data),
        pickDB: () => ipcRenderer.invoke('admin:pickDB'),
    }
});
