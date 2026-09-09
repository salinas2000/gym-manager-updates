const { diaDeCorte, diaDeVista, fechaPropuesta, itemAppliesOn, parseIso, ymdLocal } = require('./vigencia');

/**
 * La regla es una sola: lo que se guarda entra HOY, y solo si el programa ya
 * empezó. El editor tiene que mirar exactamente el mismo día que usará el
 * proceso principal al guardar; si divergen, se enseña una cosa y se guarda
 * otra (que es justo el fallo que reportó el entrenador).
 *
 * Fechas fijas: el programa empieza el lunes 24 de agosto de 2026.
 */

const INICIO = '2026-08-24';

describe('diaDeCorte', () => {
    test('programa ya empezado: los cambios entran hoy', () => {
        expect(diaDeCorte(INICIO, '2026-09-09')).toBe('2026-09-09');
    });

    test('programa que aún no ha empezado: sin corte, se edita entero', () => {
        expect(diaDeCorte(INICIO, '2026-08-20')).toBeNull();
    });

    test('el día en que arranca YA cuenta como empezado', () => {
        // El cliente puede haber entrenado esa misma mañana. Tratarlo como
        // virgen permitiría borrar un día entero con sus registros dentro.
        expect(diaDeCorte(INICIO, INICIO)).toBe(INICIO);
    });

    test('la víspera todavía no', () => {
        expect(diaDeCorte(INICIO, '2026-08-23')).toBeNull();
    });

    test('sin fecha de inicio no hay corte', () => {
        expect(diaDeCorte(null, '2026-09-09')).toBeNull();
        expect(diaDeCorte('', '2026-09-09')).toBeNull();
    });

    test('acepta el inicio con hora (ISO completo)', () => {
        expect(diaDeCorte('2026-08-24T00:00:00.000Z', '2026-09-09')).toBe('2026-09-09');
    });
});

describe('itemAppliesOn', () => {
    test('sin rango está vigente siempre; sin día se muestra todo', () => {
        expect(itemAppliesOn({ effective_from: null, effective_to: null }, '2026-09-09')).toBe(true);
        expect(itemAppliesOn({ effective_from: '2026-09-20', effective_to: null }, null)).toBe(true);
    });

    test('los extremos del rango son inclusivos', () => {
        const it = { effective_from: '2026-09-07', effective_to: '2026-09-13' };
        expect(itemAppliesOn(it, '2026-09-06')).toBe(false);
        expect(itemAppliesOn(it, '2026-09-07')).toBe(true);
        expect(itemAppliesOn(it, '2026-09-13')).toBe(true);
        expect(itemAppliesOn(it, '2026-09-14')).toBe(false);
    });

    test('un rango vacío (cerrado antes de empezar) no se ve nunca', () => {
        const it = { effective_from: '2026-09-09', effective_to: '2026-09-08' };
        expect(itemAppliesOn(it, '2026-09-08')).toBe(false);
        expect(itemAppliesOn(it, '2026-09-09')).toBe(false);
    });
});

describe('lo que se acaba de guardar se ve al reabrir', () => {
    // El entrenador quita A y pone B un miércoles. El guardado cierra A ayer y
    // arranca B hoy.
    const hoy = '2026-09-09';
    const ayer = '2026-09-08';
    const A = { exercise_id: 1, effective_from: null, effective_to: ayer };
    const B = { exercise_id: 2, effective_from: hoy, effective_to: null };

    test('al reabrir se ve B y no A', () => {
        const dia = diaDeCorte(INICIO, hoy);
        expect(itemAppliesOn(A, dia)).toBe(false);
        expect(itemAppliesOn(B, dia)).toBe(true);
    });

    test('mañana sigue viéndose lo mismo', () => {
        const dia = diaDeCorte(INICIO, '2026-09-10');
        expect(itemAppliesOn(A, dia)).toBe(false);
        expect(itemAppliesOn(B, dia)).toBe(true);
    });
});

describe('parseIso / ymdLocal', () => {
    test('ida y vuelta sin desfase de zona horaria', () => {
        expect(ymdLocal(parseIso('2026-09-09'))).toBe('2026-09-09');
        expect(ymdLocal(parseIso('2026-09-09T22:00:00.000Z'))).toBe('2026-09-09');
        expect(parseIso('no-es-fecha')).toBeNull();
    });
});

describe('diaDeVista — lo que se ENSEÑA en el editor', () => {
    test('programa en marcha: se ve lo vigente hoy', () => {
        expect(diaDeVista(INICIO, '2026-09-09')).toBe('2026-09-09');
    });

    test('programa que aún no ha empezado: se ve lo vigente el día que arranca', () => {
        // Importa: al retirar un ejercicio de un programa sin arrancar, su fila
        // se cierra la víspera del inicio. Si la vista no filtrara, esas filas
        // retiradas volverían a aparecer en pantalla como si nada.
        expect(diaDeVista(INICIO, '2026-08-20')).toBe(INICIO);
    });

    test('sin fecha de inicio no se filtra nada', () => {
        expect(diaDeVista(null, '2026-09-09')).toBeNull();
    });

    test('un ejercicio retirado de un programa sin empezar no se ve', () => {
        const dia = diaDeVista(INICIO, '2026-08-20');
        const retirado = { effective_from: null, effective_to: '2026-08-23' }; // víspera
        expect(itemAppliesOn(retirado, dia)).toBe(false);
    });
});

describe('fechaPropuesta — al crear un programa nuevo', () => {
    // Alineador a lunes, igual que el del editor.
    const lunesDe = (from) => {
        const d = from ? new Date(from) : new Date();
        d.setHours(0, 0, 0, 0);
        const dia = d.getDay();
        d.setDate(d.getDate() + (dia === 1 ? 0 : (dia === 0 ? 1 : 8 - dia)));
        return ymdLocal(d);
    };

    test('un arranque futuro se respeta', () => {
        expect(fechaPropuesta(new Date(2026, 8, 14), lunesDe, '2026-09-09')).toBe('2026-09-14');
    });

    test('NO propone una fecha pasada', () => {
        // El caso real: el programa anterior terminó hace meses, así que se
        // parte del día 1 de este mes. Alineado a lunes da el 7, y hoy es 9.
        const propuesta = fechaPropuesta(new Date(2026, 8, 1), lunesDe, '2026-09-09');
        expect(propuesta >= '2026-09-09').toBe(true);
    });

    test('si hoy es lunes, se puede empezar hoy mismo', () => {
        expect(fechaPropuesta(new Date(2026, 8, 7), lunesDe, '2026-09-07')).toBe('2026-09-07');
    });
});
