const fs = require('fs');
const path = require('path');

function walk(dir, results = []) {
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            walk(filePath, results);
        } else {
            if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) results.push(filePath);
        }
    });
    return results;
}

const files = walk('src/renderer');
let errors = 0;

console.log(`Scanning ${files.length} files for broken imports...`);

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        const match = line.match(/from ['"](\..+)['"]/);
        if (match) {
            const importPath = match[1];
            const dir = path.dirname(file);
            let resolvedPath = path.join(dir, importPath);

            // Try extensions
            const extensions = ['', '.js', '.jsx', '/index.js', '/index.jsx'];
            let found = false;
            for (const ext of extensions) {
                if (fs.existsSync(resolvedPath + ext)) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.error(`[MISSING] ${file}:${index + 1}`);
                console.error(`   Import: ${importPath}`);
                console.error(`   Resolved: ${resolvedPath}`);
                errors++;
            }
        }
    });
});

if (errors === 0) {
    console.log("✅ All relative imports appear valid.");
} else {
    console.log(`❌ Found ${errors} broken imports.`);
}
