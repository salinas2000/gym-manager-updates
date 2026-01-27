const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class ExcelService {

    constructor() {
        this.templatePath = null;
    }

    getTemplatePath() {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'templates', 'routine_template.xlsx');
        } else {
            return path.join(__dirname, '../assets/templates/routine_template.xlsx');
        }
    }

    async generateRoutineExcel(mesocycle, destinationPath) {
        try {
            const templatePath = this.getTemplatePath();
            console.log('ExcelService: Loading template from', templatePath);

            if (!fs.existsSync(templatePath)) {
                throw new Error(`Template not found at ${templatePath}`);
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(templatePath);
            // 1. ANALYZE TEMPLATE STRUCTURE (on Source Sheet)
            // ... (keep scanning logic, but we need to adapt) ...
            // We'll scan sourceSheet, then copy to destSheet

            const sourceSheet = workbook.getWorksheet(1);

            // SCAN HEADERS (Same as before, simplified)
            let headerRowIndex = -1;
            let day1RowIndex = -1;
            let cols = { name: 2, series: 3, reps: 4, rpe: 5, tips: 11 };

            sourceSheet.eachRow((row, rowNumber) => {
                if (headerRowIndex === -1) {
                    let hasHeader = false;
                    row.eachCell((cell, colNumber) => {
                        const val = cell.value ? cell.value.toString().toUpperCase() : '';
                        if (val.includes('EJERCICIO') || val.includes('NOMBRE')) { cols.name = colNumber; hasHeader = true; }
                        else if (val.includes('SERIE')) { cols.series = colNumber; hasHeader = true; }
                        else if (val.includes('REPETICIONES') || val.includes('REPS')) { cols.reps = colNumber; hasHeader = true; }
                        else if (val.includes('INTENSIDAD') || val.includes('RPE')) { cols.rpe = colNumber; hasHeader = true; }
                        else if (val.includes('TIPS') || val.includes('NOTAS')) { cols.tips = colNumber; hasHeader = true; }
                    });
                    if (hasHeader) headerRowIndex = rowNumber;
                }
                const valA = row.getCell(1).value;
                if (valA && valA.toString().toUpperCase().includes('DIA 1') && day1RowIndex === -1) {
                    day1RowIndex = rowNumber;
                }
            });

            // DETERMINE IF MULTIPLE BLOCKS EXIST
            let detectedHeaders = [];
            sourceSheet.eachRow((row, rowNumber) => {
                const cell = row.getCell(cols.name);
                const val = cell.value ? cell.value.toString().toUpperCase() : '';
                if (val.includes('EJERCICIO') || val.includes('NOMBRE')) {
                    detectedHeaders.push(rowNumber);
                }
            });

            console.log('ExcelService: Detected header rows:', detectedHeaders);

            // Determine Limits of Block 1
            let startRow = headerRowIndex;
            let endRow = -1;
            let curr = headerRowIndex + 1;

            // Limit scan to next header or 50 rows
            const nextHeader = detectedHeaders.find(r => r > startRow) || (startRow + 50);

            while (curr < nextHeader) {
                const cell = sourceSheet.getCell(curr, cols.name);
                if (!cell.border && !cell.value) {
                    endRow = curr - 1;
                    break;
                }
                curr++;
            }
            if (endRow === -1) endRow = curr;

            const blockHeight = endRow - startRow + 1;
            const dataOffset = 1;
            const titleLabelOffset = (day1RowIndex !== -1 ? day1RowIndex : startRow) - startRow;
            const dataCapacity = blockHeight - dataOffset;

            console.log(`ExcelService: Block defined ${startRow}-${endRow}. Height ${blockHeight}. Headers found: ${detectedHeaders.length}`);

            // --- PRESERVE IMAGES: Use Original Sheet but NUKE Table Definitions ---
            // This prevents "Excel Repair" corruption when content changes
            if (sourceSheet.model) {
                delete sourceSheet.model.tables;
            }
            // Also try public API if available (though model usually suffices)
            try { sourceSheet.tables = {}; } catch (e) { }

            const sheet = sourceSheet; // Work directly on template
            sheet.name = 'Rutina';     // Rename it

            // 2. PREPARE EXPORT
            const days = mesocycle.routines || [];
            console.log(`ExcelService: Generating for ${days.length} days.`);

            // PHASE 1: BLOCK LOCATION STRATEGY
            let dayStartRows = [];

            if (detectedHeaders.length >= days.length) {
                // Scenario A: Template has enough blocks pre-defined
                console.log('ExcelService: Using existing blocks from template.');
                dayStartRows = detectedHeaders.slice(0, days.length);
            } else {
                // Scenario B: Need to clone more blocks
                console.log('ExcelService: Not enough blocks. Cloning mode.');
                dayStartRows = [...detectedHeaders];
                let insertPointer = rowsToCopy + 2; // Append at end

                // If we detected 1 header, start cloning from day 2
                // If we detected 2 headers, start cloning from day 3
                for (let i = detectedHeaders.length; i < days.length; i++) {
                    const currentBlockStart = insertPointer;
                    dayStartRows.push(currentBlockStart);

                    // Clone Block 1 to new position
                    for (let r = 0; r < blockHeight; r++) {
                        const srcRow = sheet.getRow(startRow + r);
                        const destRow = sheet.getRow(currentBlockStart + r);
                        destRow.height = srcRow.height;
                        for (let c = 1; c <= sheet.columnCount; c++) {
                            const srcCell = srcRow.getCell(c);
                            const destCell = destRow.getCell(c);
                            destCell.style = JSON.parse(JSON.stringify(srcCell.style));
                            destCell.value = srcCell.value;
                        }
                    }

                    // Clone merges for block
                    merges.forEach(rangeStr => {
                        try {
                            const [startAddr, endAddr] = rangeStr.split(':');
                            const startMatch = startAddr.match(/([A-Z]+)([0-9]+)/);
                            const endMatch = endAddr.match(/([A-Z]+)([0-9]+)/);
                            if (startMatch && endMatch) {
                                const startR = parseInt(startMatch[2]);
                                const endR = parseInt(endMatch[2]);
                                const startC = startMatch[1];
                                const endC = endMatch[1];
                                if (startR >= startRow && endR <= endRow) {
                                    const relStart = startR - startRow;
                                    const h = endR - startR;
                                    const destTop = currentBlockStart + relStart;
                                    const destBot = destTop + h;
                                    const c1 = sheet.getColumn(startC).number;
                                    const c2 = sheet.getColumn(endC).number;
                                    sheet.mergeCells(destTop, c1, destBot, c2);
                                }
                            }
                        } catch (e) { }
                    });

                    insertPointer += blockHeight + 2;
                }
            }

            // PHASE 2: FILL DATA (Top to Bottom)
            for (let i = 0; i < days.length; i++) {
                const dayData = days[i];
                const currentBlockStart = dayStartRows[i];

                const titleRow = currentBlockStart + titleLabelOffset;
                const titleCell = sheet.getCell(titleRow, 1);
                titleCell.value = (dayData.name || `DIA ${i + 1}`).toUpperCase();

                const actualDataStart = currentBlockStart + dataOffset;
                const items = dayData.items || [];

                let rowsAdded = 0;
                if (items.length > dataCapacity) {
                    rowsAdded = items.length - dataCapacity;
                    const splicePos = actualDataStart + dataCapacity;
                    sheet.spliceRows(splicePos, 0, ...Array(rowsAdded).fill(null));

                    const templateRow = sheet.getRow(splicePos - 1);
                    for (let r = 0; r < rowsAdded; r++) {
                        const newRow = sheet.getRow(splicePos + r);
                        newRow.height = templateRow.height;
                        for (let c = 1; c <= sheet.columnCount; c++) {
                            newRow.getCell(c).style = templateRow.getCell(c).style;
                        }
                    }

                    for (let j = i + 1; j < dayStartRows.length; j++) {
                        dayStartRows[j] += rowsAdded;
                    }
                }

                items.forEach((ex, idx) => {
                    const rowIdx = actualDataStart + idx;
                    const row = sheet.getRow(rowIdx);
                    if (cols.name) row.getCell(cols.name).value = ex.exercise_name || ex.name || '';
                    if (cols.series) row.getCell(cols.series).value = ex.series || '';
                    if (cols.reps) row.getCell(cols.reps).value = ex.reps || '';
                    if (cols.rpe) row.getCell(cols.rpe).value = ex.rpe || '';
                    if (cols.tips) row.getCell(cols.tips).value = ex.notes || '';
                });
            }

            // 5. SAVE
            if (!destinationPath) {
                const userDataPath = app.getPath('userData');
                const tempDir = path.join(userDataPath, 'temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const custName = (mesocycle.customer_name || 'Cliente').replace(/[^a-z0-9]/gi, '_');
                const mesoName = (mesocycle.name || 'Rutina').replace(/[^a-z0-9]/gi, '_');
                const filename = `Rutina_${custName}_${mesoName}_${Date.now()}.xlsx`;
                destinationPath = path.join(tempDir, filename);
            }

            await workbook.xlsx.writeFile(destinationPath);
            console.log('ExcelService: File saved to', destinationPath);

            return destinationPath;

        } catch (error) {
            console.error('ExcelService: Error generating routine:', error);
            throw error;
        }
    }
}

module.exports = new ExcelService();
