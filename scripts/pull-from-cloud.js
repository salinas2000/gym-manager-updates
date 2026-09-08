#!/usr/bin/env node
/**
 * Pull From Cloud — reconstruye el SQLite local a partir de las tablas cloud_*
 * del gimnasio.
 *
 * La sincronizacion normal es de UN SOLO SENTIDO (escritorio -> nube): el
 * escritorio es la fuente de verdad. Eso deja un hueco real: si cambias de PC,
 * reinstalas o pierdes la base local, no hay forma de recuperar los datos
 * aunque esten intactos en la nube. Este script es esa pieza que faltaba.
 *
 * Uso (con la app CERRADA):
 *   npx electron scripts/pull-from-cloud.js
 *   npx electron scripts/pull-from-cloud.js --dry-run
 *
 * Garantias:
 *   - Copia de seguridad de la base local antes de tocar nada.
 *   - Todo en UNA transaccion: o entra entero, o no entra nada.
 *   - Las filas se marcan synced = 1, asi que NO se vuelven a subir: el script
 *     nunca puede provocar una escritura en la nube.
 *   - Solo toca las filas del propio gimnasio (WHERE gym_id = ...).
 *   - No borra nada en la nube.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
const Database = require(path.join(REPO, 'node_modules', 'better-sqlite3'));
const Store = require(path.join(REPO, 'node_modules', 'electron-store'));
const { machineIdSync } = require(path.join(REPO, 'node_modules', 'node-machine-id'));

const DRY = process.argv.includes('--dry-run');

// Localizar la base de datos de la app.
const APP_NAME = 'gym-manager-pro';
const userData = process.env.APPDATA
    ? path.join(process.env.APPDATA, APP_NAME)
    : path.join(os.homedir(), '.config', APP_NAME);
const DB_PATH = path.join(userData, 'gym_manager.db');
if (!fs.existsSync(DB_PATH)) {
    console.error('ERROR: no existe la base en ' + DB_PATH);
    console.error('   Abre la aplicacion al menos una vez para que la cree.');
    process.exit(1);
}

// Credenciales: gym_id + owner_token del almacen de licencia.
function readLicense() {
    const hwId = machineIdSync();
    const store = new Store({
        name: 'license_data',
        encryptionKey: 'gym-manager-pro-' + hwId,
        cwd: userData,
    });
    const lic = store.get('license');
    if (!lic || !lic.gym_id || !lic.owner_token) {
        throw new Error('No hay licencia activada en este equipo (falta gym_id / owner_token).');
    }
    return lic;
}

function readSupabaseUrl() {
    const envPath = path.join(REPO, '.env.local');
    if (fs.existsSync(envPath)) {
        const m = fs.readFileSync(envPath, 'utf8').match(/^\s*SUPABASE_URL\s*=\s*(.+)$/m);
        if (m) return m[1].trim();
    }
    if (process.env.GYM_SUPABASE_URL) return process.env.GYM_SUPABASE_URL;
    throw new Error('No se encontro SUPABASE_URL (.env.local o GYM_SUPABASE_URL).');
}

// Lectura desde la nube por la misma puerta que usa el sync.
async function cloudSelect(baseUrl, token, table, gymId) {
    const res = await fetch(baseUrl + '/functions/v1/owner-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ op: 'select', table: table, gym_id: gymId }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !body.success) {
        throw new Error(table + ': ' + ((body && body.error) || ('HTTP ' + res.status)));
    }
    return body.data || [];
}

// Mapeo nube -> local (inverso del de sync.service.js).
// El orden respeta las dependencias entre tablas.
const asJson = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));

const TABLES = [
    { local: 'tariffs', cloud: 'cloud_tariffs',
      cols: ['name', 'amount', 'color_theme', 'billing_months', 'amount_is_total'] },
    { local: 'exercise_categories', cloud: 'cloud_exercise_categories',
      cols: ['name', 'icon', 'is_system'] },
    { local: 'exercise_subcategories', cloud: 'cloud_exercise_subcategories',
      cols: ['category_id', 'name'] },
    { local: 'exercises', cloud: 'cloud_exercises',
      cols: ['name', 'subcategory_id', 'video_url', 'notes', 'default_sets', 'default_reps',
             'is_failure', 'default_intensity', 'category', 'equipment', 'tracking_type'],
      json: ['custom_fields'] },
    { local: 'customers', cloud: 'cloud_customers',
      cols: ['first_name', 'last_name', 'email', 'phone', 'active', 'tariff_id', 'dni', 'address',
             'height_cm', 'weight_kg', 'birth_date', 'mobile_show_schedule', 'auto_deactivated_at'],
      json: ['medical_info'] },
    { local: 'memberships', cloud: 'cloud_memberships',
      cols: ['customer_id', 'start_date', 'end_date'] },
    { local: 'payments', cloud: 'cloud_payments',
      cols: ['customer_id', 'amount', 'payment_date', 'tariff_name', 'payment_method', 'payment_group_id'] },
    { local: 'trainers', cloud: 'cloud_trainers',
      cols: ['name', 'color_theme', 'phone', 'email', 'active'] },
    { local: 'trainer_schedules', cloud: 'cloud_trainer_schedules',
      cols: ['trainer_id', 'day_of_week', 'start_time', 'end_time'] },
    { local: 'gym_classes', cloud: 'cloud_gym_classes',
      cols: ['name', 'description', 'instructor', 'trainer_id', 'color_theme', 'max_capacity',
             'duration_minutes', 'active'] },
    { local: 'gym_class_schedules', cloud: 'cloud_gym_class_schedules',
      cols: ['class_id', 'day_of_week', 'start_time', 'end_time'] },
    { local: 'exercise_field_config', cloud: 'cloud_exercise_field_config',
      cols: ['field_key', 'label', 'type', 'is_active', 'is_mandatory_in_template',
             'is_loggable', 'is_prescribable', 'is_deleted'],
      json: ['options'] },
    { local: 'mesocycles', cloud: 'cloud_mesocycles',
      cols: ['customer_id', 'name', 'start_date', 'end_date', 'active', 'is_template',
             'days_per_week', 'notes', 'drive_link'] },
    { local: 'routines', cloud: 'cloud_routines',
      cols: ['mesocycle_id', 'name', 'day_group', 'notes'] },
    { local: 'routine_items', cloud: 'cloud_routine_items',
      cols: ['routine_id', 'exercise_id', 'series', 'reps', 'rpe', 'notes', 'intensity',
             'order_index', 'superset_group', 'superset_rounds', 'effective_from', 'effective_to'],
      json: ['custom_fields'] },
];

async function main() {
    const lic = readLicense();
    const baseUrl = readSupabaseUrl();
    const gymId = lic.gym_id;
    console.log('Gimnasio: ' + (lic.gym_name || '(sin nombre)') + '  [' + gymId + ']');
    console.log('Base local: ' + DB_PATH);
    if (DRY) console.log('\nMODO SIMULACION (no se escribe nada)');
    console.log('\nDescargando de la nube:');

    // Descargar todo ANTES de tocar la base: si algo falla, nada se ha movido.
    const fetched = {};
    for (const t of TABLES) {
        try {
            fetched[t.local] = await cloudSelect(baseUrl, lic.owner_token, t.cloud, gymId);
            console.log('  ' + t.cloud.padEnd(30) + String(fetched[t.local].length).padStart(5) + ' filas');
        } catch (e) {
            console.error('  ' + t.cloud.padEnd(30) + 'ERROR: ' + e.message);
            process.exit(1);
        }
    }

    const db = new Database(DB_PATH);
    const columnsOf = (t) => new Set(db.pragma('table_info(' + t + ')').map((c) => c.name));

    console.log('\nEstado local actual (solo este gimnasio):');
    for (const t of TABLES) {
        const n = db.prepare('SELECT COUNT(*) n FROM ' + t.local + ' WHERE gym_id = ?').get(gymId).n;
        const cloudN = fetched[t.local].length;
        console.log('  ' + t.local.padEnd(24) + String(n).padStart(5) + (n === cloudN ? '' : '   -> pasa a ' + cloudN));
    }

    if (DRY) {
        db.close();
        console.log('\nSimulacion terminada. Nada modificado.');
        return;
    }

    // Copia de seguridad.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(userData, 'gym_manager.antes-de-pull-' + stamp + '.db');
    fs.copyFileSync(DB_PATH, backup);
    console.log('\nCopia de seguridad: ' + path.basename(backup));

    console.log('\nRestaurando:');
    const run = db.transaction(() => {
        for (let i = TABLES.length - 1; i >= 0; i--) {
            db.prepare('DELETE FROM ' + TABLES[i].local + ' WHERE gym_id = ?').run(gymId);
        }
        for (const t of TABLES) {
            const rows = fetched[t.local];
            if (!rows.length) continue;
            const present = columnsOf(t.local);
            // Se ignoran las columnas que esta version del esquema no tenga.
            const dataCols = [].concat(t.cols, t.json || []).filter((c) => present.has(c));
            const cols = ['id', 'gym_id'].concat(dataCols);
            const hasSynced = present.has('synced');
            const hasUpdated = present.has('updated_at');
            const all = cols.concat(hasSynced ? ['synced'] : [], hasUpdated ? ['updated_at'] : []);
            const stmt = db.prepare(
                'INSERT INTO ' + t.local + ' (' + all.join(', ') + ') VALUES (' +
                all.map(() => '?').join(', ') + ')'
            );
            const jsonCols = new Set(t.json || []);
            for (const r of rows) {
                const vals = cols.map((c) => {
                    if (c === 'id') return r.local_id;
                    if (c === 'gym_id') return gymId;
                    return jsonCols.has(c) ? asJson(r[c]) : (r[c] == null ? null : r[c]);
                });
                // synced = 1: ya esta en la nube, asi que no se reenvia. El
                // script no puede provocar ninguna escritura remota.
                if (hasSynced) vals.push(1);
                if (hasUpdated) vals.push(new Date().toISOString());
                stmt.run(vals);
            }
            console.log('  ' + t.local.padEnd(24) + String(rows.length).padStart(5) + ' restauradas');
        }
    });

    try {
        // OJO: en SQLite este pragma es un no-op DENTRO de una transaccion, asi
        // que hay que desactivar las claves ajenas antes de abrirla. Se borra e
        // inserta tabla por tabla, y en el intermedio las referencias no cuadran
        // aunque el resultado final si sea consistente.
        db.pragma('foreign_keys = OFF');
        run();
        console.log('\nListo. Abre la aplicacion.');
    } catch (e) {
        console.error('\nFALLO, no se ha cambiado nada: ' + e.message);
        console.error('Si la base quedara rara, restaura: ' + backup);
        process.exitCode = 1;
    } finally {
        // Se reactivan antes de cerrar, para no dejar la base sin proteccion.
        try { db.pragma('foreign_keys = ON'); } catch { /* ya cerrada */ }
        db.close();
    }
}

// electron-store necesita el modulo app de Electron, asi que el script se
// ejecuta bajo Electron real (no ELECTRON_RUN_AS_NODE) y se cierra solo al
// terminar. Sin ventanas: es una tarea de consola.
let electronApp = null;
try { electronApp = require('electron').app; } catch { /* modo node */ }

if (electronApp && typeof electronApp.whenReady === 'function') {
    electronApp.whenReady().then(() =>
        main()
            .catch((e) => { console.error('ERROR: ' + e.message); process.exitCode = 1; })
            .finally(() => electronApp.exit(process.exitCode || 0))
    );
} else {
    main().catch((e) => { console.error('ERROR: ' + e.message); process.exitCode = 1; });
}
