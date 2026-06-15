const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    gdpr: {
        export: (id) => ipcRenderer.invoke('gdpr:export', id),
        anonymize: (id) => ipcRenderer.invoke('gdpr:anonymize', id),
        setConsent: (id) => ipcRenderer.invoke('gdpr:setConsent', id),
    },
    customers: {
        getAll: () => ipcRenderer.invoke('customers:getAll'),
        getById: (id) => ipcRenderer.invoke('customers:getById', id),
        create: (data) => ipcRenderer.invoke('customers:create', data),
        update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
        toggleActive: (id, mode, options) => ipcRenderer.invoke('customers:toggleActive', id, mode, options),
        getHistory: (id) => ipcRenderer.invoke('customers:getHistory', id),
        delete: (id) => ipcRenderer.invoke('customers:delete', id),
        bulkImport: (data) => ipcRenderer.invoke('customers:bulkImport', data),
        importExcel: () => ipcRenderer.invoke('customers:importExcel'),
        pickDatasetFile: () => ipcRenderer.invoke('customers:pickDatasetFile'),
        importDataset: (dataset) => ipcRenderer.invoke('customers:importDataset', dataset),
        exportDataset: () => ipcRenderer.invoke('customers:exportDataset'),
        getByIds: (ids) => ipcRenderer.invoke('customers:getByIds', ids),
    },
    payments: {
        getByCustomer: (customerId) => ipcRenderer.invoke('payments:getByCustomer', customerId),
        create: (data) => ipcRenderer.invoke('payments:create', data),
        delete: (id) => ipcRenderer.invoke('payments:delete', id),
        getMonthlyReport: (year, month) => ipcRenderer.invoke('payments:getMonthlyReport', year, month),
        getDebtors: () => ipcRenderer.invoke('payments:getDebtors'),
        getMethods: () => ipcRenderer.invoke('payments:getMethods'),
        getMultiMonth: () => ipcRenderer.invoke('payments:getMultiMonth'),
        getGroup: (groupId) => ipcRenderer.invoke('payments:getGroup', groupId),
        exportExcel: (options) => ipcRenderer.invoke('payments:exportExcel', options),
    },
    trainers: {
        getAll: (filter) => ipcRenderer.invoke('trainers:getAll', filter),
        getById: (id) => ipcRenderer.invoke('trainers:getById', id),
        create: (data) => ipcRenderer.invoke('trainers:create', data),
        update: (id, data) => ipcRenderer.invoke('trainers:update', id, data),
        toggleActive: (id) => ipcRenderer.invoke('trainers:toggleActive', id),
        delete: (id) => ipcRenderer.invoke('trainers:delete', id),
        setSchedule: (id, schedule) => ipcRenderer.invoke('trainers:setSchedule', id, schedule),
        getOnDuty: (day, start, end) => ipcRenderer.invoke('trainers:getOnDuty', day, start, end),
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
        getInventoryDashboardData: (year, category) => ipcRenderer.invoke('analytics:getInventoryDashboardData', year, category),
    },
    memberships: {
        update: (id, data) => ipcRenderer.invoke('memberships:update', id, data),
        delete: (id) => ipcRenderer.invoke('memberships:delete', id),
    },
    cloud: {
        backup: (gymId) => ipcRenderer.invoke('cloud:backup', gymId),
        exportLocal: () => ipcRenderer.invoke('cloud:exportLocal'),
        importLocal: () => ipcRenderer.invoke('cloud:importLocal'),
        onRemoteLoadPending: (callback) => {
            const subscription = (event, data) => callback(data);
            ipcRenderer.on('cloud:remote-load-pending', subscription);
            return () => ipcRenderer.removeListener('cloud:remote-load-pending', subscription);
        },
        applyRemoteLoad: (data) => ipcRenderer.invoke('cloud:applyRemoteLoad', data),
        applyExerciseDataset: (data) => ipcRenderer.invoke('cloud:applyExerciseDataset', data),
        applyCustomerDataset: (data) => ipcRenderer.invoke('cloud:applyCustomerDataset', data),
        pushExerciseDatasetToGym: (targetGymId) => ipcRenderer.invoke('cloud:pushExerciseDatasetToGym', { targetGymId }),
        pushCustomerDatasetToGym: (targetGymId) => ipcRenderer.invoke('cloud:pushCustomerDatasetToGym', { targetGymId }),
        onExerciseDatasetPending: (callback) => {
            const sub = (_e, d) => callback(d);
            ipcRenderer.on('cloud:exercise-dataset-pending', sub);
            return () => ipcRenderer.removeListener('cloud:exercise-dataset-pending', sub);
        },
        onCustomerDatasetPending: (callback) => {
            const sub = (_e, d) => callback(d);
            ipcRenderer.on('cloud:customer-dataset-pending', sub);
            return () => ipcRenderer.removeListener('cloud:customer-dataset-pending', sub);
        },
        // "Sincronizar tablas" actionable notification + its trigger.
        onResyncPrompt: (callback) => {
            const sub = (_e, d) => callback(d);
            ipcRenderer.on('cloud:resync-prompt', sub);
            return () => ipcRenderer.removeListener('cloud:resync-prompt', sub);
        },
        forceResync: (data) => ipcRenderer.invoke('cloud:forceResync', data),
        sendCustomersToGym: (targetGymId, customerIds) => ipcRenderer.invoke('cloud:sendCustomersToGym', { targetGymId, customerIds }),
        // Background sync
        syncNow: () => ipcRenderer.invoke('cloud:syncNow'),
        syncStatus: () => ipcRenderer.invoke('cloud:syncStatus'),
        onSyncStatus: (callback) => {
            const subscription = (_event, data) => callback(data);
            ipcRenderer.on('cloud:sync-status', subscription);
            return () => ipcRenderer.removeListener('cloud:sync-status', subscription);
        },
        // Mobile client invitation
        inviteToMobile: (gymId, customerId, email, customerName) => ipcRenderer.invoke('cloud:inviteToMobile', { gymId, customerId, email, customerName }),
        getPublishableConfig: () => ipcRenderer.invoke('cloud:getPublishableConfig'),
        // Mobile app data
        getCustomerWeightLogs: (gymId, customerId) => ipcRenderer.invoke('cloud:getCustomerWeightLogs', { gymId, customerId }),
        getRmRecords: (gymId, status) => ipcRenderer.invoke('cloud:getRmRecords', { gymId, status }),
        reviewRmRecord: (id, status) => ipcRenderer.invoke('cloud:reviewRmRecord', { id, status }),
        getCustomerMobileStatus: (gymId, customerId) => ipcRenderer.invoke('cloud:getCustomerMobileStatus', { gymId, customerId }),
        getMobileLinkedCustomers: (gymId) => ipcRenderer.invoke('cloud:getMobileLinkedCustomers', { gymId }),
        resetMobilePassword: (gymId, customerId) => ipcRenderer.invoke('cloud:resetMobilePassword', { gymId, customerId }),
        revokeMobileAccess: (gymId, customerId) => ipcRenderer.invoke('cloud:revokeMobileAccess', { gymId, customerId }),
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
        pickDatasetFile: () => ipcRenderer.invoke('training:pickDatasetFile'),
        importDataset: (dataset) => ipcRenderer.invoke('training:importDataset', dataset),
        exportDataset: () => ipcRenderer.invoke('training:exportDataset'),
        getFieldConfigs: () => ipcRenderer.invoke('training:getFieldConfigs'),
        getAllFieldConfigs: () => ipcRenderer.invoke('training:getAllFieldConfigs'),
        getCatalog: () => ipcRenderer.invoke('training:getCatalog'),
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
    // google removed in v2.2.0
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
        getGymDetail: (gymId) => ipcRenderer.invoke('admin:getGymDetail', gymId),
        setPlan: (gymId, plan) => ipcRenderer.invoke('admin:setPlan', { gymId, plan }),
        runCloudBackup: () => ipcRenderer.invoke('admin:runCloudBackup'),
        getLatestCloudBackup: () => ipcRenderer.invoke('admin:getLatestCloudBackup'),

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
    // templates removed in v2.2.0
    classes: {
        getAll: (filter) => ipcRenderer.invoke('classes:getAll', filter),
        getById: (id) => ipcRenderer.invoke('classes:getById', id),
        create: (data) => ipcRenderer.invoke('classes:create', data),
        update: (id, data) => ipcRenderer.invoke('classes:update', id, data),
        toggleActive: (id) => ipcRenderer.invoke('classes:toggleActive', id),
        delete: (id) => ipcRenderer.invoke('classes:delete', id),
        getSchedules: (classId) => ipcRenderer.invoke('classes:getSchedules', classId),
        addSchedule: (data) => ipcRenderer.invoke('classes:addSchedule', data),
        updateSchedule: (id, data) => ipcRenderer.invoke('classes:updateSchedule', id, data),
        deleteSchedule: (id) => ipcRenderer.invoke('classes:deleteSchedule', id),
        getWeeklySchedule: () => ipcRenderer.invoke('classes:getWeeklySchedule'),
        getBookingsForDate: (date) => ipcRenderer.invoke('classes:getBookingsForDate', date),
        getBookingsForWeek: (startDate, endDate) => ipcRenderer.invoke('classes:getBookingsForWeek', startDate, endDate),
        // Gym hours helper
        getGymHours: () => ipcRenderer.invoke('classes:getGymHours'),
        setGymHours: (config) => ipcRenderer.invoke('classes:setGymHours', config),
        setGymEnabled: (enabled) => ipcRenderer.invoke('classes:setGymEnabled', enabled),
        // Sporadic events
        createEvent: (data) => ipcRenderer.invoke('classes:createEvent', data),
        getEvents: (startDate, endDate) => ipcRenderer.invoke('classes:getEvents', startDate, endDate),
        cancelEvent: (eventId) => ipcRenderer.invoke('classes:cancelEvent', eventId),
        deleteEvent: (eventId) => ipcRenderer.invoke('classes:deleteEvent', eventId),
        // Realtime bookings listener (poll every 30s + Realtime)
        onBookingsUpdated: (callback) => {
            const subscription = (_event, data) => callback(data);
            ipcRenderer.on('bookings:updated', subscription);
            return () => ipcRenderer.removeListener('bookings:updated', subscription);
        },
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
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
        onMaximizeChange: (callback) => {
            const handler = (event, value) => callback(value);
            ipcRenderer.on('window:maximized-changed', handler);
            return () => ipcRenderer.removeListener('window:maximized-changed', handler);
        }
    },
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    }
});
