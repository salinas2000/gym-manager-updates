/**
 * Tests del control de acceso.
 *
 * Lo crítico aquí es no dejar fuera a un socio que sí puede pasar: un falso
 * negativo es un cliente enfadado en la puerta. Por eso el modo permisivo es
 * el de por defecto y se prueba explícitamente.
 */
jest.mock('../../db/database');
jest.mock('./license.service');

const accessService = require('./access.service');
const { REASONS } = require('./access.service');

let mockDb;
let queries;

/** Registra las consultas para poder devolver respuestas según el SQL. */
function setupDb(handlers = {}) {
    queries = [];
    mockDb = {
        prepare: jest.fn((sql) => {
            queries.push(sql);
            const find = (kind) => Object.entries(handlers)
                .find(([frag]) => sql.includes(frag))?.[1]?.[kind];
            return {
                get: jest.fn((...args) => (find('get') ? find('get')(...args) : undefined)),
                all: jest.fn((...args) => (find('all') ? find('all')(...args) : [])),
                run: jest.fn((...args) => (find('run') ? find('run')(...args) : { changes: 1, lastInsertRowid: 1 })),
            };
        }),
        exec: jest.fn(),
        transaction: jest.fn((fn) => (...a) => fn(...a)),
    };
    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);
    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({ gym_id: 'GYM_TEST' }));
}

const SOCIO_ACTIVO = { id: 7, first_name: 'Ana', last_name: 'López', active: 1, tariff_id: 3 };

beforeEach(() => { jest.clearAllMocks(); });

describe('checkIn()', () => {
    test('deniega un código que no existe', () => {
        setupDb({ 'FROM customers WHERE gym_id': { get: () => undefined } });
        const r = accessService.checkIn('XXXXXX');
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe(REASONS.NOT_FOUND);
    });

    test('deniega un código vacío sin consultar la base de datos', () => {
        setupDb({});
        const r = accessService.checkIn('   ');
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe(REASONS.NOT_FOUND);
    });

    test('normaliza el código (minúsculas y espacios)', () => {
        let recibido = null;
        setupDb({
            'FROM customers WHERE gym_id': { get: (gym, code) => { recibido = code; return undefined; } },
        });
        accessService.checkIn('  ab12cd  ');
        expect(recibido).toBe('AB12CD');
    });

    test('deniega a un socio dado de baja', () => {
        setupDb({
            'FROM customers WHERE gym_id': { get: () => ({ ...SOCIO_ACTIVO, active: 0 }) },
        });
        const r = accessService.checkIn('ABC123');
        expect(r.allowed).toBe(false);
        expect(r.reason).toBe(REASONS.INACTIVE);
        expect(r.customer.first_name).toBe('Ana');
    });

    test('permite a un socio al corriente de pago', () => {
        setupDb({
            'FROM customers WHERE gym_id': { get: () => SOCIO_ACTIVO },
            'FROM tariffs': { get: () => ({ amount: 40 }) },
            'FROM payments': { get: () => ({ 1: 1 }) },   // pagó este mes
        });
        const r = accessService.checkIn('ABC123');
        expect(r.allowed).toBe(true);
        expect(r.reason).toBe(REASONS.OK);
    });

    test('permite con tarifa gratuita aunque no haya pagos', () => {
        setupDb({
            'FROM customers WHERE gym_id': { get: () => SOCIO_ACTIVO },
            'FROM tariffs': { get: () => ({ amount: 0 }) },   // "Sin pago"
            'FROM payments': { get: () => undefined },
        });
        const r = accessService.checkIn('ABC123');
        expect(r.allowed).toBe(true);
        expect(r.reason).toBe(REASONS.OK);
    });

    test('permite si no tiene tarifa asignada (no se le puede exigir pago)', () => {
        setupDb({
            'FROM customers WHERE gym_id': { get: () => ({ ...SOCIO_ACTIVO, tariff_id: null }) },
            'FROM payments': { get: () => undefined },
        });
        expect(accessService.checkIn('ABC123').allowed).toBe(true);
    });

    describe('socio que debe el mes', () => {
        const conDeuda = {
            'FROM customers WHERE gym_id': { get: () => SOCIO_ACTIVO },
            'FROM tariffs': { get: () => ({ amount: 40 }) },
            'FROM payments': { get: () => undefined },
        };

        test('POR DEFECTO le deja pasar avisando (no denegar por error)', () => {
            setupDb({ ...conDeuda, "key = 'access_deny_unpaid'": { get: () => undefined } });
            const r = accessService.checkIn('ABC123');
            expect(r.allowed).toBe(true);
            expect(r.reason).toBe(REASONS.OK_UNPAID);
        });

        test('en modo estricto le deniega el paso', () => {
            setupDb({ ...conDeuda, "key = 'access_deny_unpaid'": { get: () => ({ value: '1' }) } });
            const r = accessService.checkIn('ABC123');
            expect(r.allowed).toBe(false);
            expect(r.reason).toBe(REASONS.UNPAID);
        });
    });

    test('registra SIEMPRE el intento, también los fallidos', () => {
        setupDb({ 'FROM customers WHERE gym_id': { get: () => undefined } });
        accessService.checkIn('NOEXISTE');
        expect(queries.some((q) => q.includes('INSERT INTO access_logs'))).toBe(true);
    });

    test('un fallo al registrar NUNCA impide el paso', () => {
        setupDb({
            'FROM customers WHERE gym_id': { get: () => SOCIO_ACTIVO },
            'FROM tariffs': { get: () => ({ amount: 0 }) },
            'INSERT INTO access_logs': { run: () => { throw new Error('disco lleno'); } },
        });
        const r = accessService.checkIn('ABC123');
        expect(r.allowed).toBe(true);
    });
});

describe('ensureAccessCode()', () => {
    test('devuelve el código existente sin generar otro', () => {
        setupDb({ 'SELECT access_code FROM customers': { get: () => ({ access_code: 'YAEXIS' }) } });
        expect(accessService.ensureAccessCode(7)).toBe('YAEXIS');
        expect(queries.some((q) => q.includes('UPDATE customers SET access_code'))).toBe(false);
    });

    test('genera uno nuevo si no lo tiene', () => {
        setupDb({
            'SELECT access_code FROM customers': { get: () => ({ access_code: null }) },
            'SELECT 1 FROM customers WHERE gym_id': { get: () => undefined },
        });
        const code = accessService.ensureAccessCode(7);
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });

    test('el código no contiene caracteres ambiguos (O/0, I/1)', () => {
        setupDb({
            'SELECT access_code FROM customers': { get: () => ({ access_code: null }) },
            'SELECT 1 FROM customers WHERE gym_id': { get: () => undefined },
        });
        for (let i = 0; i < 60; i++) {
            expect(accessService.ensureAccessCode(7)).not.toMatch(/[O0I1]/);
        }
    });

    test('reintenta ante colisión de código', () => {
        let intentos = 0;
        setupDb({
            'SELECT access_code FROM customers': { get: () => ({ access_code: null }) },
            // Las dos primeras propuestas ya están cogidas.
            'SELECT 1 FROM customers WHERE gym_id': { get: () => (++intentos <= 2 ? { 1: 1 } : undefined) },
        });
        expect(accessService.ensureAccessCode(7)).toHaveLength(6);
        expect(intentos).toBe(3);
    });

    test('exige un id de socio', () => {
        setupDb({});
        expect(() => accessService.ensureAccessCode(null)).toThrow('ID de socio requerido');
    });

    test('falla si el socio no existe', () => {
        setupDb({ 'SELECT access_code FROM customers': { get: () => undefined } });
        expect(() => accessService.ensureAccessCode(999)).toThrow('Socio no encontrado');
    });
});

describe('getTodayStats()', () => {
    test('calcula denegados a partir de intentos y permitidos', () => {
        setupDb({ 'COUNT(*) AS intentos': { get: () => ({ intentos: 10, permitidos: 8, socios_unicos: 6 }) } });
        expect(accessService.getTodayStats()).toEqual({
            intentos: 10, permitidos: 8, denegados: 2, sociosUnicos: 6,
        });
    });

    test('no rompe cuando aún no hay accesos', () => {
        setupDb({ 'COUNT(*) AS intentos': { get: () => undefined } });
        expect(accessService.getTodayStats()).toEqual({
            intentos: 0, permitidos: 0, denegados: 0, sociosUnicos: 0,
        });
    });
});

describe('getRecent()', () => {
    test('acota el límite a un rango seguro', () => {
        setupDb({ 'FROM access_logs a': { all: () => [] } });
        let usado;
        mockDb.prepare = jest.fn((sql) => ({
            all: jest.fn((gym, n) => { usado = n; return []; }),
            get: jest.fn(), run: jest.fn(),
        }));
        accessService.getRecent(99999);
        expect(usado).toBe(500);      // techo

        accessService.getRecent(-5);
        expect(usado).toBe(1);        // suelo

        accessService.getRecent(undefined);
        expect(usado).toBe(50);       // por defecto
    });
});
