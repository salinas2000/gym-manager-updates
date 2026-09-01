/**
 * saveMesocycle — vigencia por fechas.
 *
 * Sustituir un ejercicio a partir de una semana sin destruir lo ya entrenado.
 * La regla dura: un routine_item NUNCA se borra si el programa tiene fecha de
 * inicio; se cierra. Los registros de entrenamiento cuelgan de esa fila y viven
 * solo en la nube, así que el escritorio no puede saber si hay pesos anotados:
 * borrar sería destruir historial a ciegas.
 *
 * Se usa un SQLite REAL en memoria en vez de mocks: lo que se comprueba es el
 * efecto sobre las filas, y eso con un `prepare` mockeado no se vería.
 */

jest.mock('../../db/database');
jest.mock('./license.service');

// tests/setup-main.js mockea better-sqlite3 para todo el proceso principal;
// aquí hace falta el de verdad.
const Database = jest.requireActual('better-sqlite3');

const GYM = 'TEST_GYM';
const START = '2026-08-03';           // lunes; semana 1 = 03-ago
const WEEK3 = '2026-08-17';           // inicio de la semana 3
const DAY_BEFORE_WEEK3 = '2026-08-16';
const DAY_BEFORE_START = '2026-08-02';

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

/** Plan de 4 semanas, un día, con Press Banca (10) y Remo (11). */
function seedPlan(startDate = START) {
    const mesoId = Number(db.prepare(
        `INSERT INTO mesocycles (gym_id, customer_id, name, start_date, end_date, is_template, days_per_week)
         VALUES (?, 1, 'Plan', ?, '2026-08-31', 0, 1)`
    ).run(GYM, startDate).lastInsertRowid);

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
        .all().map(r => r.local_id);

const save = (extra) => trainingService.saveMesocycle({
    customerId: 1, name: 'Plan', startDate: START, endDate: '2026-08-31',
    allowOverlap: true, ...extra,
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
    test('sustituir en la semana 3 cierra el viejo el día anterior, sin borrarlo', () => {
        const { mesoId, routineId, press, remo } = seedPlan();

        save({
            id: mesoId, editWeek: 3,
            routines: [{
                id: routineId, name: 'Día 1',
                items: [{ id: remo, exerciseId: 11 }, { exerciseId: 12 }],
            }],
        });

        const items = itemsOf(routineId);

        // Press Banca sigue existiendo (sus registros cuelgan de esta fila).
        const pressRow = items.find(i => i.id === press);
        expect(pressRow).toBeDefined();
        expect(pressRow.effective_to).toBe(DAY_BEFORE_WEEK3);

        // El sustituto arranca el primer día de la semana 3.
        const nuevo = items.find(i => i.exercise_id === 12);
        expect(nuevo.effective_from).toBe(WEEK3);
        expect(nuevo.effective_to).toBeNull();

        // El intacto sigue vigente siempre.
        const remoRow = items.find(i => i.id === remo);
        expect(remoRow.effective_from).toBeNull();
        expect(remoRow.effective_to).toBeNull();

        expect(deletedItems()).toHaveLength(0);
    });

    test('editando el plan completo TAMPOCO se borra: se retira sin destruir historial', () => {
        const { mesoId, routineId, press, remo } = seedPlan();

        save({
            id: mesoId, // sin editWeek → plan completo
            routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }],
        });

        const items = itemsOf(routineId);
        const pressRow = items.find(i => i.id === press);

        // La fila sobrevive, cerrada el día anterior al inicio del plan: el
        // rango queda vacío, así que no aparece en ninguna semana.
        expect(pressRow).toBeDefined();
        expect(pressRow.effective_to).toBe(DAY_BEFORE_START);
        expect(deletedItems()).toHaveLength(0);
    });

    test('un ejercicio retirado no aparece en ninguna semana', () => {
        const { mesoId, routineId, press, remo } = seedPlan();

        save({
            id: mesoId,
            routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }],
        });

        const pressRow = itemsOf(routineId).find(i => i.id === press);
        // Mismo filtro que aplican escritorio y móvil, sobre las 4 semanas.
        const visibleEn = (day) =>
            (!pressRow.effective_from || pressRow.effective_from <= day) &&
            (!pressRow.effective_to || pressRow.effective_to >= day);
        for (const dia of ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24']) {
            expect(visibleEn(dia)).toBe(false);
        }
    });

    test('añadido y quitado en la misma semana queda con rango vacío (invisible)', () => {
        const { mesoId, routineId, remo } = seedPlan();
        const añadido = Number(db.prepare(
            `INSERT INTO routine_items (gym_id, routine_id, exercise_id, order_index, effective_from, effective_to)
             VALUES (?, ?, 99, 2, ?, NULL)`
        ).run(GYM, routineId, WEEK3).lastInsertRowid);

        save({
            id: mesoId, editWeek: 3,
            routines: [{ id: routineId, name: 'Día 1', items: [{ id: remo, exerciseId: 11 }] }],
        });

        const row = itemsOf(routineId).find(i => i.id === añadido);
        expect(row).toBeDefined();
        // effective_to anterior a effective_from → nunca visible.
        expect(row.effective_to < row.effective_from).toBe(true);
    });

    test('editando una semana no se borran días enteros', () => {
        const { mesoId, routineId } = seedPlan();

        save({ id: mesoId, editWeek: 3, routines: [] });

        expect(db.prepare('SELECT id FROM routines WHERE id = ?').get(routineId)).toBeDefined();
        expect(itemsOf(routineId)).toHaveLength(2);
    });

    test('sin fecha de inicio se mantiene el borrado clásico (no hay forma de fechar el corte)', () => {
        const mesoId = Number(db.prepare(
            `INSERT INTO mesocycles (gym_id, customer_id, name, start_date, end_date, is_template, days_per_week)
             VALUES (?, 1, 'Plan', NULL, NULL, 0, 1)`
        ).run(GYM).lastInsertRowid);
        const routineId = Number(db.prepare(
            `INSERT INTO routines (gym_id, mesocycle_id, name) VALUES (?, ?, 'Día 1')`
        ).run(GYM, mesoId).lastInsertRowid);
        const press = Number(db.prepare(
            `INSERT INTO routine_items (gym_id, routine_id, exercise_id, order_index) VALUES (?, ?, 10, 0)`
        ).run(GYM, routineId).lastInsertRowid);

        trainingService.saveMesocycle({
            id: mesoId, customerId: 1, name: 'Plan',
            startDate: null, endDate: null, allowOverlap: true,
            routines: [{ id: routineId, name: 'Día 1', items: [] }],
        });

        expect(itemsOf(routineId).find(i => i.id === press)).toBeUndefined();
        expect(deletedItems()).toContain(press);
    });
});
