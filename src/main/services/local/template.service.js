const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const dbManager = require('../../db/database');
const BaseService = require('../BaseService');

class TemplateService extends BaseService {

    constructor() {
        super(); // Call parent constructor
        this.defaultConfig = {
            colors: {
                primary: 'FF000000', // Black
                accent: 'FFDAA520',  // Gold
                text: 'FFFFFFFF',    // White
                headerText: 'FFFFFFFF'
            },
            font: 'Calibri',
            logoPath: null,
            includeWatermark: false
        };
    }

    get db() {
        return dbManager.getInstance();
    }

    // FIX: Removed DUPLICATE getGymId() methods - now inherited from BaseService

    /**
     * Helper to read image as Base64 safely.
     */
    _readImageAsBase64(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase().replace('.', '');
                const mime = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream');
                const data = fs.readFileSync(filePath, 'base64');
                return `data:${mime};base64,${data}`;
            }
        } catch (e) {
            console.warn('[TemplateService] Failed to read logo image:', e.message);
        }
        return null;
    }

    /**
     * Helper to get storage directories for the current gym.
     */
    _getPaths() {
        const gymId = this.getGymId();
        const baseDir = path.join(app.getPath('userData'), 'templates', gymId);
        const historyDir = path.join(baseDir, 'history');
        if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

        return {
            baseDir,
            historyDir,
            templatePath: path.join(baseDir, 'org_template.xlsx'),
            configPath: path.join(baseDir, 'template_config.json')
        };
    }

    /**
     * Retrieves information about the current saved template and history.
     */
    async getInfo() {
        const { baseDir, historyDir, templatePath, configPath } = this._getPaths();

        console.log('[TemplateService] getInfo called. Reading history from:', historyDir);

        let history = [];
        if (fs.existsSync(historyDir)) {
            try {
                history = fs.readdirSync(historyDir)
                    .filter(f => f.endsWith('.json'))
                    .map(f => {
                        const filePath = path.join(historyDir, f);
                        const stats = fs.statSync(filePath);
                        let name = null;
                        try {
                            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            name = content.name;
                        } catch (e) {
                            console.error(`[TemplateService] Error reading config file ${f}:`, e);
                        }

                        return {
                            filename: f,
                            date: stats.mtime,
                            name: name // Return the name found in the file
                        };
                    })
                    .sort((a, b) => b.date - a.date);
                console.log(`[TemplateService] Found ${history.length} history items.`);
            } catch (err) {
                console.error('[TemplateService] Error reading history dir:', err);
            }
        } else {
            console.log('[TemplateService] History directory not found.');
        }

        const stats = fs.existsSync(templatePath) ? fs.statSync(templatePath) : null;
        let currentConfig = null;
        if (fs.existsSync(configPath)) {
            try {
                currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) { }
        }

        return {
            exists: !!stats,
            lastUpdated: stats ? stats.mtime : null,
            history: history.slice(0, 10), // Last 10
            currentConfig,
            activeFilename: currentConfig?.historyFilename || null
        };
    }

    /**
     * Delete a specific config from history
     */
    async deleteConfig(filename) {
        if (!filename) throw new Error('Filename required');
        const { historyDir } = this._getPaths();
        const target = path.join(historyDir, filename);
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            return true;
        }
        return false;
    }

    /**
     * Loads a specific config from history or current.
     */
    async loadConfig(filename) {
        const { historyDir, configPath } = this._getPaths();
        const target = filename
            ? path.join(historyDir, filename)
            : configPath;

        if (!fs.existsSync(target)) throw new Error('Config file not found');
        const config = JSON.parse(fs.readFileSync(target, 'utf8'));

        return config;
    }

    /**
     * Helper to normalize hex to ARGB (FF + Hex)
     * Handles #RRGGBB -> FFRRGGBB
     */
    _normalizeArgb(hex) {
        if (!hex) return 'FFFFFFFF'; // Default White
        let clean = hex.replace('#', '');
        if (clean.length === 6) {
            return 'FF' + clean;
        }
        return clean;
    }

    /**
     * Helper to generate the actual Excel file locally.
     */
    async _generateExcelFile(config, outputPath) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Routine Template', {
            views: [{ showGridLines: false }]
        });

        const styles = {
            primary: this._normalizeArgb(config.colors?.primary || '#1E293B'),
            accent: this._normalizeArgb(config.colors?.accent || '#10B981'),  // Emerald 500
            background: this._normalizeArgb(config.colors?.backgroundColor || config.backgroundColor || '#f8fafc'),
            // Title area colors
            titleBackgroundColor: this._normalizeArgb(config.colors?.titleBackgroundColor || '#1E293B'),
            titleColor: this._normalizeArgb(config.colors?.titleColor || '#FFFFFF'),
            // Table header colors
            headerColor: this._normalizeArgb(config.colors?.headerColor || '#FFFFFFFF'),
            // Day label colors
            dayLabelColor: this._normalizeArgb(config.colors?.dayLabelColor || config.colors?.primary || '#334155'),
            dayLabelTextColor: this._normalizeArgb(config.colors?.dayLabelTextColor || '#FFFFFFFF'),
            // Font configuration
            fonts: {
                title: { family: config.fonts?.title?.family || 'Calibri', size: config.fonts?.title?.size || 24 },
                header: { family: config.fonts?.header?.family || 'Calibri', size: config.fonts?.header?.size || 12 },
                body: { family: config.fonts?.body?.family || 'Calibri', size: config.fonts?.body?.size || 10 },
                dayLabel: { family: config.fonts?.dayLabel?.family || 'Calibri', size: config.fonts?.dayLabel?.size || 10 }
            }
        };

        // 1. SETUP COLUMNS (Dynamic Structure from Designer)
        let colDefinitions = [];

        // Support new format (fixedColumns + optionalColumns)
        if (config.fixedColumns && Array.isArray(config.fixedColumns)) {
            // Day label column (always first)
            colDefinitions.push({
                header: '',
                key: 'day',
                width: 5 // Column width for day label in Excel
            });

            // Add fixed columns (always visible, in configured order)
            const fixed = config.fixedColumns.filter(c => c.enabled !== false);
            colDefinitions.push(...fixed.map(c => ({
                header: c.label.toUpperCase(),
                key: c.key,
                width: c.width || 12
            })));

            // Add optional columns (only if enabled, in configured order)
            if (config.optionalColumns && Array.isArray(config.optionalColumns)) {
                const optional = config.optionalColumns.filter(c => c.enabled === true);
                colDefinitions.push(...optional.map(c => ({
                    header: c.label.toUpperCase(),
                    key: c.key,
                    width: c.width || 12
                })));
            }

        } else {
            // FALLBACK: Legacy Logic
            console.warn('[TemplateService] Using legacy column logic (no fixed/optional props found)');
            colDefinitions = [
                { header: '', key: 'day', width: 6 },
                { header: 'EJERCICIO', key: 'name', width: 40 },
                { header: 'SERIES', key: 'series', width: 10 },
                { header: 'REPS', key: 'reps', width: 10 },
                { header: 'RPE', key: 'rpe', width: 10 },
            ];

            // Mandatory Fields from DB
            try {
                const mandatoryFields = this.db.prepare('SELECT * FROM exercise_field_config WHERE is_mandatory_in_template = 1 AND is_active = 1 AND is_deleted = 0').all();
                mandatoryFields.forEach(field => {
                    const exists = colDefinitions.some(col => col.header.toUpperCase() === field.label.toUpperCase());
                    if (!exists) {
                        colDefinitions.push({
                            header: field.label.toUpperCase(),
                            key: field.field_key,
                            width: 12
                        });
                    }
                });
            } catch (e) { }

            if (config.visibleColumns?.rest) colDefinitions.push({ header: 'DESC.', key: 'rest', width: 10 });
            if (config.visibleColumns?.weight) colDefinitions.push({ header: 'PESO', key: 'weight', width: 12 });
            if (config.visibleColumns?.next) colDefinitions.push({ header: 'PROY.', key: 'next', width: 12 });

            if (config.customColumns) {
                config.customColumns.forEach(col => colDefinitions.push({ header: col.name.toUpperCase(), key: `cust_${col.id}`, width: 12 }));
            }
            colDefinitions.push({ header: 'TIPS / NOTAS', key: 'tips', width: 50 });
        }

        console.log('[TemplateService] Column definitions:', colDefinitions.map(c => ({ key: c.key, header: c.header, width: c.width })));

        // Apply Columns
        sheet.columns = colDefinitions.map(col => ({ width: col.width }));

        // 2. APPLY BACKGROUND TO ENTIRE SHEET FIRST (sepia color)
        for (let r = 1; r <= 100; r++) {
            const row = sheet.getRow(r);
            for (let c = 1; c <= 50; c++) {
                row.getCell(c).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: styles.background }
                };
            }
        }

        // 3. HEADER LAYOUT (ROBUSTO)
        // Row 1-4: Logo area with fixed size
        // Row 5: Title with background color
        // Row 6: Client info

        // 3.1 LOGO (Fixed size: 3cm x 3cm, top-left with margins)
        if (config.logo?.base64) {
            try {
                let base64Data = config.logo.base64;
                if (base64Data.includes('base64,')) {
                    base64Data = base64Data.split('base64,')[1];
                }

                const imageId = workbook.addImage({
                    base64: base64Data,
                    extension: 'png',
                });

                // Fixed size in pixels (3cm ≈ 113 pixels) - square logo
                // Position: top-left with small margin
                sheet.addImage(imageId, {
                    tl: { col: 0, row: 0, colOff: 10, rowOff: 10 },
                    ext: { width: 113, height: 113 },
                    editAs: 'oneCell'
                });
            } catch (e) {
                console.warn('[TemplateService] Error adding logo:', e.message);
            }
        }

        // 3.2 Apply title background to row 7 (all columns)
        const titleRow = sheet.getRow(7);
        titleRow.height = 30;
        for (let c = 1; c <= 50; c++) {
            const cell = titleRow.getCell(c);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: styles.titleBackgroundColor }
            };
        }

        // 3.3 TITLE (B7:H7 - row 7)
        sheet.mergeCells('B7:H7');
        const titleCell = sheet.getCell('B7');
        titleCell.value = 'RUTINA DE ENTRENAMIENTO';
        titleCell.font = {
            name: styles.fonts.title.family,
            size: styles.fonts.title.size,
            bold: true,
            color: { argb: styles.titleColor }
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // 3.4 CLIENT INFO (B8:H8 - row 8)
        const clientRow = sheet.getRow(8);
        clientRow.height = 18;
        sheet.mergeCells('B8:H8');
        const clientCell = sheet.getCell('B8');
        clientCell.value = 'CLIENTE: {{CUSTOMER_NAME}}';
        clientCell.font = {
            name: styles.fonts.body.family,
            size: 11,
            italic: true,
            color: { argb: 'FF64748B' }
        };
        clientCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // (Logo already inserted above in section 3.2)

        // 6. DAY BLOCKS GENERATION
        const rowSpacing = 1; // Fixed spacing between days

        const createDayBlock = (startRow, dayTitle) => {
            const dataRows = 6;
            const endRow = startRow + dataRows;

            // Day Label (Column A)
            const dayColIdx = colDefinitions.findIndex(c => c.key === 'day') + 1;
            console.log('[TemplateService] Day column index:', dayColIdx, 'for day:', dayTitle);

            if (dayColIdx > 0) {
                console.log('[TemplateService] Creating day label:', dayTitle, 'at rows', startRow, '-', endRow);
                console.log('[TemplateService] Day colors - fill:', styles.dayLabelColor, 'text:', styles.dayLabelTextColor);

                const fillStyle = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: styles.dayLabelColor }
                };

                const fontStyle = {
                    name: styles.fonts.dayLabel.family,
                    size: styles.fonts.dayLabel.size,
                    bold: true,
                    color: { argb: styles.dayLabelTextColor }
                };

                // Apply styles to ALL cells in the range BEFORE merging
                for (let r = startRow; r <= endRow; r++) {
                    const cell = sheet.getCell(r, dayColIdx);
                    cell.fill = fillStyle;
                    cell.font = fontStyle;
                }

                // Now merge the cells
                sheet.mergeCells(startRow, dayColIdx, endRow, dayColIdx);

                // Apply styles again to the merged cell
                const dayCell = sheet.getCell(startRow, dayColIdx);
                dayCell.value = dayTitle;
                dayCell.fill = fillStyle;
                dayCell.font = fontStyle;
                dayCell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };

                console.log('[TemplateService] Day label created');
            } else {
                console.warn('[TemplateService] Day column not found in colDefinitions!');
            }

            // Headers
            const headerRowIdx = startRow;
            const hRow = sheet.getRow(headerRowIdx);
            hRow.height = 30;

            // Apply background to entire header row first
            for (let c = 1; c <= 50; c++) {
                const bgCell = hRow.getCell(c);
                bgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styles.background } };
            }

            // Fill Headers (will override background for table columns)
            colDefinitions.forEach((col, i) => {
                const cIdx = i + 1;
                if (col.key === 'day') return; // Skip day col label

                const cell = sheet.getCell(headerRowIdx, cIdx);
                cell.value = col.header;
                cell.font = { name: styles.fonts.header.family, size: styles.fonts.header.size, bold: true, color: { argb: styles.headerColor } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styles.accent } };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (col.key === 'name' || col.key === 'tips') cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            });

            // Data Rows
            for (let r = startRow + 1; r <= endRow; r++) {
                // First, apply background to entire row (including beyond table)
                const row = sheet.getRow(r);
                for (let c = 1; c <= 50; c++) {
                    const bgCell = row.getCell(c);
                    bgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styles.background } };
                }

                // Then apply table styles to data columns (WHITE background)
                colDefinitions.forEach((col, i) => {
                    if (col.key === 'day') return;
                    const cIdx = i + 1;
                    const cell = sheet.getCell(r, cIdx);
                    // WHITE background for data cells
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                    // Thin Borders
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                    };
                    cell.font = { name: styles.fonts.body.family, size: styles.fonts.body.size, bold: true, color: { argb: 'FF1e293b' } };
                    cell.alignment = { vertical: 'middle' };
                    // Name column and text-based columns align left, others center
                    if (col.key === 'name' || col.type === 'text' || col.type === 'textarea' || col.type === 'url') {
                        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    } else {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            }
        };

        // Start day blocks at row 9 (logo rows 1-6, title row 7, client row 8)
        let cursor = 9;
        createDayBlock(cursor, 'DÍA 1');

        // No need to fill spacing - already done in step 2 (entire sheet background)
        const endOfDay1 = cursor + 6;
        cursor += 7 + rowSpacing;

        createDayBlock(cursor, 'DÍA 2');

        await workbook.xlsx.writeFile(outputPath);
    }

    /**
     * Activates a specific template from history (deploys it as org_template.xlsx)
     */
    async activateConfig(filename) {
        console.log('[TemplateService] Activating config:', filename);
        const config = await this.loadConfig(filename);
        const { templatePath, configPath } = this._getPaths();

        // Ensure historyFilename is set to the source file
        config.historyFilename = filename;

        await this._generateExcelFile(config, templatePath);

        // Optimization: Do NOT save the huge base64 string
        const configToSave = { ...config };
        delete configToSave.logoBase64;

        fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));

        return { success: true };
    }

    /**
     * Generates a new Excel Template based on user configuration.
     * Also saves to history and activates it.
     */
    async generateTemplate(config) {
        try {
            console.log('[TemplateService] ===== GENERATING NEW TEMPLATE =====');
            console.log('[TemplateService] Config received:', {
                name: config.name,
                hasFixedColumns: !!config.fixedColumns,
                fixedColumnsCount: config.fixedColumns?.length || 0,
                hasOptionalColumns: !!config.optionalColumns,
                optionalColumnsCount: config.optionalColumns?.length || 0,
                historyFilename: config.historyFilename
            });

            const { historyDir, templatePath, configPath } = this._getPaths();
            console.log('[TemplateService] Paths:', { historyDir, templatePath, configPath });

            // Determine History Path
            let historyPath;
            let finalFilename;
            if (config.historyFilename) {
                historyPath = path.join(historyDir, config.historyFilename);
                finalFilename = config.historyFilename;
                console.log('[TemplateService] Updating existing config:', finalFilename);
            } else {
                const timestamp = new Date().getTime();
                finalFilename = `config_${timestamp}.json`;
                historyPath = path.join(historyDir, finalFilename);
                console.log('[TemplateService] Creating new config:', finalFilename);
            }

            // Add proper filename to the config
            config.historyFilename = finalFilename;

            // Generate actual Excel
            console.log('[TemplateService] Generating Excel file at:', templatePath);
            await this._generateExcelFile(config, templatePath);
            console.log('[TemplateService] ✓ Excel file generated successfully');

            // Verify file was created
            if (!fs.existsSync(templatePath)) {
                throw new Error('Template file was not created at: ' + templatePath);
            }
            const stats = fs.statSync(templatePath);
            console.log('[TemplateService] ✓ Template file exists:', {
                size: stats.size,
                modified: stats.mtime
            });

            // Save Configs (Active + History) - Remove logo data before saving
            const configToSave = { ...config };
            delete configToSave.logoBase64;
            delete configToSave.logoPath;

            console.log('[TemplateService] Saving config files...');
            fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));
            console.log('[TemplateService] ✓ Active config saved');

            fs.writeFileSync(historyPath, JSON.stringify(configToSave, null, 2));
            console.log('[TemplateService] ✓ History config saved');

            console.log('[TemplateService] ===== TEMPLATE GENERATION COMPLETE =====');
            return { success: true, path: templatePath };
        } catch (error) {
            console.error('[TemplateService] ❌ ERROR GENERATING TEMPLATE:', error);
            throw error;
        }
    }
}

module.exports = new TemplateService();
