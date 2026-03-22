#!/usr/bin/env node
/**
 * Clear All Data - Borra todos los datos de la base de datos real
 *
 * Uso: node scripts/clear-all-data.js
 *      node scripts/clear-all-data.js --force  (sin confirmación)
 *
 * Borra TODOS los datos pero mantiene la estructura de tablas intacta.
 * Crea un backup automático antes de borrar.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

// --- Localizar la DB real de la app ---
const APP_NAME = 'gym-manager-pro';
const userDataPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, APP_NAME)
    : path.join(os.homedir(), '.config', APP_NAME);

const dbPath = path.join(userDataPath, 'gym_manager.db');

if (!fs.existsSync(dbPath)) {
    console.error('❌ No se encontró la base de datos en:', dbPath);
    console.error('   No hay nada que borrar.');
    process.exit(1);
}

async function confirmAction() {
    if (process.argv.includes('--force')) return true;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        console.log('\n⚠️  ATENCIÓN: Esto borrará TODOS los datos de la aplicación.');
        console.log('   Se creará un backup automático antes de proceder.\n');
        rl.question('   ¿Estás seguro? Escribe "BORRAR" para confirmar: ', (answer) => {
            rl.close();
            resolve(answer === 'BORRAR');
        });
    });
}

async function main() {
    const confirmed = await confirmAction();

    if (!confirmed) {
        console.log('\n❌ Operación cancelada.');
        process.exit(0);
    }

    // Backup antes de borrar
    const backupPath = dbPath.replace('.db', `.pre-clear-${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log('\n💾 Backup creado en:', backupPath);

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Desactivar foreign keys para poder borrar en cualquier orden
    db.pragma('foreign_keys = OFF');

    // Tablas a limpiar en orden (respetando dependencias)
    const tables = [
        'routine_items',
        'routines',
        'mesocycles',
        'file_history',
        'exercises',
        'exercise_subcategories',
        'exercise_categories',
        'exercise_field_config',
        'inventory_orders',
        'products',
        'product_categories',
        'payments',
        'memberships',
        'customers',
        'tariffs',
        'sync_deleted_log',
    ];

    console.log('\n🗑️  Borrando datos...\n');

    const clearAll = db.transaction(() => {
        for (const table of tables) {
            try {
                const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
                db.prepare(`DELETE FROM ${table}`).run();
                // Reset autoincrement
                db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
                console.log(`   ✅ ${table}: ${count.c} registros eliminados`);
            } catch (e) {
                console.log(`   ⚠️  ${table}: ${e.message}`);
            }
        }
    });

    clearAll();

    // Reactivar foreign keys
    db.pragma('foreign_keys = ON');

    // VACUUM para limpiar espacio
    db.exec('VACUUM');

    db.close();

    console.log('\n' + '='.repeat(50));
    console.log('✅ TODOS LOS DATOS HAN SIDO ELIMINADOS');
    console.log('='.repeat(50));
    console.log(`\n💾 Backup guardado en:\n   ${backupPath}`);
    console.log('\n   Para restaurar: copia el backup sobre gym_manager.db');
    console.log('   Para cargar datos de prueba: npm run db:seed');
    console.log('\nReinicia la aplicacion.');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
