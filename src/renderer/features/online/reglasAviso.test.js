const { decidirAviso, lunesDe, lunesProximo } = require('./reglasAviso');

/**
 * Cuándo salta el aviso de la encuesta.
 *
 * Las fechas se fijan a dedo (septiembre de 2026: el 7 es lunes) porque lo que
 * se prueba aquí es justamente el día de la semana.
 */

const dia = (d) => new Date(2026, 8, d);        // mes 8 = septiembre

describe('decidirAviso', () => {
    test('sin clientes online no avisa nunca, aunque no haya encuesta', () => {
        expect(decidirAviso({
            hoy: dia(4), clientesOnline: 0, hayVigente: false, hayPendiente: false,
        })).toBeNull();
    });

    test('sin encuesta activa avisa cualquier día, no solo el jueves', () => {
        for (const d of [1, 2, 3, 4, 5, 6, 7]) {     // martes a lunes
            const a = decidirAviso({
                hoy: dia(d), clientesOnline: 3, hayVigente: false, hayPendiente: false,
            });
            expect(a).not.toBeNull();
            expect(a.tipo).toBe('sin-activa');
        }
    });

    test('el aviso de "sin encuesta" dice cuántos clientes esperan', () => {
        const uno = decidirAviso({ hoy: dia(2), clientesOnline: 1, hayVigente: false, hayPendiente: false });
        expect(uno.message).toContain('1 cliente online');
        const varios = decidirAviso({ hoy: dia(2), clientesOnline: 7, hayVigente: false, hayPendiente: false });
        expect(varios.message).toContain('7 clientes online');
    });

    test('con encuesta activa solo recuerda de jueves a domingo', () => {
        const conEncuesta = (d) => decidirAviso({
            hoy: dia(d), clientesOnline: 2, hayVigente: true, hayPendiente: false,
        });
        // 7=lunes, 8=martes, 9=miércoles → callado
        expect(conEncuesta(7)).toBeNull();
        expect(conEncuesta(8)).toBeNull();
        expect(conEncuesta(9)).toBeNull();
        // 10=jueves, 11=viernes, 12=sábado, 13=domingo → avisa
        for (const d of [10, 11, 12, 13]) {
            expect(conEncuesta(d)?.tipo).toBe('recordatorio');
        }
    });

    test('si ya hay un cambio programado se calla: no hay nada que recordar', () => {
        expect(decidirAviso({
            hoy: dia(11), clientesOnline: 2, hayVigente: true, hayPendiente: true,
        })).toBeNull();
    });

    test('el id del recordatorio es el lunes al que apunta, así no se repite', () => {
        // Jueves 10 y domingo 13 apuntan al mismo lunes: mismo id, un solo aviso.
        const jueves = decidirAviso({ hoy: dia(10), clientesOnline: 1, hayVigente: true, hayPendiente: false });
        const domingo = decidirAviso({ hoy: dia(13), clientesOnline: 1, hayVigente: true, hayPendiente: false });
        expect(jueves.id).toBe(domingo.id);
        expect(jueves.id).toContain('2026-09-14');
    });
});

describe('lunes', () => {
    test('el lunes de un domingo es el lunes anterior, no el siguiente', () => {
        expect(lunesDe(dia(13))).toBe('2026-09-07');   // domingo 13
        expect(lunesDe(dia(7))).toBe('2026-09-07');    // el propio lunes
    });

    test('lunesProximo salta a la semana siguiente', () => {
        expect(lunesProximo(dia(10))).toBe('2026-09-14');
        expect(lunesProximo(dia(13))).toBe('2026-09-14');  // domingo → mismo lunes
    });
});
