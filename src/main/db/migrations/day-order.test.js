/**
 * Recuperación del orden de los días.
 *
 * El caso real que motiva esto: un programa quedó guardado como
 * "Día 1, Día 2, Día 4, Día 3" porque el orden se leía por id y solo se
 * renumeraban los nombres. El nombre conserva la intención; la migración la
 * recupera.
 *
 * OJO: better-sqlite3 esta compilado para el ABI de Electron:
 *   ELECTRON_RUN_AS_NODE=1 npx electron node_modules/jest/bin/jest.js --selectProjects main
 */

const Database = jest.requireActual('better-sqlite3');
const { numeroDeDia, posicionesDeUnPrograma, rellenarPosicionesDeDias, posicionParaNube } = require('./day-order');

describe('posicionParaNube', () => {
    test('la posición viaja como número, y el cero se conserva', () => {
        expect(posicionParaNube('0')).toBe(0);
        expect(posicionParaNube('3')).toBe(3);
        expect(posicionParaNube(2)).toBe(2);
    });

    test('lo que no es una posición viaja vacío, sin tumbar el lote', () => {
        expect(posicionParaNube('')).toBeNull();
        expect(posicionParaNube(null)).toBeNull();
        expect(posicionParaNube(undefined)).toBeNull();
        expect(posicionParaNube('A')).toBeNull();
        expect(posicionParaNube('1abc')).toBeNull();
    });
});

describe('numeroDeDia', () => {
    test('lee el número de los nombres automáticos, con y sin tilde', () => {
        expect(numeroDeDia('Día 3')).toBe(3);
        expect(numeroDeDia('Dia 12')).toBe(12);
        expect(numeroDeDia('  día 1  ')).toBe(1);
    });

    test('un nombre puesto a mano no es un número de día', () => {
        expect(numeroDeDia('Empuje')).toBeNull();
        expect(numeroDeDia('Día de pierna')).toBeNull();
        expect(numeroDeDia('Día')).toBeNull();
        expect(numeroDeDia('3')).toBeNull();
        expect(numeroDeDia('')).toBeNull();
        expect(numeroDeDia(null)).toBeNull();
    });
});

describe('posicionesDeUnPrograma', () => {
    test('el caso real: Día 1, Día 2, Día 4, Día 3 vuelve a su sitio', () => {
        // Tal y como estan guardados (por id).
        const { posiciones, segun } = posicionesDeUnPrograma([
            { id: 442, name: 'Día 1' },
            { id: 443, name: 'Día 2' },
            { id: 444, name: 'Día 4' },
            { id: 445, name: 'Día 3' },
        ]);
        expect(segun).toBe('nombre');
        // El "Día 3" (id 445) pasa a ir antes que el "Día 4" (id 444).
        expect(posiciones).toEqual([
            { id: 442, posicion: 0 },
            { id: 443, posicion: 1 },
            { id: 445, posicion: 2 },
            { id: 444, posicion: 3 },
        ]);
    });

    test('con un nombre a mano no se inventa nada: se congela lo que ya se ve', () => {
        const { posiciones, segun } = posicionesDeUnPrograma([
            { id: 10, name: 'Día 1' },
            { id: 11, name: 'Empuje' },
            { id: 12, name: 'Día 3' },
        ]);
        expect(segun).toBe('id');
        expect(posiciones).toEqual([
            { id: 10, posicion: 0 },
            { id: 11, posicion: 1 },
            { id: 12, posicion: 2 },
        ]);
    });

    test('nombres repetidos o con huecos no rompen: el empate lo decide el id', () => {
        const { posiciones } = posicionesDeUnPrograma([
            { id: 7, name: 'Día 2' },
            { id: 5, name: 'Día 2' },
            { id: 9, name: 'Día 7' },
        ]);
        expect(posiciones).toEqual([
            { id: 5, posicion: 0 },
            { id: 7, posicion: 1 },
            { id: 9, posicion: 2 },
        ]);
    });

    test('un programa sin días no da problemas', () => {
        expect(posicionesDeUnPrograma([]).posiciones).toEqual([]);
        expect(posicionesDeUnPrograma(undefined).posiciones).toEqual([]);
    });
});

describe('rellenarPosicionesDeDias sobre SQLite real', () => {
    let db;

    const crear = () => {
        const d = new Database(':memory:');
        d.exec(`
            CREATE TABLE routines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT, mesocycle_id INTEGER, name TEXT,
                day_group TEXT, notes TEXT, synced INTEGER DEFAULT 1, updated_at TEXT
            );
        `);
        return d;
    };

    const meter = (mesoId, nombres, dayGroups = null) => {
        const ins = db.prepare(
            'INSERT INTO routines (gym_id, mesocycle_id, name, day_group, synced) VALUES (?, ?, ?, ?, 1)'
        );
        return nombres.map((n, i) =>
            Number(ins.run('G', mesoId, n, dayGroups ? dayGroups[i] : null).lastInsertRowid));
    };

    /** Lo que se verá en el editor: nombres en el orden que manda ahora. */
    const orden = (mesoId) => db.prepare(`
        SELECT name FROM routines WHERE mesocycle_id = ?
        ORDER BY CASE WHEN day_group GLOB '[0-9]*' THEN 0 ELSE 1 END ASC,
                 CASE WHEN day_group GLOB '[0-9]*' THEN CAST(day_group AS INTEGER) END ASC,
                 id ASC
    `).all(mesoId).map(r => r.name);

    beforeEach(() => { db = crear(); });
    afterEach(() => db.close());

    test('el programa revuelto se ve en su orden después de migrar', () => {
        meter(120, ['Día 1', 'Día 2', 'Día 4', 'Día 3']);
        expect(orden(120)).toEqual(['Día 1', 'Día 2', 'Día 4', 'Día 3']);   // antes

        const r = rellenarPosicionesDeDias(db);
        expect(r).toEqual({ programas: 1, dias: 4, porNombre: 1 });
        expect(orden(120)).toEqual(['Día 1', 'Día 2', 'Día 3', 'Día 4']);   // después
    });

    test('las filas tocadas se marcan para subir a la nube', () => {
        meter(120, ['Día 1', 'Día 3', 'Día 2']);
        rellenarPosicionesDeDias(db);
        const sinSubir = db.prepare('SELECT COUNT(*) n FROM routines WHERE synced = 0').get().n;
        expect(sinSubir).toBe(3);
    });

    test('correrla dos veces no cambia nada (arranca en cada inicio de la app)', () => {
        meter(120, ['Día 1', 'Día 4', 'Día 2', 'Día 3']);
        rellenarPosicionesDeDias(db);
        const despues = orden(120);

        const segunda = rellenarPosicionesDeDias(db);
        expect(segunda).toEqual({ programas: 0, dias: 0, porNombre: 0 });
        expect(orden(120)).toEqual(despues);
    });

    test('no pisa un programa que ya tiene posiciones puestas por el editor', () => {
        meter(200, ['Día 1', 'Día 2'], ['1', '0']);   // guardado ya con la versión nueva
        const r = rellenarPosicionesDeDias(db);
        expect(r.programas).toBe(0);
        expect(orden(200)).toEqual(['Día 2', 'Día 1']);
    });

    test('varios programas a la vez, cada uno por su cuenta', () => {
        meter(1, ['Día 2', 'Día 1']);
        meter(2, ['Empuje', 'Tirón']);
        const r = rellenarPosicionesDeDias(db);
        expect(r).toEqual({ programas: 2, dias: 4, porNombre: 1 });
        expect(orden(1)).toEqual(['Día 1', 'Día 2']);
        expect(orden(2)).toEqual(['Empuje', 'Tirón']);
    });

    test('sin programas no hace nada', () => {
        expect(rellenarPosicionesDeDias(db)).toEqual({ programas: 0, dias: 0, porNombre: 0 });
    });
});
