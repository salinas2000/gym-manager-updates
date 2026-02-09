const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class ExcelService {

    constructor() {
        this.templatePath = null;
    }

    getGymId() {
        try {
            const licenseService = require('../local/license.service');
            const data = licenseService.getLicenseData();
            return data ? data.gym_id : 'LOCAL_DEV';
        } catch (e) {
            return 'LOCAL_DEV';
        }
    }

    getTemplatePath() {
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');

        // Get gym-specific path
        const gymId = this.getGymId();
        const gymSpecificPath = path.join(app.getPath('userData'), 'templates', gymId, 'org_template.xlsx');

        console.log('[ExcelService] Looking for template at:', gymSpecificPath);

        if (fs.existsSync(gymSpecificPath)) {
            console.log('[ExcelService] ✓ Using gym-specific template:', gymSpecificPath);
            return gymSpecificPath;
        }

        // Fallback to legacy path (for backward compatibility)
        const legacyPath = path.join(app.getPath('userData'), 'templates', 'org_template.xlsx');
        if (fs.existsSync(legacyPath)) {
            console.log('[ExcelService] ⚠ Using legacy template:', legacyPath);
            return legacyPath;
        }

        throw new Error("⚠️ No hay ninguna plantilla activada. Por favor, crea una plantilla en el Diseñador de Plantillas.");
    }

    /**
     * Copia una fila entera y EXTIENDE el fondo hacia la derecha.
     */
    copyRow(sourceRow, targetRow, backgroundFill, tableWidth) {
        targetRow.height = sourceRow.height;

        // 0. APLICAR FONDO A TODA LA FILA PRIMERO
        if (backgroundFill) {
            for (let c = 1; c <= 50; c++) {
                const cell = targetRow.getCell(c);
                cell.fill = backgroundFill;
            }
        }

        // 1. Copiar celdas de la tabla (con sus estilos propios) - SOBRESCRIBE el fondo en celdas de tabla
        sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
            const targetCell = targetRow.getCell(colNumber);
            targetCell.value = sourceCell.value;

            if (sourceCell.style) targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
            if (sourceCell.fill) targetCell.fill = JSON.parse(JSON.stringify(sourceCell.fill));
            if (sourceCell.border) targetCell.border = JSON.parse(JSON.stringify(sourceCell.border));
            if (sourceCell.font) targetCell.font = JSON.parse(JSON.stringify(sourceCell.font));
        });

        targetRow.commit();
    }

    applyTextFormat(cell) {
        if (!cell) return;
        if (!cell.alignment) cell.alignment = {};
        cell.alignment.horizontal = 'center';
        cell.alignment.vertical = 'middle';
        cell.alignment.wrapText = true;

        if (!cell.font) cell.font = { name: 'Arial', size: 10 };
        cell.font.bold = true;
    }

    async generateRoutineExcel(mesocycle, destinationPath) {
        try {
            const templatePath = this.getTemplatePath();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(templatePath);

            const sourceSheet = workbook.getWorksheet(1);
            if (!sourceSheet) throw new Error('Plantilla inválida.');

            // 1. LOAD TEMPLATE CONFIG TO GET COLUMN MAPPING
            console.log('[ExcelService] Loading template config...');
            const templateService = require('../local/template.service');
            const templateInfo = await templateService.getInfo();
            const templateConfig = templateInfo.currentConfig || {};
            console.log('[ExcelService] Template config loaded:', {
                hasFixedColumns: !!templateConfig.fixedColumns,
                fixedColumnsCount: templateConfig.fixedColumns?.length || 0,
                hasOptionalColumns: !!templateConfig.optionalColumns,
                optionalColumnsCount: templateConfig.optionalColumns?.length || 0,
                templateName: templateConfig.name,
                lastUpdated: templateInfo.lastUpdated
            });

            // Build column mapping from template configuration
            let cols = {};
            let colIndex = 2; // Start at column 2 (column 1 is day label)

            // Map fixed columns
            if (templateConfig.fixedColumns && Array.isArray(templateConfig.fixedColumns)) {
                templateConfig.fixedColumns.forEach(col => {
                    cols[col.key] = colIndex++;
                });
                console.log('[ExcelService] Mapped fixed columns:', Object.keys(cols));
            }

            // Map optional columns (only enabled ones)
            if (templateConfig.optionalColumns && Array.isArray(templateConfig.optionalColumns)) {
                const enabledOptional = templateConfig.optionalColumns.filter(col => col.enabled === true);
                enabledOptional.forEach(col => {
                    cols[col.key] = colIndex++;
                });
                console.log('[ExcelService] Mapped optional columns (enabled only):', enabledOptional.map(c => c.key));
            }

            console.log('[ExcelService] Final column mapping:', cols);

            // Fallback: Detect headers dynamically if no config found
            if (Object.keys(cols).length === 0) {
                console.warn('[ExcelService] No template config found, falling back to dynamic detection');
                let headerRowIndex = -1;

                sourceSheet.eachRow((row, rowNumber) => {
                    if (headerRowIndex === -1) {
                        let hasHeader = false;
                        row.eachCell((cell, colNumber) => {
                            const val = cell.value ? cell.value.toString().toUpperCase() : '';
                            if (val.includes('EJERCICIO') || val.includes('NOMBRE')) { cols.name = colNumber; hasHeader = true; }
                            else if (val.includes('SERIE')) { cols.series = colNumber; hasHeader = true; }
                            else if (val.includes('REPS')) { cols.reps = colNumber; hasHeader = true; }
                            else if (val) {
                                // Dynamic field detection: Store by label key
                                const dynamicKey = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                                cols[dynamicKey] = colNumber;
                                hasHeader = true;
                            }
                        });
                        if (hasHeader) headerRowIndex = rowNumber;
                    }
                });
            }

            // Find header row (first row with data after title/logo area)
            // Start searching from row 9 onwards (rows 1-6 are logo, row 7 is title, row 8 is client)
            let headerRowIndex = -1;
            sourceSheet.eachRow((row, rowNumber) => {
                if (headerRowIndex === -1 && rowNumber >= 9) {
                    row.eachCell((cell) => {
                        const val = cell.value ? cell.value.toString().toUpperCase() : '';
                        if (val.includes('EJERCICIO') || val.includes('SERIES') || val.includes('REPS')) {
                            headerRowIndex = rowNumber;
                            console.log('[ExcelService] ✓ Header row detected at:', rowNumber);
                        }
                    });
                }
            });

            if (headerRowIndex === -1) {
                console.error('[ExcelService] ❌ No header row found');
                throw new Error('No se detectó cabecera en el template.');
            }

            // 2. DETECCIÓN DE BLOQUE
            let endRow = -1;
            let curr = headerRowIndex + 1;
            let consecutiveEmpty = 0;
            const maxSearch = headerRowIndex + 40;

            while (curr < maxSearch) {
                const cell = sourceSheet.getCell(curr, cols.name);
                const val = cell.value ? cell.value.toString().toUpperCase() : '';
                if (val.includes('EJERCICIO')) { endRow = curr - 1; break; }

                const hasBorder = cell.border && (cell.border.top || cell.border.bottom);
                if (!cell.value && !hasBorder) consecutiveEmpty++;
                else consecutiveEmpty = 0;

                if (consecutiveEmpty >= 2) { endRow = curr - 2; break; }
                curr++;
            }
            if (endRow === -1) endRow = curr - consecutiveEmpty;

            const blockStart = headerRowIndex;
            const blockEnd = endRow;
            const blockHeight = blockEnd - blockStart + 1;
            const templateCapacity = blockHeight - 1;
            const standardDataRowIndex = blockStart + 1;

            console.log('[ExcelService] Block detection:', {
                blockStart,
                blockEnd,
                blockHeight,
                templateCapacity
            });

            // 3. GET BACKGROUND FROM TEMPLATE CONFIG
            console.log('[ExcelService] Getting background from template config...');

            // Get separator row reference for later use
            let separatorRefRowIndex = headerRowIndex - 1;
            if (separatorRefRowIndex < 1) separatorRefRowIndex = blockEnd + 1;
            const separatorRefRow = sourceSheet.getRow(separatorRefRowIndex);

            let globalBackgroundFill = null;

            // Use background color from template configuration
            if (templateConfig.colors?.backgroundColor) {
                let bgColor = templateConfig.colors.backgroundColor;
                // Normalize to ARGB format
                if (bgColor.startsWith('#')) {
                    bgColor = 'FF' + bgColor.substring(1);
                }
                globalBackgroundFill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: bgColor }
                };
                console.log('[ExcelService] ✓ Background from config:', bgColor);
            }

            // Fallback to default sepia if not in config
            if (!globalBackgroundFill) {
                console.warn('[ExcelService] ⚠ No background in config, using default sepia');
                globalBackgroundFill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEF3C7' } // Default sepia
                };
            }

            console.log('[ExcelService] Final background:', globalBackgroundFill);

            const tableWidth = Math.max(...Object.values(cols));


            // --- INICIO GENERACIÓN ---
            const targetSheet = workbook.addWorksheet('Rutina Final');
            let cursY = 1;

            // 4. COPIAR ANCHOS DE COLUMNA
            sourceSheet.columns.forEach((col, idx) => {
                const tCol = targetSheet.getColumn(idx + 1);
                tCol.width = col.width;
            });

            // 6. COPIAR HEADER SUPERIOR (rows 1 to blockStart-1)
            console.log('[ExcelService] Copying header rows 1 to', blockStart - 1);
            if (blockStart > 1) {
                for (let r = 1; r < blockStart; r++) {
                    const srcRow = sourceSheet.getRow(r);
                    const destRow = targetSheet.getRow(cursY);

                    // Copy row height
                    if (srcRow.height) {
                        destRow.height = srcRow.height;
                    }

                    this.copyRow(srcRow, destRow, globalBackgroundFill, tableWidth);

                    destRow.eachCell((cell) => {
                        if (cell.value && typeof cell.value === 'string') {
                            // Reemplazar CLIENTE
                            if (cell.value.includes('{{CUSTOMER_NAME}}')) {
                                cell.value = cell.value.replace('{{CUSTOMER_NAME}}', (mesocycle.customer_name || 'Cliente').toUpperCase());
                            }
                        }
                    });
                    cursY++;
                }
                // Merges
                console.log('[ExcelService] Copying merged cells...');
                if (sourceSheet.model.merges) {
                    sourceSheet.model.merges.forEach(rangeStr => {
                        const endMatch = rangeStr.split(':')[1].match(/(\d+)$/);
                        if (endMatch && parseInt(endMatch[1]) < blockStart) {
                            targetSheet.mergeCells(rangeStr);
                            console.log('[ExcelService] ✓ Merged:', rangeStr);
                        }
                    });
                }
            }

            // 6.5 COPIAR IMÁGENES (Logo)
            try {
                const images = workbook.model.media;
                console.log('[ExcelService] Total images in workbook:', images?.length || 0);

                if (images && images.length > 0) {
                    images.forEach((media, idx) => {
                        try {
                            const imageId = workbook.addImage({
                                base64: media.buffer.toString('base64'),
                                extension: media.extension || 'png'
                            });

                            // Fixed size: 3cm x 3cm (113 pixels) - square logo
                            targetSheet.addImage(imageId, {
                                tl: { col: 0, row: 0, colOff: 10, rowOff: 10 },
                                ext: { width: 113, height: 113 },
                                editAs: 'oneCell'
                            });
                            console.log('[ExcelService] ✓ Logo copied successfully');
                        } catch (err) {
                            console.error('[ExcelService] Error copying image:', err);
                        }
                    });
                }
            } catch (err) {
                console.error('[ExcelService] Error accessing images:', err);
            }

            // 7. GENERAR DÍAS
            const days = mesocycle.routines || [];

            for (let i = 0; i < days.length; i++) {
                const dayData = days[i];
                const items = dayData.items || [];
                const neededRows = Math.max(items.length, templateCapacity);
                const currentBlockStart = cursY;

                // A. CABECERA
                const srcHeaderRow = sourceSheet.getRow(blockStart);
                const destHeaderRow = targetSheet.getRow(cursY);
                this.copyRow(srcHeaderRow, destHeaderRow, globalBackgroundFill, tableWidth);

                Object.values(cols).forEach(c => {
                    if (c !== -1) this.applyTextFormat(destHeaderRow.getCell(c));
                });
                cursY++;

                // B. DATOS
                for (let j = 0; j < neededRows; j++) {
                    let srcRowIdx = blockStart + 1 + j;
                    if (srcRowIdx >= blockEnd) srcRowIdx = standardDataRowIndex;

                    const srcRow = sourceSheet.getRow(srcRowIdx);
                    const destRow = targetSheet.getRow(cursY);

                    this.copyRow(srcRow, destRow, globalBackgroundFill, tableWidth);

                    const ex = items[j];
                    if (ex) {
                        // Parse custom_fields if it's a string
                        const customFields = typeof ex.custom_fields === 'string'
                            ? JSON.parse(ex.custom_fields)
                            : (ex.custom_fields || ex.customFields || {});

                        // Fill ALL columns based on mapping
                        Object.keys(cols).forEach(key => {
                            const colNum = cols[key];
                            if (colNum === undefined || colNum === -1) return;

                            let value = '';

                            // Fixed columns with direct properties
                            if (key === 'name') {
                                value = ex.exercise_name || ex.name || '';
                            } else if (key === 'series') {
                                value = ex.series || customFields.series || '';
                            } else if (key === 'reps') {
                                value = ex.reps || customFields.reps || '';
                            }
                            // All other columns: look in custom_fields by field_key
                            else {
                                value = customFields[key] || '';
                            }

                            // Set cell value
                            if (destRow.getCell(colNum)) {
                                destRow.getCell(colNum).value = value;
                            }
                        });
                    } else {
                        destRow.eachCell((cell) => { if (typeof cell.value === 'string') cell.value = ''; });
                    }

                    Object.values(cols).forEach(c => {
                        if (c !== -1) this.applyTextFormat(destRow.getCell(c));
                    });

                    cursY++;
                }

                // C. TÍTULO LATERAL (Day Label)
                try {
                    const srcTitle = sourceSheet.getCell(blockStart, 1);
                    console.log('[ExcelService] Source day cell fill:', srcTitle.fill);
                    console.log('[ExcelService] Source day cell font:', srcTitle.font);

                    // Get colors from template configuration (more reliable than reading from cells)
                    let dayFill, dayFont;

                    if (templateConfig.colors?.dayLabelColor) {
                        let bgColor = templateConfig.colors.dayLabelColor;
                        // Normalize to ARGB format
                        if (bgColor.startsWith('#')) {
                            bgColor = 'FF' + bgColor.substring(1);
                        }
                        dayFill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: bgColor }
                        };
                        console.log('[ExcelService] Day fill from config:', bgColor);
                    } else if (srcTitle.fill && srcTitle.fill.fgColor) {
                        // Fallback to reading from source cell
                        dayFill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: srcTitle.fill.fgColor.argb }
                        };
                        console.log('[ExcelService] Day fill from source cell');
                    } else {
                        // Last resort: default color
                        dayFill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF334155' } // Default slate color
                        };
                        console.log('[ExcelService] Day fill using default');
                    }

                    if (templateConfig.colors?.dayLabelTextColor) {
                        let textColor = templateConfig.colors.dayLabelTextColor;
                        if (textColor.startsWith('#')) {
                            textColor = 'FF' + textColor.substring(1);
                        }
                        dayFont = {
                            name: 'Arial',
                            size: 10,
                            bold: true,
                            color: { argb: textColor }
                        };
                        console.log('[ExcelService] Day font from config:', textColor);
                    } else if (srcTitle.font && srcTitle.font.color) {
                        dayFont = {
                            name: srcTitle.font.name || 'Arial',
                            size: srcTitle.font.size || 10,
                            bold: true,
                            color: { argb: srcTitle.font.color.argb }
                        };
                        console.log('[ExcelService] Day font from source cell');
                    } else {
                        dayFont = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                        console.log('[ExcelService] Day font using default');
                    }

                    // Apply fill and font to ALL cells in the range BEFORE merging
                    for (let r = currentBlockStart; r < cursY; r++) {
                        const cell = targetSheet.getCell(r, 1);
                        cell.fill = dayFill;
                        cell.font = dayFont;
                    }

                    // Now merge the cells
                    targetSheet.mergeCells(currentBlockStart, 1, cursY - 1, 1);

                    // Set value, alignment, fill, font and border on the merged cell
                    const titleCell = targetSheet.getCell(currentBlockStart, 1);
                    titleCell.value = (dayData.name || `DÍA ${i + 1}`).toUpperCase();
                    titleCell.fill = dayFill;  // Reapply fill after merge
                    titleCell.font = dayFont;  // Reapply font after merge
                    titleCell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };

                    const visibleBorder = { style: 'thin', color: { argb: 'FF000000' } };
                    titleCell.border = { top: visibleBorder, left: visibleBorder, bottom: visibleBorder, right: visibleBorder };

                    console.log('[ExcelService] Day label created:', titleCell.value, 'with fill:', dayFill, 'font:', dayFont);
                } catch (e) {
                    console.error('[ExcelService] Error creating day label:', e);
                }

                // D. SEPARADOR
                const spacerRow = targetSheet.getRow(cursY);
                spacerRow.height = separatorRefRow.height || 15;

                const paintLimit = 50;
                for (let c = 1; c <= paintLimit; c++) {
                    const cell = spacerRow.getCell(c);
                    cell.value = '';
                    cell.border = null;
                    if (globalBackgroundFill) cell.fill = globalBackgroundFill;
                }

                cursY++;
            }

            // 8. EXTENSIÓN INFINITA HACIA ABAJO
            if (globalBackgroundFill) {
                const bottomLimit = cursY + 100;
                const rightLimit = 50;
                for (let r = cursY; r < bottomLimit; r++) {
                    const row = targetSheet.getRow(r);
                    for (let c = 1; c <= rightLimit; c++) {
                        const cell = row.getCell(c);
                        cell.fill = globalBackgroundFill;
                        cell.border = null;
                    }
                }
            }

            workbook.removeWorksheet(sourceSheet.id);

            if (!destinationPath) {
                const tempDir = path.join(app.getPath('userData'), 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const cleanName = (mesocycle.customer_name || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `Rutina_${cleanName}_${Date.now()}.xlsx`;
                destinationPath = path.join(tempDir, filename);
            }

            await workbook.xlsx.writeFile(destinationPath);
            return destinationPath;

        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

module.exports = new ExcelService();