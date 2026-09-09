/**
 * CREAR Y EDITAR MESOCICLOS — simulación del uso real.
 *
 * Reproduce lo que hace el entrenador de verdad, en el orden en que lo hace,
 * llamando al servicio igual que lo llama el editor. Cada test es una sesión
 * completa: crear, guardar, reabrir, cambiar, volver a guardar.
 *
 * La regla que se comprueba en todos: lo que se guarda entra HOY, y lo que el
 * cliente ya entrenó no se toca nunca. Un programa que aún no ha arrancado se
 * edita entero.
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
            id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, name TEXT, subcategory_id INTEGER
        );
        CREATE TABLE exercise_categories (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE exercise_subcategories (id INTEGER PRIMARY KEY, category_id INTEGER);
        CREATE TABLE exercise_field_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT, gym_id TEXT, field_key TEXT,
            is_deleted INTEGER DEFAULT 0, created_at TEXT
        );
    `);
    const ins = d.prepare('INSERT INTO exercises (id, gym_id, name) VALUES (?, ?, ?)');
    ins.run(10, GYM, 'Sentadilla');
    ins.run(11, GYM, 'Press Banca');
    ins.run(12, GYM, 'Remo');
    ins.run(13, GYM, 'Peso Muerto');
}

/** Guardar tal y como lo manda el editor. */
const guardar = (extra) => trainingService.saveMesocycle({
    customerId: 1, name: 'Plan', allowOverlap: true, notes: 'Creado desde App',
    verificado: true, sinEntrenamientos: true, diasEntrenadosEstaSemana: [],
    ...extra,
});

/** Lo que el editor ENSEÑA al reabrir: día → ejercicios vigentes ese día. */
const alReabrir = (mesoId, dia) =>
    trainingService.getRoutinesByMesocycle(mesoId).map(r => ({
        dia: r.name,
        ejercicios: r.items
            .filter(i => (!i.effective_from || i.effective_from <= dia)
                      && (!i.effective_to || i.effective_to >= dia))
            .map(i => i.exercise_id),
    }));

/** Días tal y como los manda el editor (con su posición). */
const dias = (defs) => defs.map((d, i) => ({
    id: d.id, name: d.name, dayGroup: i,
    items: d.ejercicios.map(e => (typeof e === 'number' ? { exerciseId: e } : e)),
}));

const filasDe = (mesoId) => db.prepare(`
    SELECT i.id, i.exercise_id, i.effective_from, i.effective_to, r.name AS dia
    FROM routine_items i JOIN routines r ON r.id = i.routine_id
    WHERE r.mesocycle_id = ? ORDER BY i.id`).all(mesoId);

const borrados = () => db.prepare(
    "SELECT local_id FROM sync_deleted_log WHERE table_name = 'routine_items'").all().map(r => r.local_id);

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

describe('crear un mesociclo que empieza el lunes que viene (lo habitual)', () => {
    const INICIO = shift(5);
    const FIN = shift(88);

    test('se crea, se reabre y está exactamente como se dejó', () => {
        const r = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([
                { id: 1e12, name: 'Día 1', ejercicios: [10, 11] },
                { id: 1e12 + 1, name: 'Día 2', ejercicios: [12] },
            ]),
        });
        expect(r.success).toBe(true);

        expect(alReabrir(r.id, INICIO)).toEqual([
            { dia: 'Día 1', ejercicios: [10, 11] },
            { dia: 'Día 2', ejercicios: [12] },
        ]);
        // Nada lleva fecha: el programa no ha empezado, no hay pasado.
        expect(filasDe(r.id).every(f => !f.effective_from && !f.effective_to)).toBe(true);
    });

    test('mientras no arranque se puede quitar de todo, incluso un día entero', () => {
        const r = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([
                { id: 1e12, name: 'Día 1', ejercicios: [10, 11] },
                { id: 1e12 + 1, name: 'Día 2', ejercicios: [12] },
            ]),
        });
        const guardado = trainingService.getRoutinesByMesocycle(r.id);
        const d1 = guardado[0];

        // Se queda solo el Día 1, y dentro solo la Sentadilla.
        guardar({
            id: r.id, startDate: INICIO, endDate: FIN,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        });

        expect(alReabrir(r.id, INICIO)).toEqual([{ dia: 'Día 1', ejercicios: [10] }]);
    });

    test('quitar un ejercicio y volver a ponerlo lo deja VISIBLE', () => {
        // El fallo que esto evita: la fila retirada se cierra la víspera del
        // inicio; si al re-añadir se reaprovechara, el ejercicio entraría
        // invisible y el entrenador no entendería nada.
        const r = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];

        guardar({   // quita Press Banca
            id: r.id, startDate: INICIO, endDate: FIN,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        });
        expect(alReabrir(r.id, INICIO)).toEqual([{ dia: 'Día 1', ejercicios: [10] }]);

        guardar({   // lo vuelve a poner
            id: r.id, startDate: INICIO, endDate: FIN,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }, 11] }]),
        });
        expect(alReabrir(r.id, INICIO)).toEqual([{ dia: 'Día 1', ejercicios: [10, 11] }]);
    });
});

describe('crear un mesociclo con fecha pasada sin querer', () => {
    // Josema escribe el programa deprisa y deja una fecha de hace tres semanas
    // cuando en realidad empieza el lunes. Tiene que poder arreglarlo.
    const PASADO = shift(-21);
    const FIN_PASADO = shift(63);
    const LUNES = shift(5);

    test('nace "ya empezado", así que lo que se quite se conserva', () => {
        const r = guardar({
            startDate: PASADO, endDate: FIN_PASADO,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];

        guardar({
            id: r.id, startDate: PASADO, endDate: FIN_PASADO,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        });

        const press = filasDe(r.id).find(f => f.exercise_id === 11);
        expect(press.effective_to).toBe(AYER);     // retirado, no borrado
        expect(borrados()).toHaveLength(0);
        expect(alReabrir(r.id, HOY)).toEqual([{ dia: 'Día 1', ejercicios: [10] }]);
    });

    test('corregir la fecha al lunes deja el programa limpio y editable entero', () => {
        const r = guardar({
            startDate: PASADO, endDate: FIN_PASADO,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];

        // Se corrige la fecha y de paso se quita un ejercicio.
        guardar({
            id: r.id, startDate: LUNES, endDate: FIN_PASADO,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        });

        // Ya no está empezado: se comporta como un programa nuevo.
        expect(alReabrir(r.id, LUNES)).toEqual([{ dia: 'Día 1', ejercicios: [10] }]);
        expect(db.prepare('SELECT start_date FROM mesocycles WHERE id = ?').get(r.id).start_date).toBe(LUNES);
    });
});

describe('crear un mesociclo que empieza HOY', () => {
    const FIN = shift(83);

    test('cuenta como empezado: no se puede borrar un día con su historial', () => {
        const r = guardar({
            startDate: HOY, endDate: FIN,
            routines: dias([
                { id: 1e12, name: 'Día 1', ejercicios: [10] },
                { id: 1e12 + 1, name: 'Día 2', ejercicios: [11] },
            ]),
        });
        const g = trainingService.getRoutinesByMesocycle(r.id);

        guardar({   // intenta quedarse solo con el Día 1
            id: r.id, startDate: HOY, endDate: FIN,
            routines: dias([{ id: g[0].id, name: 'Día 1', ejercicios: [{ id: g[0].items[0].id, exerciseId: 10 }] }]),
        });

        // El día sigue ahí: el cliente pudo entrenarlo esta mañana.
        expect(db.prepare('SELECT COUNT(*) n FROM routines WHERE mesocycle_id = ?').get(r.id).n).toBe(2);
    });

    test('lo que se añade hoy se ve hoy', () => {
        const r = guardar({
            startDate: HOY, endDate: FIN,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];

        guardar({
            id: r.id, startDate: HOY, endDate: FIN,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }, 13] }]),
        });

        expect(alReabrir(r.id, HOY)).toEqual([{ dia: 'Día 1', ejercicios: [10, 13] }]);
    });
});

describe('sustituir un ejercicio en un programa en marcha', () => {
    const INICIO = shift(-30);
    const FIN = shift(54);

    test('el caso de Iván: al reabrir se ve lo nuevo, no lo viejo', () => {
        const r = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11, 12] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];
        const conservar = d1.items.filter(i => i.exercise_id !== 11).map(i => ({ id: i.id, exerciseId: i.exercise_id }));

        // Quita Press Banca (11) y mete Peso Muerto (13).
        guardar({
            id: r.id, startDate: INICIO, endDate: FIN,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [...conservar, 13] }]),
        });

        expect(alReabrir(r.id, HOY)).toEqual([{ dia: 'Día 1', ejercicios: [10, 12, 13] }]);
        // Y lo entrenado ayer sigue enseñando el ejercicio que se hizo.
        expect(alReabrir(r.id, AYER)).toEqual([{ dia: 'Día 1', ejercicios: [10, 11, 12] }]);
        expect(borrados()).toHaveLength(0);
    });

    test('guardar dos veces seguidas sin cambios no mueve nada', () => {
        const r = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];
        const mismos = d1.items.map(i => ({ id: i.id, exerciseId: i.exercise_id }));

        guardar({ id: r.id, startDate: INICIO, endDate: FIN, viewDay: HOY,
                  routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: mismos }]) });
        const antes = filasDe(r.id);
        guardar({ id: r.id, startDate: INICIO, endDate: FIN, viewDay: HOY,
                  routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: mismos }]) });

        expect(filasDe(r.id)).toEqual(antes);
        expect(borrados()).toHaveLength(0);
    });
});

describe('plantillas', () => {
    test('una plantilla no lleva fechas y se edita entera', () => {
        const r = guardar({
            isTemplate: true, startDate: null, endDate: null,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];

        guardar({
            id: r.id, isTemplate: true, startDate: null, endDate: null,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        });

        // Sin fechas se mantiene el borrado clásico: no hay historial que atar.
        expect(filasDe(r.id).map(f => f.exercise_id)).toEqual([10]);
        expect(borrados()).toHaveLength(1);
    });
});

describe('mover la fecha de inicio', () => {
    const FUTURO = shift(5);
    const FIN = shift(88);
    const PASADO = shift(-14);

    test('adelantar un programa al pasado no da falsos rechazos', () => {
        // El editor se abrió con el programa aún sin empezar (su vista es la
        // fecha de inicio, en el futuro). Al corregirla a una fecha pasada, el
        // corte pasa a ser hoy. La guardia no debe confundir eso con una vista
        // desfasada: no hay nada que pisar.
        const r = guardar({
            startDate: FUTURO, endDate: FIN,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10, 11] }]),
        });
        const d1 = trainingService.getRoutinesByMesocycle(r.id)[0];

        // Se retira un ejercicio con el programa aún sin empezar.
        guardar({
            id: r.id, startDate: FUTURO, endDate: FIN, viewDay: FUTURO,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        });

        // Y ahora se corrige la fecha a una pasada, con la vista de antes.
        expect(() => guardar({
            id: r.id, startDate: PASADO, endDate: FIN, viewDay: FUTURO,
            routines: dias([{ id: d1.id, name: 'Día 1', ejercicios: [{ id: d1.items[0].id, exerciseId: 10 }] }]),
        })).not.toThrow();

        expect(alReabrir(r.id, HOY)).toEqual([{ dia: 'Día 1', ejercicios: [10] }]);
    });

    test('retrasar un programa en marcha al futuro lo deja editable entero', () => {
        const r = guardar({
            startDate: PASADO, endDate: FIN,
            routines: dias([
                { id: 1e12, name: 'Día 1', ejercicios: [10] },
                { id: 1e12 + 1, name: 'Día 2', ejercicios: [11] },
            ]),
        });
        const g = trainingService.getRoutinesByMesocycle(r.id);

        // Se corrige: en realidad empieza el lunes. Y se quita un día.
        guardar({
            id: r.id, startDate: FUTURO, endDate: FIN,
            routines: dias([{ id: g[0].id, name: 'Día 1', ejercicios: [{ id: g[0].items[0].id, exerciseId: 10 }] }]),
        });

        expect(db.prepare('SELECT COUNT(*) n FROM routines WHERE mesocycle_id = ?').get(r.id).n).toBe(1);
        expect(alReabrir(r.id, FUTURO)).toEqual([{ dia: 'Día 1', ejercicios: [10] }]);
    });
});

describe('crear el siguiente copiando este (la salida al mover fechas)', () => {
    // Es lo que el entrenador hacía a mano moviendo las fechas del programa
    // viejo, que dejaba los entrenamientos del cliente fuera. Ahora son dos
    // guardados: cerrar el actual la víspera y crear el nuevo con el mismo
    // contenido pero filas propias.
    const INICIO = shift(-40);
    const FIN = shift(44);
    const ULTIMO_ENTRENO = shift(-3);
    const NUEVO_INICIO = shift(4);

    const conHistorial = {
        verificado: true, sinEntrenamientos: false,
        primerEntreno: shift(-38), ultimoEntreno: ULTIMO_ENTRENO,
    };

    test('el viejo conserva todo y el nuevo nace independiente', () => {
        const viejo = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([
                { id: 1e12, name: 'Día 1', ejercicios: [10, 11] },
                { id: 1e12 + 1, name: 'Día 2', ejercicios: [12] },
            ]),
        });
        const contenido = trainingService.getRoutinesByMesocycle(viejo.id);
        const comoEstan = contenido.map((r, i) => ({
            id: r.id, name: r.name, dayGroup: i,
            items: r.items.map(it => ({ id: it.id, exerciseId: it.exercise_id })),
        }));
        const filasViejas = filasDe(viejo.id).map(f => f.id);

        // 1) Cerrar el actual la víspera del nuevo.
        const vispera = shift(3);
        guardar({ ...conHistorial, id: viejo.id, startDate: INICIO, endDate: vispera, routines: comoEstan });

        // 2) Crear el siguiente, copiando: mismos ejercicios, sin ids.
        const nuevo = guardar({
            startDate: NUEVO_INICIO, endDate: shift(88),
            routines: contenido.map((r, i) => ({
                id: Date.now() + i, name: r.name, dayGroup: i,
                items: r.items.map(it => ({ exerciseId: it.exercise_id })),
            })),
        });

        // El viejo: mismas filas, ninguna borrada, y con su fin nuevo.
        expect(filasDe(viejo.id).map(f => f.id)).toEqual(filasViejas);
        expect(borrados()).toHaveLength(0);
        expect(db.prepare('SELECT end_date FROM mesocycles WHERE id = ?').get(viejo.id).end_date).toBe(vispera);

        // El nuevo: filas PROPIAS, ninguna compartida con el viejo.
        const filasNuevas = filasDe(nuevo.id).map(f => f.id);
        expect(filasNuevas).toHaveLength(3);
        expect(filasNuevas.some(id => filasViejas.includes(id))).toBe(false);

        // Y sin fechas de vigencia: empieza limpio.
        expect(filasDe(nuevo.id).every(f => !f.effective_from && !f.effective_to)).toBe(true);
        expect(alReabrir(nuevo.id, NUEVO_INICIO)).toEqual([
            { dia: 'Día 1', ejercicios: [10, 11] },
            { dia: 'Día 2', ejercicios: [12] },
        ]);
    });

    test('no se puede cerrar el viejo antes del último entrenamiento del cliente', () => {
        const viejo = guardar({
            startDate: INICIO, endDate: FIN,
            routines: dias([{ id: 1e12, name: 'Día 1', ejercicios: [10] }]),
        });
        const comoEstan = trainingService.getRoutinesByMesocycle(viejo.id).map((r, i) => ({
            id: r.id, name: r.name, dayGroup: i,
            items: r.items.map(it => ({ id: it.id, exerciseId: it.exercise_id })),
        }));
        expect(() => guardar({
            ...conHistorial, id: viejo.id, startDate: INICIO, endDate: shift(-5), routines: comoEstan,
        })).toThrow(/quedarían fuera/);
    });
});
