const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function testStart() {
    try {
        const templatePath = path.join(__dirname, '../src/main/assets/templates/routine_template.xlsx');
        console.log('Loading template from:', templatePath);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const sheet = workbook.getWorksheet(1);

        // 1. INDEPENDENT SCANS
        let headerRowIndex = -1;
        let day1RowIndex = -1;
        const cols = { name: 2, series: 3, reps: 4, rpe: 5, tips: 11 };

        sheet.eachRow((row, rowNumber) => {
            // Check for Headers
            if (headerRowIndex === -1) {
                let isHeader = false;
                row.eachCell((cell, colNumber) => {
                    const val = cell.value ? cell.value.toString().toUpperCase() : '';
                    if (val.includes('EJERCICIOS') || val.includes('NOMBRE')) { cols.name = colNumber; isHeader = true; }
                });
                if (isHeader) headerRowIndex = rowNumber;
            }

            // Check for DIA 1
            const valA = row.getCell(1).value;
            if (valA && valA.toString().toUpperCase().includes('DIA 1')) {
                day1RowIndex = rowNumber;
            }
        });

        console.log(`Scan Results: Headers @ ${headerRowIndex}, DIA 1 @ ${day1RowIndex}`);

        if (headerRowIndex === -1) throw new Error("Headers not found");

        // Define Block
        // Block Start = Header Row (we assume top of table)
        const blockStart = headerRowIndex;

        // Block End = End of grid lines/border
        let blockEnd = -1;
        let curr = blockStart + 1;
        while (curr < blockStart + 50) {
            const cell = sheet.getCell(curr, cols.name);
            if (!cell.border && !cell.value) {
                blockEnd = curr - 1;
                break;
            }
            curr++;
        }
        if (blockEnd === -1) blockEnd = curr;

        console.log(`Block defined: ${blockStart} to ${blockEnd}`);

        // Offsets
        const titleOffset = (day1RowIndex !== -1 ? day1RowIndex : blockStart) - blockStart;
        const dataOffset = 1; // Data starts immediately after header

        const blockHeight = blockEnd - blockStart + 1;

        // 2. CLONE (Day 2)
        const destStart = blockEnd + 2;
        console.log(`Cloning Day 2 to ${destStart}`);

        // A. Copy Rows
        for (let r = 0; r < blockHeight; r++) {
            const srcRow = sheet.getRow(blockStart + r);
            const destRow = sheet.getRow(destStart + r);
            destRow.height = srcRow.height;
            for (let c = 1; c <= sheet.columnCount; c++) {
                const srcCell = srcRow.getCell(c);
                const destCell = destRow.getCell(c);
                destCell.style = JSON.parse(JSON.stringify(srcCell.style));
                destCell.value = srcCell.value;
            }
        }

        // B. Merges
        const merges = sheet.model.merges || [];
        for (const rangeStr of merges) {
            const [s, e] = rangeStr.split(':');
            const matchS = s.match(/([A-Z]+)([0-9]+)/);
            const matchE = e.match(/([A-Z]+)([0-9]+)/);
            if (matchS && matchE) {
                const sR = parseInt(matchS[2]);
                const eR = parseInt(matchE[2]);
                if (sR >= blockStart && eR <= blockEnd) {
                    const relS = sR - blockStart;
                    const height = eR - sR;
                    const dTop = destStart + relS;
                    const dBot = dTop + height;
                    const cS = sheet.getColumn(matchS[1]).number;
                    const cE = sheet.getColumn(matchE[1]).number;
                    sheet.mergeCells(dTop, cS, dBot, cE);
                }
            }
        }

        // 3. FILL DATA (Day 2)
        // Title
        const titleCell = sheet.getCell(destStart + titleOffset, 1);
        titleCell.value = 'DIA 2 TEST';

        // Data
        const dRow = sheet.getRow(destStart + dataOffset);
        dRow.getCell(cols.name).value = 'Exercise Test';

        const out = path.join(__dirname, 'debug_fix.xlsx');
        await workbook.xlsx.writeFile(out);
        console.log('Saved', out);

    } catch (e) { console.error(e); }
}
testStart();
