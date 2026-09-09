const { historialDeCambios } = require('./historial-cambios');

const dia = (name, items) => ({ name, items });
const ej = (exercise_name, effective_from = null, effective_to = null) =>
    ({ exercise_name, exercise_id: 1, effective_from, effective_to });

describe('historialDeCambios', () => {
    test('los ejercicios originales no son un cambio', () => {
        expect(historialDeCambios([dia('Día 1', [ej('Sentadilla'), ej('Remo')])])).toEqual([]);
    });

    test('un ejercicio con fecha de inicio se añadió ese día', () => {
        const h = historialDeCambios([dia('Día 1', [ej('Curl', '2026-09-09')])]);
        expect(h).toEqual([{ fecha: '2026-09-09', anadidos: [{ dia: 'Día 1', nombre: 'Curl' }], quitados: [] }]);
    });

    test('un ejercicio cerrado se quitó al día siguiente', () => {
        // Se cierra la víspera, así que el cambio se hizo el día de después.
        const h = historialDeCambios([dia('Día 1', [ej('Press', null, '2026-09-08')])]);
        expect(h).toEqual([{ fecha: '2026-09-09', anadidos: [], quitados: [{ dia: 'Día 1', nombre: 'Press' }] }]);
    });

    test('una sustitución sale como un solo cambio, con las dos cosas', () => {
        const h = historialDeCambios([dia('Día 1', [
            ej('Press', null, '2026-09-08'),
            ej('Curl', '2026-09-09'),
        ])]);
        expect(h).toHaveLength(1);
        expect(h[0]).toEqual({
            fecha: '2026-09-09',
            anadidos: [{ dia: 'Día 1', nombre: 'Curl' }],
            quitados: [{ dia: 'Día 1', nombre: 'Press' }],
        });
    });

    test('varios días se juntan en el mismo cambio', () => {
        const h = historialDeCambios([
            dia('Día 1', [ej('Curl', '2026-09-09')]),
            dia('Día 2', [ej('Fondos', '2026-09-09')]),
        ]);
        expect(h).toHaveLength(1);
        expect(h[0].anadidos.map(a => a.dia)).toEqual(['Día 1', 'Día 2']);
    });

    test('lo más reciente va primero', () => {
        const h = historialDeCambios([dia('Día 1', [
            ej('A', '2026-08-01'), ej('B', '2026-09-09'), ej('C', '2026-08-15'),
        ])]);
        expect(h.map(x => x.fecha)).toEqual(['2026-09-09', '2026-08-15', '2026-08-01']);
    });

    test('lo que se puso y se quitó sin llegar a usarse no aparece', () => {
        // Rango vacío: es lo que queda al retirar algo de un programa sin empezar.
        const h = historialDeCambios([dia('Día 1', [ej('Fantasma', '9999-12-31', '1900-01-01')])]);
        expect(h).toEqual([]);
    });

    test('un ejercicio sin nombre se identifica por su número', () => {
        const h = historialDeCambios([dia('Día 1', [{ exercise_id: 42, effective_from: '2026-09-09' }])]);
        expect(h[0].anadidos[0].nombre).toBe('Ejercicio #42');
    });

    test('sin días no hay historial', () => {
        expect(historialDeCambios([])).toEqual([]);
        expect(historialDeCambios(undefined)).toEqual([]);
    });

    test('el caso real de Iván: seis cambios el mismo día en cuatro días', () => {
        const h = historialDeCambios([
            dia('Día 1', [ej('Sentadilla salto', null, '2026-09-07'), ej('Hip thrust', '2026-09-08')]),
            dia('Día 3', [ej('Prensa', null, '2026-09-07'), ej('TDC en step', '2026-09-08')]),
        ]);
        expect(h).toHaveLength(1);
        expect(h[0].fecha).toBe('2026-09-08');
        expect(h[0].anadidos).toHaveLength(2);
        expect(h[0].quitados).toHaveLength(2);
    });
});
