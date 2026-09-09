const { diaDeCorte, itemAppliesOn, parseIso, ymdLocal } = require('./vigencia');

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

    test('el día en que arranca tampoco tiene pasado que proteger', () => {
        expect(diaDeCorte(INICIO, INICIO)).toBeNull();
    });

    test('al día siguiente de arrancar ya hay pasado', () => {
        expect(diaDeCorte(INICIO, '2026-08-25')).toBe('2026-08-25');
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
