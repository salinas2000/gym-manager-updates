const { ipcMain } = require('electron');
const customerService = require('../services/local/customer.service');
const gdprService = require('../services/local/gdpr.service');
const paymentService = require('../services/local/payment.service');
const tariffService = require('../services/local/tariff.service');
// templateService removed in v2.2.0 — templates / Excel / Google Drive integration deprecated

let handlersRegistered = false;

// Channels that mutate data → trigger cloud sync after success
const MUTATION_PATTERNS = [
    ':create', ':update', ':delete', ':toggle', ':bulkImport',
    ':importDataset', ':importExcel', ':save', ':add', ':remove',
];

function isMutationChannel(channel) {
    return MUTATION_PATTERNS.some(p => channel.includes(p));
}

function registerHandlers() {
    if (handlersRegistered) {
        console.log('[IPC] Handlers already registered, skipping...');
        return;
    }
    handlersRegistered = true;

    const syncService = require('../services/cloud/sync.service');

    // Helper to wrap service calls with error handling
    // Automatically triggers cloud sync for mutation channels
    const handle = (channel, callback) => {
        ipcMain.handle(channel, async (event, ...args) => {
            try {
                const result = await callback(...args);
                // Auto-sync after successful mutations
                if (isMutationChannel(channel)) {
                    // High-value mutations sync ASAP (1s) so clients see them quickly.
                    // Less critical ones (settings, templates) get a normal 3s debounce.
                    const isHighValue = channel.includes('classes:') ||
                                        channel.includes('trainers:') ||
                                        channel.includes('customers:') ||
                                        channel.includes('payments:');
                    syncService.scheduleSync(isHighValue ? 1 : 3);
                }
                return { success: true, data: result };
            } catch (error) {
                console.error(`Error in ${channel}:`, error);
                return { success: false, error: error.message };
            }
        });
    };

    // Customers
    handle('customers:getAll', () => customerService.getAll());
    // RGPD / GDPR — data-subject rights for a single customer
    handle('gdpr:export', (id) => gdprService.exportCustomerDataFull(id));
    handle('gdpr:anonymize', (id) => gdprService.anonymizeCustomer(id));
    handle('gdpr:setConsent', (id) => gdprService.setConsent(id));
    handle('customers:create', (data) => customerService.create(data));
    handle('customers:update', (id, data) => customerService.update(id, data));
    handle('customers:toggleActive', (id, mode, options) => customerService.toggleActive(id, mode, options));
    handle('customers:getHistory', (id) => customerService.getMembershipHistory(id));
    handle('customers:delete', (id) => customerService.delete(id));
    handle('customers:getById', (id) => customerService.getById(id));
    handle('customers:bulkImport', (data) => customerService.bulkImport(data));
    handle('customers:pickDatasetFile', async () => {
        const { dialog } = require('electron');
        const fs = require('fs');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Seleccionar Dataset de Clientes',
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (canceled || !filePaths || filePaths.length === 0) return { cancelled: true };
        const raw = fs.readFileSync(filePaths[0], 'utf-8');
        try {
            const dataset = JSON.parse(raw);
            return { dataset, filePath: filePaths[0] };
        } catch (e) {
            throw new Error('JSON inválido: ' + e.message);
        }
    });
    handle('customers:importDataset', (dataset) => customerService.importDataset(dataset));
    handle('customers:exportDataset', async () => {
        const { dialog } = require('electron');
        const fs = require('fs');
        const dataset = customerService.exportDataset();
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar Dataset de Clientes',
            defaultPath: `gym-customers-${new Date().toISOString().split('T')[0]}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (canceled || !filePath) return { cancelled: true };
        fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
        return { success: true, filePath, count: dataset.meta.total_customers };
    });
    handle('customers:importExcel', async () => {
        const { dialog } = require('electron');
        const ExcelJS = require('exceljs');

        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Importar Ficha de Inscripcion',
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
        });

        if (canceled || !filePaths || filePaths.length === 0) return { cancelled: true };

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePaths[0]);
        const sheet = workbook.worksheets[0];

        if (!sheet) throw new Error('No se encontro ninguna hoja en el archivo');

        const headers = [];
        sheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber] = (cell.value || '').toString().toLowerCase().trim();
        });

        const customers = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header

            const getValue = (row, col) => {
                const cell = row.getCell(col);
                if (!cell || cell.value === null || cell.value === undefined) return '';
                if (cell.value instanceof Date) return cell.value.toISOString().split('T')[0];
                return cell.value.toString().trim();
            };

            // Map columns by header name patterns
            // FIX: findIndex returns -1 if not found. +1 because ExcelJS columns are 1-indexed.
            // If not found, result is 0 which is falsy and getValue will return '' safely.
            const findCol = (patterns) => {
                const idx = headers.findIndex(h => h && patterns.some(p => h.includes(p)));
                return idx === -1 ? 0 : idx;
            };

            const nameCol = findCol(['nombre']);
            const apellido1Col = findCol(['primer apellido']);
            const apellido2Col = findCol(['segundo apellido']);
            const dniCol = findCol(['dni', 'nie']);
            const addressCol = findCol(['direcci', 'direccion', 'calle']);
            const emailCol = findCol(['correo', 'email']);
            const phoneCol = findCol(['tel', 'phone']);
            const startCol = findCol(['fecha de inicio']);
            const heightCol = findCol(['altura']);
            const weightCol = findCol(['peso']);
            const diseaseCol = findCol(['enfermedad']);
            const injuryCol = findCol(['lesi']);
            const allergyCol = findCol(['alergia']);
            const surgeryCol = findCol(['operaci', 'cirug']);

            const firstName = getValue(row, nameCol);
            if (!firstName) return;

            const lastName1 = getValue(row, apellido1Col);
            const lastName2 = getValue(row, apellido2Col);
            const lastName = [lastName1, lastName2].filter(Boolean).join(' ');

            customers.push({
                first_name: firstName,
                last_name: lastName,
                email: getValue(row, emailCol),
                phone: getValue(row, phoneCol),
                dni: getValue(row, dniCol),
                address: getValue(row, addressCol),
                height_cm: parseFloat(getValue(row, heightCol)) || null,
                weight_kg: parseFloat(getValue(row, weightCol)) || null,
                start_date: getValue(row, startCol) || null,
                medical_info: {
                    diseases: getValue(row, diseaseCol) || '',
                    injuries: getValue(row, injuryCol) || '',
                    allergies: getValue(row, allergyCol) || '',
                    surgeries: getValue(row, surgeryCol) || '',
                }
            });
        });

        if (customers.length === 0) throw new Error('No se encontraron clientes en el archivo');

        // Preview - don't import yet, return parsed data
        return { customers, fileName: filePaths[0] };
    });
    handle('customers:getByIds', (ids) => customerService.getByIds(ids));

    // Tariffs
    handle('tariffs:getAll', () => tariffService.getAll());
    handle('tariffs:create', (data) => tariffService.create(data));
    handle('tariffs:update', (id, data) => tariffService.update(id, data));
    handle('tariffs:delete', (id) => tariffService.delete(id));

    // Payments
    handle('payments:getByCustomer', (customerId) => paymentService.getByCustomer(customerId));
    handle('payments:create', (data) => paymentService.create(data));
    handle('payments:delete', (id) => paymentService.delete(id));
    handle('payments:getMethods', () => paymentService.getPaymentMethods());
    handle('payments:getMultiMonth', () => paymentService.getMultiMonthPayments());
    handle('payments:getGroup', (groupId) => paymentService.getPaymentGroup(groupId));
    handle('payments:getMonthlyReport', (year, month) => paymentService.getMonthlyReport(year, month));
    handle('payments:getDebtors', () => paymentService.getDebtors());
    handle('payments:exportExcel', async (options) => {
        const { dialog } = require('electron');
        const ExcelJS = require('exceljs');
        const dbManager = require('../db/database');
        const db = dbManager.getInstance();

        // Permitimos rango opcional (year, month) o todo
        const yearFilter = options && options.year ? Number(options.year) : null;
        const monthFilter = options && options.month ? Number(options.month) : null;

        let query = `
            SELECT
                p.id,
                p.amount,
                p.tariff_name,
                p.payment_date,
                p.payment_method,
                p.payment_group_id,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                c.dni
            FROM payments p
            LEFT JOIN customers c ON p.customer_id = c.id
        `;
        const params = [];
        const where = [];
        if (yearFilter && monthFilter) {
            const monthStr = String(monthFilter).padStart(2, '0');
            const start = `${yearFilter}-${monthStr}-01`;
            const end = monthFilter === 12
                ? `${yearFilter + 1}-01-01`
                : `${yearFilter}-${String(monthFilter + 1).padStart(2, '0')}-01`;
            where.push('p.payment_date >= ?');
            where.push('p.payment_date < ?');
            params.push(start, end);
        } else if (yearFilter) {
            where.push("strftime('%Y', p.payment_date) = ?");
            params.push(String(yearFilter));
        }
        if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
        query += ' ORDER BY p.payment_date DESC, p.id DESC';

        const rows = db.prepare(query).all(...params);

        const fileLabel = yearFilter && monthFilter
            ? `${yearFilter}-${String(monthFilter).padStart(2, '0')}`
            : yearFilter
                ? String(yearFilter)
                : 'todos';

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar Pagos a Excel',
            defaultPath: `pagos-${fileLabel}-${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        if (canceled || !filePath) return { cancelled: true };

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Gym Manager Pro';
        wb.created = new Date();
        const ws = wb.addWorksheet('Pagos');

        ws.columns = [
            { header: 'ID',            key: 'id',       width: 8 },
            { header: 'Cliente',       key: 'customer', width: 28 },
            { header: 'DNI',           key: 'dni',      width: 12 },
            { header: 'Email',         key: 'email',    width: 30 },
            { header: 'Teléfono',      key: 'phone',    width: 14 },
            { header: 'Tarifa',        key: 'tariff',   width: 22 },
            { header: 'Importe (€)',   key: 'amount',   width: 12, style: { numFmt: '#,##0.00 €' } },
            { header: 'Fecha de pago', key: 'date',     width: 14, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Método',        key: 'method',   width: 14 },
            { header: 'Grupo',         key: 'group',    width: 28 },
            { header: 'Tipo',          key: 'kind',     width: 14 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(1).height = 22;

        let total = 0;
        rows.forEach(r => {
            const customer = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '(sin nombre)';
            const isCoverage = (r.amount || 0) === 0 && r.payment_group_id;
            const kind = isCoverage ? 'Cobertura' : (r.payment_group_id ? 'Pago real (multi)' : 'Mensual');
            const paymentDate = r.payment_date ? new Date(r.payment_date) : null;
            const row = ws.addRow({
                id: r.id,
                customer,
                dni: r.dni || '',
                email: r.email || '',
                phone: r.phone || '',
                tariff: r.tariff_name || '',
                amount: r.amount || 0,
                date: paymentDate,
                method: r.payment_method || '',
                group: r.payment_group_id || '',
                kind,
            });
            // Color sutil de coberturas (importe 0) para distinguirlas
            if (isCoverage) {
                row.eachCell(c => {
                    c.font = { color: { argb: 'FF94A3B8' }, italic: true };
                });
            }
            total += (r.amount || 0);
        });

        // Fila de total
        const totalRow = ws.addRow({ customer: 'TOTAL', amount: total });
        totalRow.font = { bold: true };
        totalRow.getCell('amount').numFmt = '#,##0.00 €';
        totalRow.getCell('customer').alignment = { horizontal: 'right' };

        // Bordes ligeros y autofiltro
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        await wb.xlsx.writeFile(filePath);
        return { success: true, filePath, count: rows.length, total };
    });

    handle('analytics:getDashboardData', async (year) => {
        const analyticsService = require('../services/local/analytics.service');
        const revenue = analyticsService.getRevenueHistory(year);
        const members = analyticsService.getActiveMembersHistory(year);
        const distribution = analyticsService.getTariffDistribution();
        const activeCount = analyticsService.getActiveCount();
        const newMembers = analyticsService.getNewMembersHistory(year);
        const debtorCount = analyticsService.getDebtorCount();
        const totalRevenueAllTime = analyticsService.getTotalRevenue();

        return { revenue, members, distribution, activeCount, newMembers, debtorCount, totalRevenueAllTime };
    });

    handle('analytics:getAvailableYears', () => require('../services/local/analytics.service').getAvailableYears());
    handle('analytics:getRecentTransactions', (limit) => require('../services/local/analytics.service').getRecentTransactions(limit));
    handle('analytics:getInventoryDashboardData', (year, category) => require('../services/local/analytics.service').getInventoryDashboardData(year, category));

    // Cloud Backup
    handle('cloud:backup', (gymId) => require('../services/cloud/cloud.service').performFullBackup(gymId));
    handle('cloud:exportLocal', async () => {
        const { dialog } = require('electron');
        const cloudService = require('../services/cloud/cloud.service');

        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar Backup Local',
            defaultPath: `backup_gym_${new Date().toISOString().slice(0, 10)}.db`,
            filters: [{ name: 'Database Files', extensions: ['db'] }]
        });

        if (canceled || !filePath) return { success: false, cancelled: true };

        return cloudService.exportDatabase(filePath);
    });

    handle('cloud:importLocal', async () => {
        const { dialog } = require('electron');
        const cloudService = require('../services/cloud/cloud.service');

        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Importar Backup Local',
            properties: ['openFile'],
            filters: [{ name: 'Database Files', extensions: ['db'] }]
        });

        if (canceled || !filePaths || filePaths.length === 0) return { success: false, cancelled: true };

        return cloudService.importDatabase(filePaths[0]);
    });

    // --- TRAINING MODULE ---
    const trainingService = require('../services/local/training.service');
    const excelService = require('../services/io/excel.service');
    const cloudService = require('../services/cloud/cloud.service');
    // googleService removed in v2.2.0 — Drive integration deprecated

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
    handle('training:getPriorities', () => trainingService.getTrainingPriorities());
    handle('training:checkOverlap', (customerId, startDate, endDate, excludeId) => trainingService.checkMesocycleOverlap(customerId, startDate, endDate, excludeId));
    handle('training:saveMesocycle', (data) => trainingService.saveMesocycle(data));
    handle('training:deleteMesocycle', (id) => trainingService.deleteMesocycle(id));
    // Dataset import/export
    handle('training:pickDatasetFile', async () => {
        const { dialog } = require('electron');
        const fs = require('fs');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Seleccionar Dataset de Ejercicios',
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (canceled || !filePaths || filePaths.length === 0) return { cancelled: true };
        const raw = fs.readFileSync(filePaths[0], 'utf-8');
        try {
            const dataset = JSON.parse(raw);
            return { dataset, filePath: filePaths[0] };
        } catch (e) {
            throw new Error('JSON inválido: ' + e.message);
        }
    });
    handle('training:importDataset', (dataset) => trainingService.importDataset(dataset));
    handle('training:exportDataset', async () => {
        const { dialog } = require('electron');
        const fs = require('fs');
        const dataset = trainingService.exportDataset();
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Exportar Dataset de Ejercicios',
            defaultPath: `gym-exercises-${new Date().toISOString().split('T')[0]}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (canceled || !filePath) return { cancelled: true };
        fs.writeFileSync(filePath, JSON.stringify(dataset, null, 2));
        return { success: true, filePath, count: dataset.meta.total_exercises };
    });

    handle('training:getFieldConfigs', () => trainingService.getExerciseFieldConfigs());
    handle('training:getAllFieldConfigs', () => trainingService.getAllExerciseFieldConfigs());
    // Expose the canonical catalog so the renderer doesn't keep a hand-synced
    // copy. Single source of truth lives in src/main/constants/field-catalog.js.
    handle('training:getCatalog', () => {
        const { FIELD_CATALOG } = require('../constants/field-catalog');
        return FIELD_CATALOG;
    });
    handle('training:updateFieldConfig', (key, data) => trainingService.updateExerciseFieldConfig(key, data));
    handle('training:addFieldConfig', (label, type, options) => trainingService.addFieldConfig(label, type, options));
    handle('training:deleteFieldConfig', (key) => trainingService.deleteFieldConfig(key));

    // Orchestrator: Save -> Excel -> Upload -> Link
    // Orchestrator: Save -> Export Excel (Local)
    // Drive integration removed in v2.2.0 — clients see routines in mobile app.
    // We keep a simple Excel export for owners who want a printable copy.
    handle('training:exportRoutine', async (fullData) => {
        try {
            const { dialog } = require('electron');
            trainingService.saveMesocycle(fullData);

            // Fetch customer name for the Excel
            if (fullData.customerId || fullData.customer_id) {
                const db = require('../db/database').getInstance();
                const c = db.prepare('SELECT first_name, last_name FROM customers WHERE id = ?').get(fullData.customerId || fullData.customer_id);
                if (c) fullData.customer_name = `${c.first_name} ${c.last_name}`;
            }

            const safeName = (fullData.name || 'rutina').replace(/[^a-z0-9]/gi, '_');
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Guardar Rutina Excel',
                defaultPath: `Rutina_${safeName}.xlsx`,
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
            });
            if (canceled || !filePath) return { success: false, cancelled: true };

            await excelService.generateRoutineExcel(fullData, filePath);
            return { success: true, filePath };
        } catch (err) {
            console.error('Export Error:', err);
            return { success: false, error: err.message };
        }
    });

    // Memberships (History Editing)
    const membershipService = require('../services/local/membership.service');
    handle('memberships:update', (id, data) => membershipService.update(id, data));
    handle('memberships:delete', (id) => membershipService.delete(id));

    // Settings
    const settingsService = require('../services/local/settings.service');
    handle('settings:getAll', () => settingsService.getAll());
    handle('settings:update', (data) => settingsService.updateSettings(data));
    handle('settings:activate', (key) => settingsService.setActivation(key));
    handle('settings:selectExcelTemplate', async () => {
        const { dialog } = require('electron');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Seleccionar Plantilla Excel Personalizada',
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });

        if (canceled || !filePaths || filePaths.length === 0) return null;

        const path = filePaths[0];
        settingsService.set('excel_template_path', path);
        return path;
    });

    // License System
    const licService = require('../services/local/license.service');
    handle('license:getStatus', () => ({
        authenticated: licService.isAuthenticated(),
        data: licService.getLicenseData()
    }));
    handle('license:reportVersion', (version) => licService.updateVersion(version));
    handle('license:deactivate', async (event) => {
        const { app, dialog, BrowserWindow } = require('electron');
        const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();

        // Confirm whether to also wipe local DB. Avoids mixing data from
        // two different gyms when the user switches licenses.
        const choice = await dialog.showMessageBox(win, {
            type: 'warning',
            title: 'Cambiar de licencia',
            message: 'Vas a desactivar la licencia actual. ¿Quieres borrar tambien los datos del gimnasio actual?',
            detail:
                'Si cambias a otro gimnasio sin borrar, los datos antiguos quedaran mezclados con los del nuevo gimnasio en tu PC.\n\n' +
                'Recomendado: "Borrar datos y desactivar" si vas a activar otra licencia.',
            buttons: [
                'Borrar datos y desactivar (recomendado)',
                'Solo desactivar (mantener datos)',
                'Cancelar',
            ],
            defaultId: 0,
            cancelId: 2,
            noLink: true,
        });

        if (choice.response === 2) {
            console.log('[IPC] License deactivation cancelled by user');
            return { success: false, cancelled: true };
        }

        if (choice.response === 0) {
            // Wipe the entire local SQLite file before deactivating
            try {
                const dbManager = require('../db/database');
                if (typeof dbManager.wipeAllData === 'function') {
                    dbManager.wipeAllData();
                    console.log('[IPC] Local DB wiped before deactivation');
                } else {
                    // Fallback: close DB so Electron can delete the file on next start
                    if (dbManager.close) dbManager.close();
                    const path = require('path');
                    const fs = require('fs');
                    const dbPath = path.join(app.getPath('userData'), 'gym_manager.db');
                    for (const suffix of ['', '-shm', '-wal']) {
                        try { fs.unlinkSync(dbPath + suffix); } catch (_) {}
                    }
                    console.log('[IPC] Local DB file deleted');
                }
            } catch (err) {
                console.error('[IPC] Failed to wipe local DB:', err.message);
                // Continue with deactivation anyway
            }
        }

        licService.deactivate();
        console.log('[IPC] License deactivated. Relaunching app for fresh state...');
        // Schedule relaunch on next tick so the IPC response flushes first
        setTimeout(() => {
            app.relaunch();
            app.exit(0);
        }, 200);

        return { success: true, wiped: choice.response === 0 };
    });

    // Google Integration
    // Google Drive handlers removed in v2.2.0 — deprecated
    // Reason: routine tables now live in the mobile app, no more Excel/Drive sharing

    // Admin Panel (Master Only)
    const adminService = require('../services/local/admin.service');
    handle('admin:getStats', () => adminService.getGlobalStats());
    handle('admin:listGyms', () => adminService.listGymsDetail());
    handle('admin:getGymDetail', (gymId) => adminService.getGymDetail(gymId));
    handle('admin:setPlan', ({ gymId, plan }) => adminService.setPlan(gymId, plan));
    handle('admin:runCloudBackup', () => adminService.runCloudBackup());
    handle('admin:getLatestCloudBackup', () => adminService.getLatestCloudBackup());

    // Org & Licenses
    handle('admin:createOrganization', (name, email, templatePath) => adminService.createOrganization(name, email, templatePath));
    handle('admin:updateOrganization', (id, data) => adminService.updateOrganization(id, data));
    handle('admin:selectTemplate', async () => {
        const { dialog } = require('electron');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Seleccionar Plantilla Corporativa',
            properties: ['openFile'],
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });
        if (canceled || !filePaths || filePaths.length === 0) return null;
        return filePaths[0];
    });
    handle('admin:listOrganizations', () => adminService.listOrganizations());
    handle('admin:createLicense', (orgId, validity, amount) => adminService.createLicense(orgId, validity, amount));

    // Legacy/Helper
    handle('admin:generateNewLicense', (gymName) => adminService.generateNewLicense(gymName));
    handle('admin:revokeLicense', (gymId) => adminService.revokeLicense(gymId));
    handle('admin:deleteLicense', (id) => adminService.deleteLicense(id));
    handle('admin:unbindHardware', (gymId) => adminService.unbindHardware(gymId));

    handle('admin:getReleases', () => adminService.getGitHubReleases());
    handle('admin:listBackups', (gymId) => adminService.listGymBackups(gymId));
    handle('admin:getPushHistory', (gymId) => adminService.getPushHistory(gymId));
    handle('admin:pushDB', ({ gymId, localPath }) => adminService.pushRemoteDatabase(gymId, localPath));
    handle('admin:pickDB', async () => {
        const { dialog } = require('electron');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Seleccionar Base de Datos para Carga Remota',
            properties: ['openFile'],
            filters: [{ name: 'Database Files', extensions: ['db'] }]
        });
        if (canceled || filePaths.length === 0) return null;
        return filePaths[0];
    });
    handle('cloud:applyRemoteLoad', (data) => require('../services/cloud/cloud.service').applyRemoteLoad(data.gym_id, data.load_id));
    handle('cloud:applyExerciseDataset', (data) => require('../services/cloud/cloud.service').applyExerciseDataset(data.gym_id, data.load_id, data.payload_path));
    handle('cloud:applyCustomerDataset', (data) => require('../services/cloud/cloud.service').applyCustomerDataset(data.gym_id, data.load_id, data.payload_path));
    handle('cloud:pushExerciseDatasetToGym', async ({ targetGymId }) => {
        const trainingService = require('../services/local/training.service');
        const cloudService = require('../services/cloud/cloud.service');
        const dataset = trainingService.exportDataset();
        return cloudService.pushDatasetToGym('exercise_dataset', targetGymId, dataset);
    });
    handle('cloud:pushCustomerDatasetToGym', async ({ targetGymId }) => {
        const customerService = require('../services/local/customer.service');
        const cloudService = require('../services/cloud/cloud.service');
        const dataset = customerService.exportDataset();
        return cloudService.pushDatasetToGym('customer_dataset', targetGymId, dataset);
    });
    handle('cloud:sendCustomersToGym', ({ targetGymId, customerIds }) => require('../services/cloud/cloud.service').sendCustomersToGym(targetGymId, customerIds));

    // Cloud Sync (automatic background sync)
    // syncService already imported at top of registerHandlers()
    handle('cloud:syncNow', () => syncService.runFullSync());
    handle('cloud:syncStatus', () => syncService.getStatus());

    // Mobile Client Invitation
    handle('cloud:inviteToMobile', ({ gymId, customerId, email, customerName }) =>
        require('../services/cloud/cloud.service').inviteToMobile(gymId, customerId, email, customerName)
    );

    // Mobile App data — weights & registration status
    handle('cloud:getCustomerWeightLogs', ({ gymId, customerId }) =>
        require('../services/cloud/cloud.service').getCustomerWeightLogs(gymId, customerId)
    );
    // RM records (client-submitted, trainer-approved)
    handle('cloud:getRmRecords', ({ gymId, status }) =>
        require('../services/cloud/cloud.service').getRmRecords(gymId, status)
    );
    handle('cloud:reviewRmRecord', ({ id, status }) =>
        require('../services/cloud/cloud.service').reviewRmRecord(id, status)
    );
    handle('cloud:getCustomerMobileStatus', ({ gymId, customerId }) =>
        require('../services/cloud/cloud.service').getCustomerMobileStatus(gymId, customerId)
    );
    handle('cloud:getMobileLinkedCustomers', ({ gymId }) =>
        require('../services/cloud/cloud.service').getMobileLinkedCustomers(gymId)
    );
    handle('cloud:resetMobilePassword', ({ gymId, customerId }) =>
        require('../services/cloud/cloud.service').resetMobilePassword(gymId, customerId)
    );
    handle('cloud:revokeMobileAccess', ({ gymId, customerId }) =>
        require('../services/cloud/cloud.service').revokeMobileAccess(gymId, customerId)
    );

    handle('cloud:getPublishableConfig', () =>
        require('../services/cloud/cloud.service').getPublishableConfig()
    );

    handle('admin:restoreBackup', ({ gymId, fileName }) => adminService.restoreRemoteBackup(gymId, fileName));

    // Credentials Management
    const credentialManager = require('../config/credentials');
    handle('credentials:getStatus', () => ({
        loaded: credentialManager.isLoaded(),
        hasSupabase: credentialManager.isLoaded() ? !!credentialManager.get().supabase?.url : false,
        hasGoogle: credentialManager.isLoaded() ? !!credentialManager.get().google?.clientId : false,
        hasGitHub: credentialManager.isLoaded() ? !!credentialManager.get().github?.token : false
    }));
    handle('credentials:getInstructions', () => credentialManager.getInstructions());
    handle('credentials:createTemplate', () => {
        const templatePath = credentialManager.createTemplate();
        if (templatePath) {
            require('electron').shell.showItemInFolder(templatePath);
        }
        return templatePath;
    });
    handle('credentials:save', (credentials) => credentialManager.saveToStore(credentials));

    // Template Designer removed in v2.2.0 — routine tables now live in the mobile app
    // --- CLASSES MODULE (Gym classes & weekly schedules) ---
    const classService = require('../services/local/class.service');
    const trainerService = require('../services/local/trainer.service');
    handle('trainers:getAll', (filter) => trainerService.getAll(filter));
    handle('trainers:getById', (id) => trainerService.getById(id));
    handle('trainers:create', (data) => trainerService.create(data));
    handle('trainers:update', (id, data) => trainerService.update(id, data));
    handle('trainers:toggleActive', (id) => trainerService.toggleActive(id));
    handle('trainers:delete', (id) => trainerService.delete(id));
    handle('trainers:setSchedule', (id, schedule) => trainerService.setSchedule(id, schedule));
    handle('trainers:getOnDuty', (day, start, end) => trainerService.getOnDuty(day, start, end));
    handle('classes:getAll', (filter) => classService.getAll(filter));
    handle('classes:getById', (id) => classService.getById(id));
    handle('classes:create', (data) => classService.create(data));
    handle('classes:update', (id, data) => classService.update(id, data));
    handle('classes:toggleActive', (id) => classService.toggleActive(id));
    handle('classes:delete', (id) => classService.delete(id));
    handle('classes:getSchedules', (classId) => classService.getSchedules(classId));
    handle('classes:addSchedule', (data) => classService.addSchedule(data));
    handle('classes:updateSchedule', (id, data) => classService.updateSchedule(id, data));
    handle('classes:deleteSchedule', (id) => classService.deleteSchedule(id));
    handle('classes:getWeeklySchedule', () => classService.getWeeklySchedule());
    handle('classes:getBookingsForDate', (date) => classService.getBookingsForDate(date));
    handle('classes:getBookingsForWeek', (startDate, endDate) => classService.getBookingsForWeek(startDate, endDate));
    // Gym hours helper (manages the special "Gimnasio" class behind the scenes)
    handle('classes:getGymHours', () => classService.getGymHours());
    handle('classes:setGymHours', (config) => classService.setGymHours(config));
    handle('classes:setGymEnabled', (enabled) => classService.setGymEnabled(enabled));
    // Sporadic events (one-off class events)
    handle('classes:createEvent', (data) => classService.createEvent(data));
    handle('classes:getEvents', (startDate, endDate) => classService.getEvents(startDate, endDate));
    handle('classes:cancelEvent', (eventId) => classService.cancelEvent(eventId));
    handle('classes:deleteEvent', (eventId) => classService.deleteEvent(eventId));

    // --- INVENTORY MODULE (Services for stock and category management) ---
    const inventoryService = require('../services/local/inventory.service');
    handle('inventory:getProducts', () => inventoryService.getProducts());
    handle('inventory:createProduct', (data) => inventoryService.createProduct(data));
    handle('inventory:updateProduct', (id, data) => inventoryService.updateProduct(id, data));
    handle('inventory:deleteProduct', (id) => inventoryService.deleteProduct(id));
    handle('inventory:getOrders', () => inventoryService.getOrders());
    handle('inventory:createOrder', (data) => inventoryService.createOrder(data));
    handle('inventory:deleteOrder', (id) => inventoryService.deleteOrder(id));
    handle('inventory:getCategories', () => inventoryService.getCategories());
    handle('inventory:createCategory', (data) => inventoryService.createCategory(data));
    handle('inventory:updateCategory', (id, data) => inventoryService.updateCategory(id, data));
    handle('inventory:deleteCategory', (id) => inventoryService.deleteCategory(id));
}

module.exports = { registerHandlers };
