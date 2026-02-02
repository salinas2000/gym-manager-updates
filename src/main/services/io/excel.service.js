const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class ExcelService {

    constructor() {
        this.templatePath = null;
    }

    getTemplatePath() {
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');

        const managedPath = path.join(app.getPath('userData'), 'templates', 'org_template.xlsx');
        if (fs.existsSync(managedPath)) {
            console.log('ExcelService: Using MANAGED template:', managedPath);
            return managedPath;
        }
        throw new Error("⚠️ No hay ninguna plantilla activada.");
    }

    /**
     * Copia una fila entera y EXTIENDE el fondo hacia la derecha.
     */
    copyRow(sourceRow, targetRow, backgroundFill, tableWidth) {
        targetRow.height = sourceRow.height;

        // 1. Copiar celdas de la tabla (con sus estilos propios)
        sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
            const targetCell = targetRow.getCell(colNumber);
            targetCell.value = sourceCell.value;

            if (sourceCell.style) targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
            if (sourceCell.fill) targetCell.fill = JSON.parse(JSON.stringify(sourceCell.fill));
            if (sourceCell.border) targetCell.border = JSON.parse(JSON.stringify(sourceCell.border));
            if (sourceCell.font) targetCell.font = JSON.parse(JSON.stringify(sourceCell.font));
        });

        // 2. EXTENSIÓN INFINITA A LA DERECHA
        // Pintamos desde la columna final de la tabla hasta la 50 con el color de fondo
        if (backgroundFill) {
            const extensionLimit = 50; // Hasta columna 50
            // Empezamos en la columna siguiente a la última con datos, o la 10 si no se detecta
            const startCol = (sourceRow.cellCount > 0 ? Math.max(sourceRow.cellCount, tableWidth) : tableWidth) + 1;

            for (let c = startCol; c <= extensionLimit; c++) {
                const cell = targetRow.getCell(c);
                cell.fill = backgroundFill;
                cell.border = null; // Sin bordes en el infinito
            }
        }

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

            // 1. DETECCIÓN DE CABECERA
            let headerRowIndex = -1;
            let cols = { name: 2, series: 3, reps: 4, rpe: 5, tips: -1, rest: -1, weight: -1, next: -1 };

            sourceSheet.eachRow((row, rowNumber) => {
                if (headerRowIndex === -1) {
                    let hasHeader = false;
                    row.eachCell((cell, colNumber) => {
                        const val = cell.value ? cell.value.toString().toUpperCase() : '';
                        if (val.includes('EJERCICIO') || val.includes('NOMBRE')) { cols.name = colNumber; hasHeader = true; }
                        else if (val.includes('SERIE')) { cols.series = colNumber; hasHeader = true; }
                        else if (val.includes('REPS')) { cols.reps = colNumber; hasHeader = true; }
                        else if (val.includes('RPE')) { cols.rpe = colNumber; hasHeader = true; }
                        else if (val.includes('TIPS')) { cols.tips = colNumber; hasHeader = true; }
                        else if (val.includes('REST')) { cols.rest = colNumber; hasHeader = true; }
                        else if (val.includes('PESO')) { cols.weight = colNumber; hasHeader = true; }
                        else if (val.includes('PROY')) { cols.next = colNumber; hasHeader = true; }
                    });
                    if (hasHeader) headerRowIndex = rowNumber;
                }
            });

            if (headerRowIndex === -1) throw new Error('No se detectó cabecera.');

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

            // 3. DETECCIÓN DE FONDO GLOBAL (Infinito)
            // Miramos la fila ENCIMA de la cabecera. Suele tener el color de fondo general.
            let separatorRefRowIndex = headerRowIndex - 1;
            if (separatorRefRowIndex < 1) separatorRefRowIndex = blockEnd + 1; // Fallback

            const separatorRefRow = sourceSheet.getRow(separatorRefRowIndex);

            let globalBackgroundFill = null;
            // Intentar leer el color de la primera celda
            const refCell = separatorRefRow.getCell(1);
            if (refCell && refCell.fill) globalBackgroundFill = JSON.parse(JSON.stringify(refCell.fill));

            // Ancho de tabla estimado (para saber dónde empezar a pintar el infinito)
            const tableWidth = Math.max(...Object.values(cols));


            // --- INICIO GENERACIÓN ---
            const targetSheet = workbook.addWorksheet('Rutina Final');
            let cursY = 1;

            // 4. COPIAR ANCHOS DE COLUMNA Y FONDO DE COLUMNA
            sourceSheet.columns.forEach((col, idx) => {
                const tCol = targetSheet.getColumn(idx + 1);
                tCol.width = col.width;
            });

            // 5. COPIAR IMÁGENES (SOLUCIÓN ROBUSTA)
            // A) Copiar imagen de fondo de hoja (Watermark)
            if (sourceSheet.backgroundImage) {
                targetSheet.backgroundImage = sourceSheet.backgroundImage;
            }

            // B) Copiar imágenes flotantes (Logos)
            const images = sourceSheet.getImages();
            if (images && images.length > 0) {
                images.forEach(image => {
                    // Copiamos TODAS las imágenes que estén por encima del bloque de datos
                    // nativeRow es base 0. blockStart es base 1.
                    if (image.range.tl.nativeRow < blockStart) {
                        try {
                            targetSheet.addImage(image.imageId, {
                                tl: image.range.tl,
                                br: image.range.br,
                                editAs: image.range.editAs || 'oneCell'
                            });
                        } catch (e) { console.warn('Error copiando logo:', e); }
                    }
                });
            }

            // 6. COPIAR HEADER SUPERIOR (Texto)
            if (blockStart > 1) {
                for (let r = 1; r < blockStart; r++) {
                    const srcRow = sourceSheet.getRow(r);
                    const destRow = targetSheet.getRow(cursY);
                    this.copyRow(srcRow, destRow, globalBackgroundFill, tableWidth); // Extensión lateral

                    destRow.eachCell((cell) => {
                        if (cell.value && typeof cell.value === 'string' && cell.value.includes('{{CUSTOMER_NAME}}')) {
                            cell.value = cell.value.replace('{{CUSTOMER_NAME}}', (mesocycle.customer_name || 'Cliente').toUpperCase());
                        }
                    });
                    cursY++;
                }
                // Merges
                if (sourceSheet.model.merges) {
                    sourceSheet.model.merges.forEach(rangeStr => {
                        const endMatch = rangeStr.split(':')[1].match(/(\d+)$/);
                        if (endMatch && parseInt(endMatch[1]) < blockStart) targetSheet.mergeCells(rangeStr);
                    });
                }
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
                        if (cols.name !== -1) destRow.getCell(cols.name).value = ex.exercise_name || ex.name || '';
                        if (cols.series !== -1) destRow.getCell(cols.series).value = ex.series || '';
                        if (cols.reps !== -1) destRow.getCell(cols.reps).value = ex.reps || '';
                        if (cols.rpe !== -1) destRow.getCell(cols.rpe).value = ex.rpe || '';
                        if (cols.tips !== -1) destRow.getCell(cols.tips).value = ex.notes || '';
                        if (cols.rest !== -1) destRow.getCell(cols.rest).value = ex.rest || '';
                        if (cols.weight !== -1) destRow.getCell(cols.weight).value = ex.weight || '';
                        if (cols.next !== -1) destRow.getCell(cols.next).value = ex.next_weight || '';
                    } else {
                        destRow.eachCell((cell) => { if (typeof cell.value === 'string') cell.value = ''; });
                    }

                    Object.values(cols).forEach(c => {
                        if (c !== -1) this.applyTextFormat(destRow.getCell(c));
                    });

                    cursY++;
                }

                // C. TÍTULO LATERAL
                try {
                    targetSheet.mergeCells(currentBlockStart, 1, cursY - 1, 1);
                    const titleCell = targetSheet.getCell(currentBlockStart, 1);

                    const srcTitle = sourceSheet.getCell(blockStart, 1);
                    if (srcTitle.style) titleCell.style = JSON.parse(JSON.stringify(srcTitle.style));
                    if (srcTitle.fill) titleCell.fill = JSON.parse(JSON.stringify(srcTitle.fill));

                    titleCell.value = (dayData.name || `DÍA ${i + 1}`).toUpperCase();
                    titleCell.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
                    titleCell.font = { name: 'Arial', size: 10, bold: true };

                    const visibleBorder = { style: 'thin', color: { argb: 'FF000000' } };
                    titleCell.border = { top: visibleBorder, left: visibleBorder, bottom: visibleBorder, right: visibleBorder };

                } catch (e) { }

                // D. SEPARADOR (Ahora con extensión infinita)
                const spacerRow = targetSheet.getRow(cursY);
                spacerRow.height = separatorRefRow.height || 15;

                // Pintar desde la columna 1 hasta la 50 con el color de fondo
                const paintLimit = 50;
                for (let c = 1; c <= paintLimit; c++) {
                    const cell = spacerRow.getCell(c);
                    cell.value = '';
                    cell.border = null;
                    if (globalBackgroundFill) cell.fill = globalBackgroundFill;
                }

                cursY++;
            }

            // 8. EXTENSIÓN INFINITA HACIA ABAJO (BOTTOM)
            // Pintamos 100 filas más abajo con el color de fondo
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
                const filename = `Rutina_${Date.now()}.xlsx`;
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