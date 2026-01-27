const { ipcMain } = require('electron');
const customerService = require('../services/customer.service');
const paymentService = require('../services/payment.service');
const tariffService = require('../services/tariff.service');

function registerHandlers() {
    // Helper to wrap service calls with error handling
    const handle = (channel, callback) => {
        ipcMain.handle(channel, async (event, ...args) => {
            try {
                const result = await callback(...args);
                return { success: true, data: result };
            } catch (error) {
                console.error(`Error in ${channel}:`, error);
                return { success: false, error: error.message };
            }
        });
    };

    // Customers
    handle('customers:getAll', () => customerService.getAll());
    handle('customers:create', (data) => customerService.create(data));
    handle('customers:update', (id, data) => customerService.update(id, data));
    handle('customers:toggleActive', (id, mode) => customerService.toggleActive(id, mode));
    handle('customers:getHistory', (id) => customerService.getMembershipHistory(id));

    // Tariffs
    handle('tariffs:getAll', () => tariffService.getAll());
    handle('tariffs:create', (data) => tariffService.create(data));
    handle('tariffs:update', (id, data) => tariffService.update(id, data));
    handle('tariffs:delete', (id) => tariffService.delete(id));

    // Payments
    handle('payments:getByCustomer', (customerId) => paymentService.getByCustomer(customerId));
    handle('payments:create', (data) => paymentService.create(data));
    handle('payments:delete', (id) => paymentService.delete(id));

    // Analytics
    handle('analytics:getDashboardData', async (year) => {
        const analyticsService = require('../services/analytics.service');
        const revenue = analyticsService.getRevenueHistory(year);
        const members = analyticsService.getActiveMembersHistory(year);
        const distribution = analyticsService.getTariffDistribution();
        const activeCount = analyticsService.getActiveCount();

        const newMembers = analyticsService.getNewMembersHistory(year);

        return { revenue, members, distribution, activeCount, newMembers };
    });

    handle('analytics:getAvailableYears', () => require('../services/analytics.service').getAvailableYears());
    handle('analytics:getRecentTransactions', (limit) => require('../services/analytics.service').getRecentTransactions(limit));

    // Cloud Backup
    handle('cloud:backup', (gymId) => require('../services/cloud.service').performFullBackup(gymId));

    // Local Backup Export
    handle('cloud:exportLocal', async () => {
        const { dialog } = require('electron');
        const cloudService = require('../services/cloud.service');

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar Backup Local',
            defaultPath: `backup_gym_${new Date().toISOString().slice(0, 10)}.db`,
            filters: [{ name: 'Database Files', extensions: ['db'] }]
        });

        if (canceled || !filePath) return { success: false, cancelled: true };

        return cloudService.exportDatabase(filePath);
    });

    // --- TRAINING MODULE ---
    const trainingService = require('../services/training.service');
    const excelService = require('../services/excel.service');
    const cloudService = require('../services/cloud.service');
    const googleService = require('../services/google.service');

    handle('training:getExercises', () => trainingService.getExercises());
    handle('training:createExercise', (data) => trainingService.createExercise(data));
    handle('training:updateExercise', (id, data) => trainingService.updateExercise(id, data));
    handle('training:deleteExercise', (id) => trainingService.deleteExercise(id));

    // Categories
    handle('training:getCategories', () => trainingService.getCategories());
    handle('training:createCategory', (data) => trainingService.createCategory(data));
    handle('training:updateCategory', (id, data) => trainingService.updateCategory(id, data));
    handle('training:deleteCategory', (id) => trainingService.deleteCategory(id));
    handle('training:createSubcategory', (data) => trainingService.createSubcategory(data));
    handle('training:deleteSubcategory', (id) => trainingService.deleteSubcategory(id));
    // handle('training:updateSubcategory', ...) if needed
    handle('training:getMesocycles', (customerId) => trainingService.getMesocyclesByCustomer(customerId));
    handle('training:getMesocycle', (id) => trainingService.getMesocycle(id));
    handle('training:getTemplates', (daysFilter) => trainingService.getTemplates(daysFilter));
    handle('training:checkOverlap', (customerId, startDate, endDate, excludeId) => trainingService.checkMesocycleOverlap(customerId, startDate, endDate, excludeId));
    handle('training:saveMesocycle', (data) => trainingService.saveMesocycle(data));
    handle('training:deleteMesocycle', (id) => trainingService.deleteMesocycle(id));

    // Orchestrator: Save -> Excel -> Upload -> Link
    // Orchestrator: Save -> Export Excel (Local)
    handle('training:exportRoutine', async (fullData) => {
        try {
            const { dialog } = require('electron');

            // 1. Save to Local DB (Transaction) - Ensure it's saved first
            trainingService.saveMesocycle(fullData);

            // 2. Ask user for path
            const safeName = fullData.name.replace(/[^a-z0-9]/gi, '_');
            const defaultName = `Rutina_${safeName}.xlsx`;

            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Guardar Rutina Excel',
                defaultPath: defaultName,
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });

            if (canceled || !filePath) return { success: false, cancelled: true };

            // 3. Generate Excel at path
            await excelService.generateRoutineExcel(fullData, filePath);

            // 4. Auto-Upload to Drive (Supabase)
            let publicUrl = null;
            try {
                const fs = require('fs');
                const path = require('path');
                const buffer = fs.readFileSync(filePath);
                const fileName = path.basename(filePath);

                // Use customerId from data, gymId from default
                publicUrl = await cloudService.uploadTrainingFile(null, fullData.customerId || fullData.customer_id, buffer, fileName);
                console.log('Subida automática exitosa:', publicUrl);

                // Save history
                if (publicUrl && fullData.customerId) {
                    trainingService.saveFileHistory(fullData.customerId, fileName, publicUrl);
                }

            } catch (uploadErr) {
                console.error('Error en subida automática:', uploadErr);
                // We don't block the success of local save
            }

            return { success: true, filePath, publicUrl };

        } catch (err) {
            console.error('Export Error:', err);
            return { success: false, error: err.message };
        }
    });

    handle('training:uploadToDrive', async (mesoId) => {
        const fullMeso = trainingService.getMesocycle(mesoId);
        if (!fullMeso) throw new Error('Mesociclo no encontrado');

        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');

        // Generate Temp Excel
        const tempDir = app.getPath('temp');
        const safeName = fullMeso.name.replace(/[^a-z0-9]/gi, '_');
        const fileName = `Rutina_${safeName}_${Date.now()}.xlsx`;
        const tempPath = path.join(tempDir, fileName);

        await excelService.generateRoutineExcel(fullMeso, tempPath);

        const buffer = fs.readFileSync(tempPath);

        // Fetch Customer Details (Name & Email)
        let customerName = 'Cliente';
        let customerEmail = null;

        if (fullMeso.customer_id) {
            const db = require('../db/database').getInstance();
            const c = db.prepare('SELECT first_name, last_name, email FROM customers WHERE id = ?').get(fullMeso.customer_id);
            if (c) {
                customerName = `${c.first_name} ${c.last_name}`;
                customerEmail = c.email;
            }
        }

        const publicUrl = await googleService.uploadFile(buffer, fileName, customerName, customerEmail, fullMeso.name);

        // History & Persistence
        if (publicUrl) {
            trainingService.saveFileHistory(fullMeso.customer_id, fileName, publicUrl);
            trainingService.updateMesocycleLink(mesoId, publicUrl);
        }

        // Cleanup
        try { fs.unlinkSync(tempPath); } catch (e) { }

        return publicUrl;
    });

    ipcMain.handle('training:validateDriveLink', async (event, mesoId, url) => {
        const isValid = await googleService.checkFileExistsFromUrl(url);
        if (!isValid) {
            // Remove from DB if gone
            trainingService.updateMesocycleLink(mesoId, null);
        }
        return isValid;
    });

    // Memberships (History Editing)
    const membershipService = require('../services/membership.service');
    handle('memberships:update', (id, data) => membershipService.update(id, data));
    handle('memberships:delete', (id) => membershipService.delete(id));

    // Settings
    const settingsService = require('../services/settings.service');
    handle('settings:getAll', () => settingsService.getAll());
    handle('settings:update', (data) => settingsService.updateSettings(data));
    handle('settings:verifyPassword', (pwd) => settingsService.verifyPassword(pwd));
    handle('settings:activate', (key) => settingsService.setActivation(key));
}

module.exports = { registerHandlers };
