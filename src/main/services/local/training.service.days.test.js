/**
 * Operaciones sobre los DIAS de un programa: moverlos de sitio, anadir uno
 * nuevo a mitad de programa, quitar uno.
 *
 * Es la otra mitad del problema que reporto el entrenador ("hago un cambio y
 * al volver no esta"): ahi eran los ejercicios, aqui son los dias.
 *
 * Se lee por el camino REAL (getRoutinesByMesocycle), no por SQL a mano, para
 * que el test note cualquier cambio de orden en la consulta.
 *
 * OJO: better-sqlite3 esta compilado para el ABI de Electron, asi que este
 * fichero necesita el Node de Electron:
 *   ELECTRON_RUN_AS_NODE=1 npx electron node_modules/jest/bin/jest.js --selectProjects main
 */

jest.mock('../../db/database');
jest.mock('./license.service');

const Database = jest.requireActual('better-sqlite3');

const GYM = 'TEST_GYM';
const DAY = 86400000;

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyD = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const shift = (days) => ymd(new Date(hoyD.getTime() + days * DAY));

const HOY = shift(0);
// Plan de 4 semanas empezado hace 16 dias: la semana 3 ya esta en marcha.
const START = shift(-16);
const FIN = shift(11);
// Plan que aun no ha empezado.
const START_FUTURO = shift(7);
const FIN_FUTURO = shift(34);

let db;
let trainingService;

function createSchema(d) {
    d.exec(`
        CREATE TABLE mesocycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gym_id TEXT, customer_id INTEGER, name TEXT,
            start_date TEXT, end_date TEXT, notes TEXT,
            active INTEGER DEFAULT 1, is_template INTEGER DEFAULT 0,
            days_per_week INTEGER, synced INTEGER DEFAULT 0, updated_at TEXT
        );
        CREATE TABLE routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gym_id TEXT, mesocycle_id INTEGER, name TEXT,
            day_group TEXT, notes TEXT, synced INTEGER DEFAULT 0, updated_at TEXT
        );
        CREATE TABLE routine_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gym_id TEXT, routine_id INTEGER, exercise_id INTEGER,
            series INTEGER, reps TEXT, rpe TEXT, notes TEXT,
            order_index INTEGER, intensity TEXT, custom_fields TEXT,
            superset_group INTEGER, superset_rounds INTEGER,
            effective_from TEXT, effective_to TEXT,
            synced INTEGER DEFAULT 0, updated_at TEXT
        );
        CREATE TABLE sync_deleted_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gym_id TEXT, table_name TEXT, local_id INTEGER
        );
        CREATE TABLE exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gym_id TEXT, name TEXT, subcategory_id INTEGER
        );
        CREATE TABLE exercise_categories (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE exercise_subcategories (id INTEGER PRIMARY KEY, category_id INTEGER);
        CREATE TABLE exercise_field_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gym_id TEXT, field_key TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT
        );
    `);
    const ins = d.prepare('INSERT INTO exercises (id, gym_id, name) VALUES (?, ?, ?)');
    ins.run(10, GYM, 'Press Banca');
    ins.run(11, GYM, 'Remo');
    ins.run(12, GYM, 'Fondos');
}

/** Plan con `nombres.length` dias, cada uno con Press Banca (10). */
function seedPlan(startDate, endDate, nombres = ['Día 1', 'Día 2', 'Día 3']) {
    const mesoId = Number(db.prepare(
        `INSERT INTO mesocycles (gym_id, customer_id, name, start_date, end_date, is_template, days_per_week)
         VALUES (?, 1, 'Plan', ?, ?, 0, ?)`
    ).run(GYM, startDate, endDate, nombres.length).lastInsertRowid);

    const dias = nombres.map((nombre, i) => {
        const routineId = Number(db.prepare(
            `INSERT INTO routines (gym_id, mesocycle_id, name, day_group) VALUES (?, ?, ?, ?)`
        ).run(GYM, mesoId, nombre, String(i)).lastInsertRowid);
        const itemId = Number(db.prepare(
            `INSERT INTO routine_items (gym_id, routine_id, exercise_id, order_index) VALUES (?, ?, 10, 0)`
        ).run(GYM, routineId).lastInsertRowid);
        return { nombre, routineId, itemId };
    });
    return { mesoId, dias };
}

const save = (extra) => trainingService.saveMesocycle({
    customerId: 1, name: 'Plan', allowOverlap: true, ...extra,
});

/** Lo que ve el editor al reabrir: nombre de cada dia, en orden. */
const diasAlReabrir = (mesoId) =>
    trainingService.getRoutinesByMesocycle(mesoId).map(r => r.name);

const itemsOf = (routineId) =>
    db.prepare('SELECT id, exercise_id, effective_from, effective_to FROM routine_items WHERE routine_id = ? ORDER BY id')
        .all(routineId);

beforeEach(() => {
    jest.resetModules();
    db = new Database(':memory:');
    createSchema(db);

    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => db);
    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({ gym_id: GYM }));

    trainingService = require('./training.service');
});

afterEach(() => db.close());

describe('mover dias de sitio', () => {
    test('el orden en que quedan los dias es el que se ve al reabrir', () => {
        const { mesoId, dias } = seedPlan(START, FIN);
        const [d1, d2, d3] = dias;

        // El entrenador arrastra el ultimo dia al principio. El editor
        // renumera los nombres automaticos por posicion, asi que manda
        // [Día 3 -> "Día 1", Día 1 -> "Día 2", Día 2 -> "Día 3"].
        save({
            id: mesoId, startDate: START, endDate: FIN, editWeek: 3,
            routines: [
                { id: d3.routineId, name: 'Día 1', dayGroup: 0, items: [{ id: d3.itemId, exerciseId: 10 }] },
                { id: d1.routineId, name: 'Día 2', dayGroup: 1, items: [{ id: d1.itemId, exerciseId: 10 }] },
                { id: d2.routineId, name: 'Día 3', dayGroup: 2, items: [{ id: d2.itemId, exerciseId: 10 }] },
            ],
        });

        // Al reabrir tiene que verse en el orden en que lo dejo, no revuelto.
        expect(diasAlReabrir(mesoId)).toEqual(['Día 1', 'Día 2', 'Día 3']);

        // Y cada dia conserva SU contenido: el que ahora es "Día 1" sigue
        // siendo la fila del antiguo tercer dia, con su historial.
        const reabierto = trainingService.getRoutinesByMesocycle(mesoId);
        expect(reabierto[0].id).toBe(d3.routineId);
        expect(reabierto[1].id).toBe(d1.routineId);
        expect(reabierto[2].id).toBe(d2.routineId);
    });

    test('mover dias no cierra ni crea ejercicios', () => {
        const { mesoId, dias } = seedPlan(START, FIN);
        const [d1, d2, d3] = dias;

        save({
            id: mesoId, startDate: START, endDate: FIN, editWeek: 3,
            routines: [
                { id: d3.routineId, name: 'Día 1', dayGroup: 0, items: [{ id: d3.itemId, exerciseId: 10 }] },
                { id: d1.routineId, name: 'Día 2', dayGroup: 1, items: [{ id: d1.itemId, exerciseId: 10 }] },
                { id: d2.routineId, name: 'Día 3', dayGroup: 2, items: [{ id: d2.itemId, exerciseId: 10 }] },
            ],
        });

        for (const d of dias) {
            const items = itemsOf(d.routineId);
            expect(items).toHaveLength(1);
            expect(items[0].id).toBe(d.itemId);
            expect(items[0].effective_to).toBeNull();
        }
        expect(db.prepare("SELECT count(*) n FROM sync_deleted_log").get().n).toBe(0);
    });

    test('los nombres puestos a mano se respetan al moverlos', () => {
        const { mesoId, dias } = seedPlan(START, FIN, ['Empuje', 'Tirón', 'Pierna']);
        const [empuje, tiron, pierna] = dias;

        save({
            id: mesoId, startDate: START, endDate: FIN, editWeek: 3,
            routines: [
                { id: pierna.routineId, name: 'Pierna', dayGroup: 0, items: [{ id: pierna.itemId, exerciseId: 10 }] },
                { id: empuje.routineId, name: 'Empuje', dayGroup: 1, items: [{ id: empuje.itemId, exerciseId: 10 }] },
                { id: tiron.routineId, name: 'Tirón', dayGroup: 2, items: [{ id: tiron.itemId, exerciseId: 10 }] },
            ],
        });

        expect(diasAlReabrir(mesoId)).toEqual(['Pierna', 'Empuje', 'Tirón']);
    });
});

describe('anadir un dia a mitad de programa', () => {
    test('el dia nuevo empieza en la semana editada, no en las ya entrenadas', () => {
        const { mesoId, dias } = seedPlan(START, FIN, ['Día 1']);
        const [d1] = dias;

        // Se anade un dia nuevo editando la semana 3 (en curso).
        save({
            id: mesoId, startDate: START, endDate: FIN, editWeek: 3, viewDay: HOY,
            routines: [
                { id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [{ id: d1.itemId, exerciseId: 10 }] },
                { id: 1757000000000, name: 'Día 2', dayGroup: 1, items: [{ exerciseId: 11 }] },
            ],
        });

        const nuevo = db.prepare("SELECT id FROM routines WHERE mesocycle_id = ? AND name = 'Día 2'").get(mesoId);
        expect(nuevo).toBeDefined();

        // Sus ejercicios NO pueden estar vigentes desde el principio: el
        // cliente nunca entreno ese dia en las semanas 1 y 2, y aparecerian
        // en su historial como si si.
        const items = itemsOf(nuevo.id);
        expect(items).toHaveLength(1);
        expect(items[0].effective_from).toBe(HOY);
    });

    test('en un plan que aun no ha empezado el dia nuevo vale desde siempre', () => {
        const { mesoId, dias } = seedPlan(START_FUTURO, FIN_FUTURO, ['Día 1']);
        const [d1] = dias;

        save({
            id: mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO, editWeek: 1,
            routines: [
                { id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [{ id: d1.itemId, exerciseId: 10 }] },
                { id: 1757000000001, name: 'Día 2', dayGroup: 1, items: [{ exerciseId: 11 }] },
            ],
        });

        const nuevo = db.prepare("SELECT id FROM routines WHERE mesocycle_id = ? AND name = 'Día 2'").get(mesoId);
        // No hay pasado que proteger: nace sin fecha, vigente todo el plan.
        expect(itemsOf(nuevo.id)[0].effective_from).toBeNull();
    });
});

describe('quitar un dia', () => {
    test('en un programa en marcha el dia se queda (su historial cuelga de el)', () => {
        const { mesoId, dias } = seedPlan(START, FIN, ['Día 1', 'Día 2']);
        const [d1] = dias;

        save({
            id: mesoId, startDate: START, endDate: FIN, editWeek: 3, viewDay: HOY,
            routines: [{ id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [{ id: d1.itemId, exerciseId: 10 }] }],
        });

        expect(db.prepare('SELECT count(*) n FROM routines WHERE mesocycle_id = ?').get(mesoId).n).toBe(2);
        expect(db.prepare("SELECT count(*) n FROM sync_deleted_log WHERE table_name = 'routines'").get().n).toBe(0);
    });

    test('en un plan que aun no ha empezado si se borra', () => {
        const { mesoId, dias } = seedPlan(START_FUTURO, FIN_FUTURO, ['Día 1', 'Día 2']);
        const [d1] = dias;

        save({
            id: mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO, editWeek: 1,
            routines: [{ id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [{ id: d1.itemId, exerciseId: 10 }] }],
        });

        expect(db.prepare('SELECT count(*) n FROM routines WHERE mesocycle_id = ?').get(mesoId).n).toBe(1);
    });
});

describe('programa que aún no ha empezado: quitar y volver a poner', () => {
    // Josema escribe los programas antes de que arranquen. Ahí no hay historial
    // que proteger, pero el ejercicio retirado no se borra: se cierra el día
    // anterior al inicio (rango vacío, invisible). Si al volver a añadirlo se
    // reaprovecha esa fila cerrada, el ejercicio entra INVISIBLE: el entrenador
    // lo pone, guarda, y no aparece por ninguna parte.
    test('volver a añadir un ejercicio retirado lo deja visible', () => {
        const { mesoId, dias } = seedPlan(START_FUTURO, FIN_FUTURO, ['Día 1']);
        const [d1] = dias;

        // 1) Se retira Press Banca (10).
        save({
            id: mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO,
            routines: [{ id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [] }],
        });
        const retirado = itemsOf(d1.routineId).find((i) => i.id === d1.itemId);
        expect(retirado.effective_to < START_FUTURO).toBe(true);   // invisible

        // 2) Se vuelve a añadir en otro guardado.
        save({
            id: mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO,
            routines: [{ id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [{ exerciseId: 10 }] }],
        });

        // Tiene que verse el día que arranca el programa.
        const visibles = itemsOf(d1.routineId).filter(
            (i) => (!i.effective_from || i.effective_from <= START_FUTURO)
                && (!i.effective_to || i.effective_to >= START_FUTURO));
        expect(visibles.map((i) => i.exercise_id)).toEqual([10]);
    });

    test('lo retirado no vuelve a aparecer al reabrir', () => {
        const { mesoId, dias } = seedPlan(START_FUTURO, FIN_FUTURO, ['Día 1']);
        const [d1] = dias;
        save({
            id: mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO,
            routines: [{ id: d1.routineId, name: 'Día 1', dayGroup: 0, items: [] }],
        });
        // La vista del editor para un plan sin empezar mira su fecha de inicio.
        const visibles = itemsOf(d1.routineId).filter(
            (i) => (!i.effective_from || i.effective_from <= START_FUTURO)
                && (!i.effective_to || i.effective_to >= START_FUTURO));
        expect(visibles).toHaveLength(0);
    });
});
