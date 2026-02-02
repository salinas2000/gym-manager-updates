const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class TemplateService {

    constructor() {
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

    /**
     * Retrieves information about the current saved template and history.
     */
    async getInfo() {
        const outputDir = path.join(app.getPath('userData'), 'templates');
        const historyDir = path.join(outputDir, 'history');
        const templatePath = path.join(outputDir, 'org_template.xlsx');
        const configPath = path.join(outputDir, 'template_config.json');

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
            currentConfig
        };
    }

    /**
     * Delete a specific config from history
     */
    async deleteConfig(filename) {
        if (!filename) throw new Error('Filename required');
        const target = path.join(app.getPath('userData'), 'templates', 'history', filename);
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
        const target = filename
            ? path.join(app.getPath('userData'), 'templates', 'history', filename)
            : path.join(app.getPath('userData'), 'templates', 'template_config.json');

        if (!fs.existsSync(target)) throw new Error('Config file not found');
        return JSON.parse(fs.readFileSync(target, 'utf8'));
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
            primary: config.colors?.primary || 'FF1E293B', // Slate 800
            accent: config.colors?.accent || 'FF10B981',  // Emerald 500
            background: config.backgroundColor || 'FFFFFFFF', // White default (Global)
            fontFamily: config.font || 'Calibri',
            // Detailed textual colors
            titleColor: config.colors?.titleColor || config.colors?.primary || 'FF1E293B',
            headerColor: config.colors?.headerColor || 'FFFFFFFF', // Default White for headers
            dayLabelColor: config.colors?.dayLabelColor || config.colors?.accent || 'FF10B981'
        };

        // Apply Global Background
        for (let r = 1; r <= 80; r++) {
            const row = sheet.getRow(r);
            for (let c = 1; c <= 20; c++) {
                row.getCell(c).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: styles.background.replace('#', '') }
                };
            }
        }

        // 1. SETUP COLUMNS (Dynamic Structure)
        const colDefinitions = [
            { header: '', key: 'day', width: 6 },             // A (Vertical Day Label)
            { header: 'EJERCICIO', key: 'name', width: 40 }, // B
            { header: 'SERIES', key: 'series', width: 10 },   // C
            { header: 'REPS', key: 'reps', width: 10 },       // D
            { header: 'RPE', key: 'rpe', width: 10 },         // E
        ];

        // Dynamic Columns
        if (config.visibleColumns?.rest) colDefinitions.push({ header: 'DESC.', key: 'rest', width: 10 });
        if (config.visibleColumns?.weight) colDefinitions.push({ header: 'PESO', key: 'weight', width: 12 });
        if (config.visibleColumns?.next) colDefinitions.push({ header: 'PROY.', key: 'next', width: 12 });

        if (config.customColumns) {
            config.customColumns.forEach(col => {
                colDefinitions.push({ header: col.name.toUpperCase(), key: `cust_${col.id}`, width: 12 });
            });
        }

        // Final Column: Tips/Notes (Taking the remaining space)
        colDefinitions.push({ header: 'TIPS / NOTAS', key: 'tips', width: 50 });

        sheet.columns = colDefinitions.map(col => ({ width: col.width }));

        // 2. LOGO
        if (config.logoPath && fs.existsSync(config.logoPath)) {
            try {
                const imageId = workbook.addImage({
                    filename: config.logoPath,
                    extension: path.extname(config.logoPath).replace('.', '')
                });
                sheet.addImage(imageId, {
                    tl: { col: 8, row: 0.5 },
                    ext: { width: 120, height: 60 }
                });
            } catch (e) {
                console.error('[TemplateService] Error embedding logo:', e);
            }
        }

        // 3. TITLE
        sheet.mergeCells('B2:E3');
        const titleCell = sheet.getCell('B2');
        titleCell.value = 'RUTINA DE ENTRENAMIENTO';
        titleCell.font = { name: styles.fontFamily, size: 24, bold: true, color: { argb: styles.titleColor.replace('#', '') } };
        titleCell.alignment = { vertical: 'middle' };

        // --- INFO ROW ---
        sheet.mergeCells('B4:C4');
        sheet.getCell('B4').value = 'CLIENTE: {{CUSTOMER_NAME}}';
        sheet.getCell('B4').font = { name: styles.fontFamily, size: 12, italic: true, color: { argb: 'FF64748B' } };

        // 4. DAY BLOCKS (Vertical Mode)
        const createDayBlock = (startRow, dayTitle) => {
            const dataRows = 6; // Initial empty rows
            const endRow = startRow + dataRows;

            // 4a. Vertical Day Label (Column A)
            // Merge A{startRow} : A{endRow}
            sheet.mergeCells(startRow, 1, endRow, 1);
            const dayCell = sheet.getCell(startRow, 1);
            dayCell.value = dayTitle; // "DÍA 1"
            dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styles.primary.replace('#', '') } };
            // Use specific day label text color (contrast against primary)
            const dayTextCol = 'FFFFFFFF'; // Force white for now as it's on Primary
            dayCell.font = { name: styles.fontFamily, size: 16, bold: true, color: { argb: dayTextCol } };
            dayCell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };

            // 4b. Horizontal Headers (Row = startRow)
            const headerRowIdx = startRow;
            const hRow = sheet.getRow(headerRowIdx);
            hRow.height = 30;

            // Build Active Columns List from Definitions (Skipping 'day')
            const activeCols = [];
            colDefinitions.forEach((def, i) => {
                if (def.key === 'day') return;
                activeCols.push({ idx: i + 1, ...def });
            });

            activeCols.forEach(col => {
                const cell = sheet.getCell(headerRowIdx, col.idx);
                cell.value = col.header;
                cell.font = { name: styles.fontFamily, size: 10, bold: true, color: { argb: styles.headerColor.replace('#', '') } };
                // Header Background (Accent)
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styles.accent.replace('#', '') } };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (col.key === 'name' || col.key === 'tips') cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            });

            // 4c. Data Rows (White Background + Borders)
            for (let r = startRow + 1; r <= endRow; r++) {
                activeCols.forEach(col => {
                    const c = col.idx;
                    const cell = sheet.getCell(r, c);
                    // Explicit White Background
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                    // Thin Borders
                    cell.border = {
                        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        right: { style: 'dotted', color: { argb: 'FFCBD5E1' } }
                    };
                    cell.font = { name: styles.fontFamily, size: 11 };
                    cell.alignment = { vertical: 'middle' };
                    if (col.key !== 'name' && col.key !== 'tips') cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            }
        };

        createDayBlock(6, 'DÍA 1');
        createDayBlock(14, 'DÍA 2');

        await workbook.xlsx.writeFile(outputPath);
    }

    /**
     * Activates a specific template from history (deploys it as org_template.xlsx)
     */
    async activateConfig(filename) {
        console.log('[TemplateService] Activating config:', filename);
        const config = await this.loadConfig(filename);
        const outputDir = path.join(app.getPath('userData'), 'templates');
        const outputPath = path.join(outputDir, 'org_template.xlsx');
        const configPath = path.join(outputDir, 'template_config.json');

        // Ensure historyFilename is set to the source file
        config.historyFilename = filename;

        await this._generateExcelFile(config, outputPath);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        return { success: true };
    }

    /**
     * Generates a new Excel Template based on user configuration.
     * Also saves to history and activates it.
     */
    async generateTemplate(config) {
        console.log('[TemplateService] Generating new template...', config);

        const outputDir = path.join(app.getPath('userData'), 'templates');
        const historyDir = path.join(outputDir, 'history');
        if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

        // Determine History Path
        let historyPath;
        let finalFilename;
        if (config.historyFilename) {
            historyPath = path.join(historyDir, config.historyFilename);
            finalFilename = config.historyFilename;
        } else {
            const timestamp = new Date().getTime();
            finalFilename = `config_${timestamp}.json`;
            historyPath = path.join(historyDir, finalFilename);
        }

        // Add proper filename to the config
        config.historyFilename = finalFilename;

        // Paths for "Active" files
        const outputPath = path.join(outputDir, 'org_template.xlsx');
        const configPath = path.join(outputDir, 'template_config.json');

        // Generate actual Excel
        await this._generateExcelFile(config, outputPath);

        // Save Configs (Active + History)
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        fs.writeFileSync(historyPath, JSON.stringify(config, null, 2));

        return { success: true, path: outputPath };
    }
}

module.exports = new TemplateService();
