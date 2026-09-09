const {
    semanaDelPrograma, corteDelDia, fechasValidas,
    finQueMantieneLaDuracion, lunesPropuesto, sumaDias, diasEntre,
} = require('./cortes');

/**
 * Programa de ejemplo: empieza el lunes 31 de agosto de 2026.
 * Semana 1: 31 ago – 6 sep · Semana 2: 7 – 13 sep · Semana 3: 14 – 20 sep
 */
const INICIO = '2026-08-31';

describe('semanaDelPrograma', () => {
    test('las semanas van de siete en siete desde el inicio', () => {
        expect(semanaDelPrograma(INICIO, '2026-08-31')).toEqual({ start: '2026-08-31', end: '2026-09-06', numero: 1 });
        expect(semanaDelPrograma(INICIO, '2026-09-06')).toEqual({ start: '2026-08-31', end: '2026-09-06', numero: 1 });
        expect(semanaDelPrograma(INICIO, '2026-09-07')).toEqual({ start: '2026-09-07', end: '2026-09-13', numero: 2 });
        expect(semanaDelPrograma(INICIO, '2026-09-09')).toEqual({ start: '2026-09-07', end: '2026-09-13', numero: 2 });
    });

    test('un programa que NO empieza en lunes tiene sus propias semanas', () => {
        // Cuatro programas del gimnasio son así: su semana va de miércoles a martes.
        const miercoles = '2026-09-02';
        expect(semanaDelPrograma(miercoles, '2026-09-08')).toEqual({ start: '2026-09-02', end: '2026-09-08', numero: 1 });
        expect(semanaDelPrograma(miercoles, '2026-09-09')).toEqual({ start: '2026-09-09', end: '2026-09-15', numero: 2 });
    });

    test('antes de empezar, la primera', () => {
        expect(semanaDelPrograma(INICIO, '2026-08-20').numero).toBe(1);
    });

    test('el cambio de hora no descuadra las semanas', () => {
        const s = semanaDelPrograma('2026-10-05', '2026-10-26');
        expect(s).toEqual({ start: '2026-10-26', end: '2026-11-01', numero: 4 });
    });

    test('sin fecha de inicio no hay semanas', () => {
        expect(semanaDelPrograma(null, '2026-09-09')).toBeNull();
    });
});

describe('corteDelDia — la regla que evita pisarle una sesión al cliente', () => {
    const HOY = '2026-09-09';   // miércoles, semana 2 del programa

    test('un día que aún NO ha entrenado esta semana: el cambio entra hoy', () => {
        expect(corteDelDia(false, INICIO, HOY)).toBe(HOY);
    });

    test('un día que YA entrenó esta semana: entra al empezar la siguiente', () => {
        // Su semana 2 acaba el 13, así que el cambio entra el 14.
        expect(corteDelDia(true, INICIO, HOY)).toBe('2026-09-14');
    });

    test('en un programa que no empieza en lunes, la siguiente semana es la SUYA', () => {
        const miercoles = '2026-09-02';   // semana 2: del 9 al 15
        expect(corteDelDia(true, miercoles, '2026-09-09')).toBe('2026-09-16');
    });

    test('un programa que aún no ha empezado se edita entero, sin cortes', () => {
        expect(corteDelDia(false, '2026-09-14', HOY)).toBeNull();
        expect(corteDelDia(true, '2026-09-14', HOY)).toBeNull();
    });

    test('el día en que arranca ya cuenta como empezado', () => {
        expect(corteDelDia(false, HOY, HOY)).toBe(HOY);
    });

    test('sin fecha de inicio no hay cortes (plantillas)', () => {
        expect(corteDelDia(true, null, HOY)).toBeNull();
    });

    test('el último día de la semana también entra en la siguiente', () => {
        expect(corteDelDia(true, INICIO, '2026-09-13')).toBe('2026-09-14');
    });
});

describe('fechasValidas', () => {
    const conEntrenos = { primerEntreno: '2026-09-08', ultimoEntreno: '2026-09-10' };

    test('sin entrenamientos registrados, las fechas son libres', () => {
        const r = fechasValidas({ inicio: '2026-10-05', fin: '2026-12-27', primerEntreno: null, ultimoEntreno: null });
        expect(r.ok).toBe(true);
    });

    test('EL CASO DEL ENTRENADOR: adelantar el inicio hasta el primer entrenamiento vale', () => {
        // Puso que empezaba el 31 de agosto pero empieza el 7. El cliente
        // entrenó el 8 y el 10: al mover el inicio al 7 siguen dentro, y lo que
        // estaba en la semana 2 pasa a ser la semana 1.
        const r = fechasValidas({ inicio: '2026-09-07', fin: '2026-12-27', ...conEntrenos });
        expect(r.ok).toBe(true);
    });

    test('justo en el día del primer entrenamiento, el límite', () => {
        expect(fechasValidas({ inicio: '2026-09-08', fin: '2026-12-27', ...conEntrenos }).ok).toBe(true);
    });

    test('un día más allá deja entrenamientos fuera: se bloquea', () => {
        const r = fechasValidas({ inicio: '2026-09-09', fin: '2026-12-27', ...conEntrenos });
        expect(r.ok).toBe(false);
        expect(r.motivo).toContain('2026-09-08');
        expect(r.inicioMaximo).toBe('2026-09-08');
    });

    test('acortar el fin hasta el último entrenamiento vale (cerrar un programa)', () => {
        expect(fechasValidas({ inicio: INICIO, fin: '2026-09-10', ...conEntrenos }).ok).toBe(true);
    });

    test('acortarlo más deja entrenamientos fuera', () => {
        const r = fechasValidas({ inicio: INICIO, fin: '2026-09-09', ...conEntrenos });
        expect(r.ok).toBe(false);
        expect(r.finMinimo).toBe('2026-09-10');
    });

    test('alargar el fin siempre vale', () => {
        expect(fechasValidas({ inicio: INICIO, fin: '2027-06-01', ...conEntrenos }).ok).toBe(true);
    });

    test('el fin no puede ir antes del inicio', () => {
        expect(fechasValidas({ inicio: '2026-10-01', fin: '2026-09-01', primerEntreno: null, ultimoEntreno: null }).ok).toBe(false);
    });
});

describe('finQueMantieneLaDuracion', () => {
    test('mover el inicio una semana mueve el fin otra', () => {
        expect(finQueMantieneLaDuracion('2026-08-31', '2026-11-22', '2026-09-07')).toBe('2026-11-29');
    });

    test('hacia atrás igual', () => {
        expect(finQueMantieneLaDuracion('2026-09-07', '2026-11-29', '2026-08-31')).toBe('2026-11-22');
    });

    test('sin fechas no hay nada que calcular', () => {
        expect(finQueMantieneLaDuracion(null, '2026-11-22', '2026-09-07')).toBeNull();
    });
});

describe('lunesPropuesto', () => {
    test('alinea al lunes', () => {
        expect(lunesPropuesto('2026-09-15', '2026-09-09')).toBe('2026-09-21');
    });

    test('si ya es lunes y no ha pasado, ese mismo', () => {
        expect(lunesPropuesto('2026-09-14', '2026-09-09')).toBe('2026-09-14');
    });

    test('NUNCA propone uno que ya pasó', () => {
        // El fallo real: con el programa anterior terminado hace meses se
        // partía del día 1 del mes, que alineado a lunes caía en el pasado.
        const p = lunesPropuesto('2026-09-01', '2026-09-09');
        expect(p >= '2026-09-09').toBe(true);
        expect(p).toBe('2026-09-14');
    });

    test('hoy lunes, se puede empezar hoy', () => {
        expect(lunesPropuesto('2026-09-07', '2026-09-07')).toBe('2026-09-07');
    });
});

describe('utilidades de fecha', () => {
    test('suma y resta por calendario, con cambio de hora incluido', () => {
        expect(sumaDias('2026-10-24', 7)).toBe('2026-10-31');
        expect(diasEntre('2026-10-24', '2026-10-31')).toBe(7);
        expect(diasEntre('2026-03-25', '2026-04-01')).toBe(7);
    });
});
