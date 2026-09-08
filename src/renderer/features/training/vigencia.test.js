const { weekStartStr, cutDayStr, itemAppliesOn, parseIso, ymdLocal } = require('./vigencia');

/**
 * La vista del editor tiene que mirar el MISMO día que usa el backend como
 * corte al guardar. Las fechas se fijan a dedo: el programa empieza el lunes
 * 24 de agosto de 2026 y dura 4 semanas.
 */

const INICIO = '2026-08-24';            // lunes, semana 1
const SEMANA_3 = '2026-09-07';          // lunes, semana 3

describe('weekStartStr', () => {
    test('semana 1 es el inicio; cada semana suma 7 días', () => {
        expect(weekStartStr(1, INICIO)).toBe('2026-08-24');
        expect(weekStartStr(2, INICIO)).toBe('2026-08-31');
        expect(weekStartStr(3, INICIO)).toBe('2026-09-07');
    });

    test('sin fecha de inicio no hay semanas', () => {
        expect(weekStartStr(1, null)).toBeNull();
        expect(weekStartStr(1, '')).toBeNull();
    });

    test('acepta el inicio con hora (ISO completo) sin desplazar el día', () => {
        expect(weekStartStr(2, '2026-08-24T00:00:00.000Z')).toBe('2026-08-31');
    });
});

describe('cutDayStr — el corte nunca cae en el pasado', () => {
    test('programa que aún no ha empezado: el corte es el primer día de la semana', () => {
        const hoy = '2026-08-20';
        expect(cutDayStr(1, INICIO, hoy)).toBe('2026-08-24');
        expect(cutDayStr(2, INICIO, hoy)).toBe('2026-08-31');
    });

    test('la semana empieza justo hoy: el corte es hoy (= primer día)', () => {
        expect(cutDayStr(3, INICIO, SEMANA_3)).toBe(SEMANA_3);
    });

    test('a mitad de la semana en curso: el corte se empuja a hoy', () => {
        const miercoles = '2026-09-09';
        expect(cutDayStr(3, INICIO, miercoles)).toBe(miercoles);
    });

    test('una semana futura del programa en marcha conserva su primer día', () => {
        const miercoles = '2026-09-09';
        expect(cutDayStr(4, INICIO, miercoles)).toBe('2026-09-14');
    });

    test('pedir una semana ya pasada también se empuja a hoy (igual que el backend)', () => {
        const miercoles = '2026-09-09';
        expect(cutDayStr(1, INICIO, miercoles)).toBe(miercoles);
    });

    test('sin fecha de inicio no hay corte', () => {
        expect(cutDayStr(2, null, '2026-09-09')).toBeNull();
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

describe('lo que se acaba de guardar a mitad de semana se ve al reabrir', () => {
    // Miércoles de la semana 3. El entrenador quita A y pone B, y el backend
    // cierra A ayer y arranca B hoy (corte empujado a hoy).
    const hoy = '2026-09-09';
    const ayer = '2026-09-08';
    const A = { exercise_id: 1, effective_from: null, effective_to: ayer };
    const B = { exercise_id: 2, effective_from: hoy, effective_to: null };

    test('mirando el corte real (hoy) se ve B y no A', () => {
        const dia = cutDayStr(3, INICIO, hoy);
        expect(itemAppliesOn(A, dia)).toBe(false);
        expect(itemAppliesOn(B, dia)).toBe(true);
    });

    test('mirando el lunes (el fallo original) parecería que no se guardó nada', () => {
        const lunes = weekStartStr(3, INICIO);
        expect(itemAppliesOn(A, lunes)).toBe(true);
        expect(itemAppliesOn(B, lunes)).toBe(false);
    });

    test('la semana siguiente ya solo tiene B', () => {
        const dia = cutDayStr(4, INICIO, hoy);
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
