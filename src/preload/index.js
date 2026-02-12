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
        getMonthlyReport: (year, month) => ipcRenderer.invoke('payments:getMonthlyReport', year, month),
        getDebtors: () => ipcRenderer.invoke('payments:getDebtors')
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
        getInventoryDashboardData: (year) => ipcRenderer.invoke('analytics:getInventoryDashboardData', year),
    },
    memberships: {
        update: (id, data) => ipcRenderer.invoke('memberships:update', id, data),
        delete: (id) => ipcRenderer.invoke('memberships:delete', id),
    },
    cloud: {
        backup: (gymId) => ipcRenderer.invoke('cloud:backup', gymId),
        exportLocal: () => ipcRenderer.invoke('cloud:exportLocal'),
        onRemoteLoadPending: (callback) => {
            const subscription = (event, data) => callback(data);
            ipcRenderer.on('cloud:remote-load-pending', subscription);
            return () => ipcRenderer.removeListener('cloud:remote-load-pending', subscription);
        },
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
        getPriorities: () => ipcRenderer.invoke('training:getPriorities'),
        checkOverlap: (customerId, startDate, endDate, excludeId) => ipcRenderer.invoke('training:checkOverlap', customerId, startDate, endDate, excludeId),
        saveMesocycle: (data) => ipcRenderer.invoke('training:saveMesocycle', data),
        deleteMesocycle: (id) => ipcRenderer.invoke('training:deleteMesocycle', id),
        exportRoutine: (data) => ipcRenderer.invoke('training:exportRoutine', data),
        validateDriveLink: (mesoId, url) => ipcRenderer.invoke('training:validateDriveLink', mesoId, url),
        uploadToDrive: (mesoId) => ipcRenderer.invoke('training:uploadToDrive', mesoId),
        getFieldConfigs: () => ipcRenderer.invoke('training:getFieldConfigs'),
        getAllFieldConfigs: () => ipcRenderer.invoke('training:getAllFieldConfigs'),
        updateFieldConfig: (key, data) => ipcRenderer.invoke('training:updateFieldConfig', key, data),
        addFieldConfig: (label, type, options) => ipcRenderer.invoke('training:addFieldConfig', label, type, options),
        deleteFieldConfig: (key) => ipcRenderer.invoke('training:deleteFieldConfig', key),
    },
    settings: {
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        update: (data) => ipcRenderer.invoke('settings:update', data),
        activate: (key) => ipcRenderer.invoke('settings:activate', key),
        selectExcelTemplate: () => ipcRenderer.invoke('settings:selectExcelTemplate'),
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

        // Org Refactor
        createOrganization: (name, email, templatePath) => ipcRenderer.invoke('admin:createOrganization', name, email, templatePath),
        updateOrganization: (id, data) => ipcRenderer.invoke('admin:updateOrganization', id, data),
        selectTemplate: () => ipcRenderer.invoke('admin:selectTemplate'),
        listOrganizations: () => ipcRenderer.invoke('admin:listOrganizations'),
        createLicense: (orgId, validity, amount) => ipcRenderer.invoke('admin:createLicense', orgId, validity, amount),

        // Legacy
        generateNewLicense: (gymName) => ipcRenderer.invoke('admin:generateNewLicense', gymName),

        revokeLicense: (gymId) => ipcRenderer.invoke('admin:revokeLicense', gymId),
        deleteLicense: (id) => ipcRenderer.invoke('admin:deleteLicense', id),
        unbindHardware: (gymId) => ipcRenderer.invoke('admin:unbindHardware', gymId),
        getReleases: () => ipcRenderer.invoke('admin:getReleases'),
        listBackups: (gymId) => ipcRenderer.invoke('admin:listBackups', gymId),
        getPushHistory: (gymId) => ipcRenderer.invoke('admin:getPushHistory', gymId),
        restoreBackup: ({ gymId, fileName }) => ipcRenderer.invoke('admin:restoreBackup', { gymId, fileName }),
        pushDB: (data) => ipcRenderer.invoke('admin:pushDB', data),
        pickDB: () => ipcRenderer.invoke('admin:pickDB'),
    },
    templates: {
        generate: (config) => ipcRenderer.invoke('templates:generate', config),
        selectLogo: () => ipcRenderer.invoke('templates:selectLogo'),
        getInfo: () => ipcRenderer.invoke('templates:getInfo'),
        loadConfig: (filename) => ipcRenderer.invoke('templates:loadConfig', filename),
        delete: (filename) => ipcRenderer.invoke('templates:delete', filename),
        activate: (filename) => ipcRenderer.invoke('templates:activate', filename),
        getFieldConfigs: () => ipcRenderer.invoke('templates:getFieldConfigs'),
    },
    inventory: {
        getProducts: () => ipcRenderer.invoke('inventory:getProducts'),
        createProduct: (data) => ipcRenderer.invoke('inventory:createProduct', data),
        updateProduct: (id, data) => ipcRenderer.invoke('inventory:updateProduct', id, data),
        deleteProduct: (id) => ipcRenderer.invoke('inventory:deleteProduct', id),
        getOrders: () => ipcRenderer.invoke('inventory:getOrders'),
        createOrder: (data) => ipcRenderer.invoke('inventory:createOrder', data),
        deleteOrder: (id) => ipcRenderer.invoke('inventory:deleteOrder', id),
        getCategories: () => ipcRenderer.invoke('inventory:getCategories'),
        createCategory: (data) => ipcRenderer.invoke('inventory:createCategory', data),
        updateCategory: (id, data) => ipcRenderer.invoke('inventory:updateCategory', id, data),
        deleteCategory: (id) => ipcRenderer.invoke('inventory:deleteCategory', id),
    },
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    }
});
