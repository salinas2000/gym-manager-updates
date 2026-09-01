/**
 * saveMesocycle — vigencia por fechas.
 *
 * Reglas que se comprueban aqui:
 *   1. Sustituir un ejercicio a partir de una semana no destruye lo entrenado:
 *      el que sale se CIERRA el dia anterior, nunca se borra.
 *   2. El corte no puede caer en el pasado. Lo ya entrenado no se reescribe,
 *      venga la peticion de donde venga (la interfaz se puede saltar, esto no).
 *   3. Un dia entero solo se puede borrar si el programa aun no ha empezado.
 *
 * Se usa un SQLite REAL en memoria en vez de mocks: lo que se comprueba es el
 * efecto sobre las filas, y eso con un `prepare` mockeado no se veria.
 *
 * OJO: better-sqlite3 esta compilado para el ABI de Electron, asi que este
 * fichero necesita el Node de Electron:
 *   ELECTRON_RUN_AS_NODE=1 npx electron node_modules/jest/bin/jest.js --selectProjects main
 */

jest.mock('../../db/database');
jest.mock('./license.service');

// tests/setup-main.js mockea better-sqlite3 para todo el proceso principal;
// aqui hace falta el de verdad.
const Database = jest.requireActual('better-sqlite3');

const GYM = 'TEST_GYM';
const DAY = 86400000;

// Fechas relativas a HOY: las reglas dependen de "ya entrenado" vs "por venir",
// asi que con fechas fijas los tests caducarian.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyD = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const shift = (days) => ymd(new Date(hoyD.getTime() + days * DAY));

const HOY = shift(0);
const AYER = shift(-1);
// Plan de 4 semanas que empezo hace 2: semanas 1-2 pasadas, la 3 empieza HOY.
const START_EN_CURSO = shift(-14);
const FIN_EN_CURSO = shift(13);
// Plan que aun no ha empezado (arranca en una semana).
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
    `);
}

/** Plan de 4 semanas, un dia, con Press Banca (10) y Remo (11). */
function seedPlan(startDate, endDate) {
    const mesoId = Number(db.prepare(
        `INSERT INTO mesocycles (gym_id, customer_id, name, start_date, end_date, is_template, days_per_week)
         VALUES (?, 1, 'Plan', ?, ?, 0, 1)`
    ).run(GYM, startDate, endDate).lastInsertRowid);

    const routineId = Number(db.prepare(
        `INSERT INTO routines (gym_id, mesocycle_id, name) VALUES (?, ?, 'Día 1')`
    ).run(GYM, mesoId).lastInsertRowid);

    const ins = db.prepare(
        `INSERT INTO routine_items (gym_id, routine_id, exercise_id, order_index, effective_from, effective_to)
         VALUES (?, ?, ?, ?, NULL, NULL)`
    );
    const press = Number(ins.run(GYM, routineId, 10, 0).lastInsertRowid);
    const remo = Number(ins.run(GYM, routineId, 11, 1).lastInsertRowid);
    return { mesoId, routineId, press, remo };
}

const itemsOf = (routineId) =>
    db.prepare('SELECT id, exercise_id, effective_from, effective_to FROM routine_items WHERE routine_id = ? ORDER BY id')
        .all(routineId);

const deletedItems = () =>
    db.prepare("SELECT local_id FROM sync_deleted_log WHERE table_name = 'routine_items'")
        .all().map((r) => r.local_id);

const save = (extra) => trainingService.saveMesocycle({
    customerId: 1, name: 'Plan', allowOverlap: true, ...extra,
});

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

describe('saveMesocycle — vigencia por fechas', () => {
    test('sustituir en la semana en curso cierra el viejo el dia anterior, sin borrarlo', () => {
        const { mesoId, routineId, press, remo } = seedPlan(START_EN_CURSO, FIN_EN_CURSO);

        // La semana 3 arranca justo hoy.
        save({
            id: mesoId, startDate: START_EN_CURSO, endDate: FIN_EN_CURSO, editWeek: 3,
            routines: [{
                id: routineId, name: 'Día 1',
                items: [{ id: remo, exerciseId: 11 }, { exerciseId: 12 }],
            }],
        });

        const items = itemsOf(routineId);
        const pressRow = items.find((i) => i.id === press);
        expect(pressRow).toBeDefined();          // la fila sobrevive: sus pesos cuelgan de ella
        expect(pressRow.effective_to).toBe(AYER);

        const nuevo = items.find((i) => i.exercise_id === 12);
        expect(nuevo.effective_from).toBe(HOY);
        expect(nuevo.effective_to).toBeNull();

        expect(deletedItems()).toHaveLength(0);
    });

    test('el corte NUNCA cae en el pasado: pedir la semana 1 de un plan ya empezado se empuja a hoy', () => {
        const { mesoId, routineId, press, remo } = seedPlan(START_EN_CURSO, FIN_EN_CURSO);

        // editWeek 1 pediria cortar en el inicio (hace 2 semanas). Eso borraria
        // de la vista lo ya entrenado, asi que se fuerza a hoy.
        save({
            id: mesoId, startDate: START_EN_CURSO, endDate: FIN_EN_CURSO, editWeek: 1,
            routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }],
        });

        const pressRow = itemsOf(routineId).find((i) => i.id === press);
        expect(pressRow).toBeDefined();
        expect(pressRow.effective_to).toBe(AYER);   // no el dia anterior al inicio
        expect(deletedItems()).toHaveLength(0);
    });

    test('un plan que aun no ha empezado si se puede vaciar entero (no hay nada entrenado)', () => {
        const { mesoId, routineId, press, remo } = seedPlan(START_FUTURO, FIN_FUTURO);

        save({
            id: mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO, editWeek: 1,
            routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }],
        });

        const pressRow = itemsOf(routineId).find((i) => i.id === press);
        // Se cierra el dia anterior al inicio: rango vacio, invisible siempre.
        expect(pressRow.effective_to < START_FUTURO).toBe(true);
    });

    test('el dia entero solo se borra si el plan no ha empezado', () => {
        const futuro = seedPlan(START_FUTURO, FIN_FUTURO);
        save({ id: futuro.mesoId, startDate: START_FUTURO, endDate: FIN_FUTURO, editWeek: 1, routines: [] });
        expect(db.prepare('SELECT id FROM routines WHERE id = ?').get(futuro.routineId)).toBeUndefined();

        const enCurso = seedPlan(START_EN_CURSO, FIN_EN_CURSO);
        save({ id: enCurso.mesoId, startDate: START_EN_CURSO, endDate: FIN_EN_CURSO, editWeek: 1, routines: [] });
        expect(db.prepare('SELECT id FROM routines WHERE id = ?').get(enCurso.routineId)).toBeDefined();
        expect(itemsOf(enCurso.routineId)).toHaveLength(2);
    });

    test('anadido y quitado en la misma semana queda con rango vacio (invisible)', () => {
        const { mesoId, routineId, remo } = seedPlan(START_EN_CURSO, FIN_EN_CURSO);
        const anadido = Number(db.prepare(
            `INSERT INTO routine_items (gym_id, routine_id, exercise_id, order_index, effective_from, effective_to)
             VALUES (?, ?, 99, 2, ?, NULL)`
        ).run(GYM, routineId, HOY).lastInsertRowid);

        save({
            id: mesoId, startDate: START_EN_CURSO, endDate: FIN_EN_CURSO, editWeek: 3,
            routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }],
        });

        const row = itemsOf(routineId).find((i) => i.id === anadido);
        expect(row).toBeDefined();
        expect(row.effective_to < row.effective_from).toBe(true);
    });

    test('sin fecha de inicio se mantiene el borrado clasico (no hay forma de fechar el corte)', () => {
        const { mesoId, routineId, press, remo } = seedPlan(null, null);

        save({ id: mesoId, startDate: null, endDate: null,
               routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }] });

        expect(itemsOf(routineId).find((i) => i.id === press)).toBeUndefined();
        expect(deletedItems()).toContain(press);
    });

    test('quitar un ejercicio y volver a ponerlo NO cuenta como cambio', () => {
        const { mesoId, routineId, press, remo } = seedPlan(START_EN_CURSO, FIN_EN_CURSO);

        // El entrenador quita Press Banca (10) y lo vuelve a anadir en el mismo
        // guardado: solo lo ha recolocado, no es una sustitucion.
        save({
            id: mesoId, startDate: START_EN_CURSO, endDate: FIN_EN_CURSO, editWeek: 3,
            routines: [{ id: routineId, name: 'Día 1',
                items: [{ id: remo, exerciseId: 11 }, { exerciseId: 10 }] }],
        });

        const items = itemsOf(routineId);
        // Sigue habiendo dos filas: no se ha creado una nueva ni cerrado la vieja.
        expect(items).toHaveLength(2);
        const pressRow = items.find((i) => i.id === press);
        expect(pressRow).toBeDefined();
        expect(pressRow.exercise_id).toBe(10);
        expect(pressRow.effective_to).toBeNull();   // sin cerrar: no hubo cambio
        expect(pressRow.effective_from).toBeNull(); // sigue vigente desde siempre
        expect(deletedItems()).toHaveLength(0);
    });

    test('sustituir por un ejercicio DISTINTO si cuenta como cambio', () => {
        const { mesoId, routineId, press } = seedPlan(START_EN_CURSO, FIN_EN_CURSO);

        // Se quita Press Banca (10) y entra Fondos (12): esto si es sustitucion.
        save({
            id: mesoId, startDate: START_EN_CURSO, endDate: FIN_EN_CURSO, editWeek: 3,
            routines: [{ id: routineId, name: 'Día 1', items: [{ exerciseId: 12 }] }],
        });

        const items = itemsOf(routineId);
        expect(items.find((i) => i.id === press).effective_to).toBe(AYER);
        expect(items.find((i) => i.exercise_id === 12).effective_from).toBe(HOY);
    });
});
