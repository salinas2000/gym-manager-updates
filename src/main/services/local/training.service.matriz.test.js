/**
 * MATRIZ COMPLETA DE CAMBIOS.
 *
 * Cada forma de tocar un programa, en cada estado en que puede estar el
 * programa. La pregunta que responde cada test es siempre la misma:
 *
 *   "¿lo que veo al reabrir es exactamente lo que dejé?"
 *
 * y, cuando el programa ya está en marcha, además:
 *
 *   "¿lo que el cliente ya entrenó sigue igual, y no se ha borrado ninguna
 *    fila (porque de ellas cuelgan sus pesos)?"
 *
 * Estados: sin empezar / empieza hoy / en marcha.
 * Cambios: añadir, quitar, sustituir, quitar y reponer, reordenar, mover de
 * día, editar series y notas, añadir día, quitar día, renombrar día, reordenar
 * días, guardar sin tocar nada, y varias cosas a la vez.
 *
 * OJO: better-sqlite3 esta compilado para el ABI de Electron:
 *   ELECTRON_RUN_AS_NODE=1 npx electron node_modules/jest/bin/jest.js --selectProjects main
 */

jest.mock('../../db/database');
jest.mock('./license.service');

const Database = jest.requireActual('better-sqlite3');

const GYM = 'TEST_GYM';
const DAY = 86400000;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyD = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const shift = (n) => ymd(new Date(hoyD.getTime() + n * DAY));

const HOY = shift(0);
const AYER = shift(-1);

// Los tres estados en que puede estar un programa al editarlo.
const ESTADOS = [
    { nombre: 'sin empezar', inicio: shift(7), fin: shift(90), enMarcha: false },
    { nombre: 'empieza hoy', inicio: HOY, fin: shift(83), enMarcha: true },
    { nombre: 'en marcha', inicio: shift(-30), fin: shift(54), enMarcha: true },
];

let db;
let training;

function createSchema(d) {
    d.exec(`
        CREATE TABLE mesocycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, customer_id INTEGER, name TEXT,
            start_date TEXT, end_date TEXT, notes TEXT, active INTEGER DEFAULT 1,
            is_template INTEGER DEFAULT 0, days_per_week INTEGER, synced INTEGER DEFAULT 0, updated_at TEXT);
        CREATE TABLE routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, mesocycle_id INTEGER, name TEXT,
            day_group TEXT, notes TEXT, synced INTEGER DEFAULT 0, updated_at TEXT);
        CREATE TABLE routine_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, routine_id INTEGER, exercise_id INTEGER,
            series INTEGER, reps TEXT, rpe TEXT, notes TEXT, order_index INTEGER, intensity TEXT,
            custom_fields TEXT, superset_group INTEGER, superset_rounds INTEGER,
            effective_from TEXT, effective_to TEXT, synced INTEGER DEFAULT 0, updated_at TEXT);
        CREATE TABLE sync_deleted_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, table_name TEXT, local_id INTEGER);
        CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, name TEXT, subcategory_id INTEGER);
        CREATE TABLE exercise_categories (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE exercise_subcategories (id INTEGER PRIMARY KEY, category_id INTEGER);
        CREATE TABLE exercise_field_config (id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT,
            field_key TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT);
    `);
    const ins = d.prepare('INSERT INTO exercises (id, gym_id, name) VALUES (?, ?, ?)');
    [[1, 'Sentadilla'], [2, 'Press Banca'], [3, 'Remo'], [4, 'Peso Muerto'], [5, 'Curl']]
        .forEach(([id, n]) => ins.run(id, GYM, n));
}

beforeEach(() => {
    jest.resetModules();
    db = new Database(':memory:');
    createSchema(db);
    require('../../db/database').getInstance = jest.fn(() => db);
    require('./license.service').getLicenseData = jest.fn(() => ({ gym_id: GYM }));
    training = require('./training.service');
});
afterEach(() => db.close());

// ── Utilidades que imitan al editor ─────────────────────────────────────────

/** Día por el que filtra la vista del editor: hoy, o el inicio si no empezó. */
const diaDeVista = (inicio) => (String(inicio).slice(0, 10) <= HOY ? HOY : String(inicio).slice(0, 10));

const vigente = (i, dia) =>
    (!i.effective_from || i.effective_from <= dia) && (!i.effective_to || i.effective_to >= dia);

/** Lo que el entrenador VE al abrir: [{dia, ejercicios:[id...]}]. */
const ver = (mesoId, dia) =>
    training.getRoutinesByMesocycle(mesoId).map(r => ({
        dia: r.name,
        ejercicios: r.items.filter(i => vigente(i, dia)).map(i => i.exercise_id),
    }));

/** Lo mismo, pero con la forma que el editor manda al guardar. */
const editable = (mesoId, dia) =>
    training.getRoutinesByMesocycle(mesoId).map((r, idx) => ({
        id: r.id, name: r.name, dayGroup: idx,
        items: r.items.filter(i => vigente(i, dia)).map(i => ({
            id: i.id, exerciseId: i.exercise_id, series: i.series, reps: i.reps, notes: i.notes,
        })),
    }));

const borrados = () => db.prepare(
    "SELECT local_id FROM sync_deleted_log WHERE table_name='routine_items'").all().length;

/** Contenido de las filas, sin la marca de tiempo ni el aviso de sincronizar:
 *  un guardado siempre las refresca, y eso no es un cambio de datos. */
const contenido = () => db.prepare(`
    SELECT id, routine_id, exercise_id, series, reps, rpe, notes, order_index,
           intensity, custom_fields, superset_group, superset_rounds,
           effective_from, effective_to
    FROM routine_items ORDER BY id`).all();

/** Crea un programa de 2 días con 3 y 2 ejercicios. */
function crear(estado, dias = [[1, 2, 3], [4, 5]]) {
    const r = training.saveMesocycle({
        customerId: 1, name: 'Plan', allowOverlap: true,
        startDate: estado.inicio, endDate: estado.fin, daysPerWeek: dias.length,
        routines: dias.map((ejs, i) => ({
            id: Date.now() + i, name: `Día ${i + 1}`, dayGroup: i,
            items: ejs.map(e => ({ exerciseId: e, series: 3, reps: '10' })),
        })),
    });
    return r.id;
}

/** Guarda lo que el editor tiene en pantalla. */
const guardar = (mesoId, estado, routines) => training.saveMesocycle({
    id: mesoId, customerId: 1, name: 'Plan', allowOverlap: true,
    startDate: estado.inicio, endDate: estado.fin, viewDay: diaDeVista(estado.inicio),
    daysPerWeek: routines.length, routines,
});

// ── La matriz ───────────────────────────────────────────────────────────────

describe.each(ESTADOS)('programa $nombre', (estado) => {
    const VISTA = () => diaDeVista(estado.inicio);

    /** Invariantes que deben cumplirse SIEMPRE tras cualquier guardado. */
    const invariantes = (mesoId, esperado) => {
        // 1. Lo que se ve al reabrir es lo que se dejó.
        expect(ver(mesoId, VISTA())).toEqual(esperado);
        // 2. Con el programa en marcha no se borra ni una fila: los pesos del
        //    cliente cuelgan de ellas.
        if (estado.enMarcha) expect(borrados()).toBe(0);
        // 3. Sin empezar no queda basura invisible.
        if (!estado.enMarcha) {
            const total = db.prepare('SELECT COUNT(*) n FROM routine_items').get().n;
            const vistos = esperado.reduce((s, d) => s + d.ejercicios.length, 0);
            expect(total).toBe(vistos);
        }
    };

    test('guardar sin tocar nada no cambia nada', () => {
        const m = crear(estado);
        const antes = contenido();
        guardar(m, estado, editable(m, VISTA()));
        expect(contenido()).toEqual(antes);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 2, 3] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('añadir un ejercicio', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items.push({ exerciseId: 5 });
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 2, 3, 5] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('quitar un ejercicio', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items.splice(1, 1);                 // fuera Press Banca
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 3] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('sustituir un ejercicio por otro', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items.splice(1, 1);
        r[0].items.push({ exerciseId: 4 });
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 3, 4] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('quitar un ejercicio y volver a ponerlo en el MISMO guardado no cuenta como cambio', () => {
        const m = crear(estado);
        const antes = db.prepare('SELECT id FROM routine_items ORDER BY id').all();
        const r = editable(m, VISTA());
        const quitado = r[0].items.splice(1, 1)[0];
        r[0].items.push({ exerciseId: quitado.exerciseId });   // vuelve, sin id
        guardar(m, estado, r);
        // No nace fila nueva: se readopta la de siempre.
        expect(db.prepare('SELECT id FROM routine_items ORDER BY id').all()).toEqual(antes);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 3, 2] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('quitar un ejercicio y volver a ponerlo en OTRO guardado lo deja visible', () => {
        const m = crear(estado);
        let r = editable(m, VISTA());
        r[0].items.splice(1, 1);
        guardar(m, estado, r);
        r = editable(m, VISTA());
        r[0].items.push({ exerciseId: 2 });
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 3, 2] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('reordenar los ejercicios dentro de un día', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items.reverse();
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [3, 2, 1] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('mover un ejercicio de un día a otro', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        const movido = r[0].items.splice(2, 1)[0];             // Remo, del Día 1
        r[1].items.push({ exerciseId: movido.exerciseId });     // al Día 2
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 2] }, { dia: 'Día 2', ejercicios: [4, 5, 3] }]);
    });

    test('cambiar series, repeticiones y notas de un ejercicio', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items[0] = { ...r[0].items[0], series: 5, reps: '5', notes: 'más peso' };
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [1, 2, 3] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
        const fila = db.prepare('SELECT series, reps, notes FROM routine_items WHERE id = ?')
            .get(r[0].items[0].id);
        expect(fila).toEqual({ series: 5, reps: '5', notes: 'más peso' });
    });

    test('vaciar un día entero (sin quitar el día)', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items = [];
        guardar(m, estado, r);
        invariantes(m, [{ dia: 'Día 1', ejercicios: [] }, { dia: 'Día 2', ejercicios: [4, 5] }]);
    });

    test('añadir un día nuevo', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r.push({ id: Date.now() + 99, name: 'Día 3', dayGroup: 2, items: [{ exerciseId: 5 }] });
        guardar(m, estado, r);
        expect(ver(m, VISTA())).toEqual([
            { dia: 'Día 1', ejercicios: [1, 2, 3] },
            { dia: 'Día 2', ejercicios: [4, 5] },
            { dia: 'Día 3', ejercicios: [5] },
        ]);
        if (estado.enMarcha) expect(borrados()).toBe(0);
    });

    test('renombrar un día', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].name = 'Empuje';
        guardar(m, estado, r);
        expect(ver(m, VISTA()).map(d => d.dia)).toEqual(['Empuje', 'Día 2']);
    });

    test('reordenar los días', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        const reordenado = [r[1], r[0]].map((d, i) => ({ ...d, dayGroup: i }));
        guardar(m, estado, reordenado);
        expect(ver(m, VISTA())).toEqual([
            { dia: 'Día 2', ejercicios: [4, 5] },
            { dia: 'Día 1', ejercicios: [1, 2, 3] },
        ]);
        if (estado.enMarcha) expect(borrados()).toBe(0);
    });

    test('quitar un día', () => {
        const m = crear(estado);
        guardar(m, estado, [editable(m, VISTA())[0]]);
        const diasQueQuedan = db.prepare('SELECT COUNT(*) n FROM routines WHERE mesocycle_id = ?').get(m).n;
        if (estado.enMarcha) {
            // No se borra: se llevaría por delante el historial de ese día.
            expect(diasQueQuedan).toBe(2);
            expect(borrados()).toBe(0);
        } else {
            expect(diasQueQuedan).toBe(1);
        }
    });

    test('varias cosas a la vez: quitar, añadir, mover, renombrar y reordenar', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items.splice(0, 1);                                  // fuera Sentadilla
        r[0].items.push({ exerciseId: 5 });                        // entra Curl
        const movido = r[1].items.splice(0, 1)[0];                 // Peso Muerto se muda
        r[0].items.push({ exerciseId: movido.exerciseId });
        r[0].name = 'Torso';
        const reordenado = [r[1], r[0]].map((d, i) => ({ ...d, dayGroup: i }));
        guardar(m, estado, reordenado);

        invariantes(m, [
            { dia: 'Día 2', ejercicios: [5] },
            { dia: 'Torso', ejercicios: [2, 3, 5, 4] },
        ]);
    });

    test('dos guardados seguidos idénticos dejan la base igual', () => {
        const m = crear(estado);
        const r = editable(m, VISTA());
        r[0].items.push({ exerciseId: 4 });
        guardar(m, estado, r);
        const trasUno = contenido();
        guardar(m, estado, editable(m, VISTA()));
        expect(contenido()).toEqual(trasUno);
    });
});

// ── Lo que solo aplica a un programa EN MARCHA ──────────────────────────────

describe('en marcha: el pasado del cliente nunca se toca', () => {
    const estado = ESTADOS[2];   // empezó hace 30 días

    test('lo que se quita se sigue viendo en lo ya entrenado', () => {
        const m = crear(estado);
        const r = editable(m, VISTA_EN_MARCHA());
        r[0].items.splice(1, 1);
        guardar(m, estado, r);

        expect(ver(m, HOY)[0].ejercicios).toEqual([1, 3]);
        expect(ver(m, AYER)[0].ejercicios).toEqual([1, 2, 3]);   // ayer, intacto
    });

    test('lo que se añade NO aparece en lo ya entrenado', () => {
        const m = crear(estado);
        const r = editable(m, VISTA_EN_MARCHA());
        r[0].items.push({ exerciseId: 4 });
        guardar(m, estado, r);

        expect(ver(m, HOY)[0].ejercicios).toEqual([1, 2, 3, 4]);
        expect(ver(m, AYER)[0].ejercicios).toEqual([1, 2, 3]);
    });

    test('un día añadido hoy no sale en las semanas anteriores', () => {
        const m = crear(estado);
        const r = editable(m, VISTA_EN_MARCHA());
        r.push({ id: Date.now() + 7, name: 'Día 3', dayGroup: 2, items: [{ exerciseId: 5 }] });
        guardar(m, estado, r);

        expect(ver(m, HOY).find(d => d.dia === 'Día 3').ejercicios).toEqual([5]);
        expect(ver(m, AYER).find(d => d.dia === 'Día 3').ejercicios).toEqual([]);
    });

    test('quitar y reponer el mismo ejercicio en dos guardados no parte su historial', () => {
        const m = crear(estado);
        let r = editable(m, VISTA_EN_MARCHA());
        const idOriginal = r[0].items[1].id;
        r[0].items.splice(1, 1);
        guardar(m, estado, r);
        r = editable(m, VISTA_EN_MARCHA());
        r[0].items.push({ exerciseId: 2 });
        guardar(m, estado, r);

        // La fila vieja se queda cerrada (con sus pesos) y nace una nueva desde
        // hoy: son dos tramos distintos del mismo ejercicio, que es lo correcto.
        const filas = db.prepare('SELECT id, effective_from, effective_to FROM routine_items WHERE exercise_id = 2').all();
        expect(filas).toHaveLength(2);
        expect(filas.find(f => f.id === idOriginal).effective_to).toBe(AYER);
        expect(filas.find(f => f.id !== idOriginal).effective_from).toBe(HOY);
        expect(borrados()).toBe(0);
    });
});

function VISTA_EN_MARCHA() { return HOY; }
