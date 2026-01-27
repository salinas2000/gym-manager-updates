const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function scan() {
    const templatePath = path.join(__dirname, '../src/main/assets/templates/routine_template.xlsx');
    if (!fs.existsSync(templatePath)) {
        console.error('Template not found at', templatePath);
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.getWorksheet(1);

    console.log('Scanning template...');
    sheet.eachRow((row, rowNum) => {
        row.eachCell((cell, colNum) => {
            if (cell.value) {
                const val = cell.value.toString().toUpperCase();
                if (val.includes('DIA ') || val.includes('DAY ') || val.includes('DÍA')) {
                    console.log(`Found Label "${val}" at Row ${rowNum}, Col ${colNum}`);
                }
                if (val.includes('EJERCICIOS') || val.includes('NOMBRE DEL EJERCICIO')) {
                    console.log(`Found Header "${val}" at Row ${rowNum}, Col ${colNum}`);
                }
            }
        });
    });
}

scan().catch(console.error);
