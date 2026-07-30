/**
 * Tests del catálogo de módulos y planes.
 *
 * El más importante es el de COMPLETITUD (al final): falla si se registra un
 * canal IPC cuyo namespace no está declarado en el catálogo. Es lo que evita
 * que el gating se degrade en silencio según crece la app.
 */
// OJO: tests/setup-main.js mockea `fs` globalmente (readFileSync devuelve un
// texto fijo). Aquí necesitamos leer el fichero de verdad.
const fs = jest.requireActual('fs');
const path = require('path');

const {
    MODULES,
    MODULE_KEYS,
    PLANS,
    PLAN_ORDER,
    resolveModules,
    moduleForChannel,
    PREFIX_MODULE,
    CHANNEL_MODULE,
    GRANDFATHERED,
} = require('./modules');

describe('Catálogo de módulos', () => {
    test('todo módulo referenciado en un plan existe en el catálogo', () => {
        for (const [name, plan] of Object.entries(PLANS)) {
            if (plan.modules === '*') continue;
            for (const m of plan.modules) {
                expect(`${name}:${m}`).toBe(`${name}:${MODULE_KEYS.includes(m) ? m : 'DESCONOCIDO'}`);
            }
        }
    });

    test('toda dependencia (requires) apunta a un módulo existente', () => {
        for (const [key, def] of Object.entries(MODULES)) {
            for (const r of def.requires || []) {
                expect(`${key} requiere ${r}`).toBe(`${key} requiere ${MODULE_KEYS.includes(r) ? r : 'DESCONOCIDO'}`);
            }
        }
    });

    test('PLAN_ORDER cubre exactamente los planes definidos', () => {
        expect([...PLAN_ORDER].sort()).toEqual(Object.keys(PLANS).sort());
    });
});

describe('resolveModules()', () => {
    test('plan desconocido o ausente → todo activo (fail-open)', () => {
        for (const plan of [null, undefined, '', 'inventado']) {
            const m = resolveModules(plan, null);
            expect(Object.values(m).every(Boolean)).toBe(true);
        }
    });

    test('premium activa todos los módulos', () => {
        const m = resolveModules('premium', null);
        expect(Object.values(m).every(Boolean)).toBe(true);
    });

    test('crm deja el núcleo + almacén', () => {
        const m = resolveModules('crm', null);
        expect(m.customers).toBe(true);
        expect(m.finance).toBe(true);
        expect(m.inventory).toBe(true);   // gestión de negocio, no entrenamiento
        expect(m.training).toBe(false);
        expect(m.classes).toBe(false);
        expect(m.mobile_app).toBe(false);
        expect(m.displays).toBe(false);
    });

    test('el núcleo NUNCA se puede desactivar, ni con override', () => {
        const m = resolveModules('crm', { customers: false, finance: false });
        expect(m.customers).toBe(true);
        expect(m.finance).toBe(true);
    });

    test('los overrides por gimnasio mandan sobre el plan', () => {
        expect(resolveModules('pro', { classes: false }).classes).toBe(false);
        expect(resolveModules('crm', { training: true }).training).toBe(true);
    });

    test('las dependencias apagan el módulo dependiente (rm requiere mobile_app)', () => {
        // pro incluye ambos
        expect(resolveModules('pro', null).rm).toBe(true);
        // al quitar la app, rm cae solo aunque el plan lo incluya
        const m = resolveModules('pro', { mobile_app: false });
        expect(m.mobile_app).toBe(false);
        expect(m.rm).toBe(false);
    });

    test('las dependencias no se saltan ni con override explícito', () => {
        const m = resolveModules('pro', { mobile_app: false, rm: true });
        expect(m.rm).toBe(false);
    });

    describe('REGLA DE ORO: ningún gimnasio existente pierde módulos', () => {
        // Los módulos introducidos en 2.4.0 no estaban gateados antes: todo el
        // mundo los tenía. Deben venir activos en TODOS los planes que ya
        // existían, para que nadie note el cambio al actualizar.
        const PLANES_PREEXISTENTES = ['basic', 'pro', 'premium'];
        // Los que ya existían sin gatear. NO todo módulo 2.4.0: `access` es
        // funcionalidad nueva que nadie tenía y puede ir solo en Premium.
        const NUEVOS = GRANDFATHERED.filter((k) => !MODULES[k].core);

        test('hay módulos nuevos que verificar', () => {
            expect(NUEVOS.length).toBeGreaterThan(0);
        });

        test.each(PLANES_PREEXISTENTES)('plan %s conserva los módulos nuevos', (plan) => {
            const m = resolveModules(plan, null);
            for (const nuevo of NUEVOS) {
                expect(`${plan}.${nuevo}=${m[nuevo]}`).toBe(`${plan}.${nuevo}=true`);
            }
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// NO ROMPER PRODUCCIÓN — comparación lógica vieja vs nueva
// ─────────────────────────────────────────────────────────────────────────────
// Reproduce el comportamiento anterior a 2.4.0 (renderer/lib/entitlements.js,
// ya eliminado) y comprueba que NINGÚN módulo que estuviera disponible pasa a
// estar bloqueado, para cualquier valor de plan que pueda existir en la nube.
describe('Compatibilidad con el comportamiento anterior (2.3.x)', () => {
    // Tabla exacta que había en renderer/lib/entitlements.js
    const PLAN_FEATURES_VIEJO = {
        basic:   { classes: false, trainers: false, rm: false, mobile_app: false, analytics: false },
        pro:     { classes: true,  trainers: true,  rm: true,  mobile_app: true,  analytics: false },
        premium: { classes: true,  trainers: true,  rm: true,  mobile_app: true,  analytics: true },
    };

    /** Disponibilidad de un módulo ANTES del cambio. */
    function disponibleAntes(plan, features, feature) {
        const base = plan ? PLAN_FEATURES_VIEJO[plan] : undefined;
        // Un módulo que no existía en 2.3.x (p.ej. `access`) no estaba
        // "disponible": no puede haber regresión sobre algo que no había.
        const existiaAntes = (f) => (PLAN_FEATURES_VIEJO.pro && f in PLAN_FEATURES_VIEJO.pro)
            || GRANDFATHERED.includes(f);
        if (!existiaAntes(feature)) return false;
        // Los que existían pero nunca estuvieron gateados: siempre visibles.
        if (!base) return true;
        if (!(feature in base)) return true;
        if (features && typeof features === 'object' && feature in features) return !!features[feature];
        return !!base[feature];
    }

    // Todo lo que puede haber realmente en licenses.plan, incluidos casos raros
    const PLANES_POSIBLES = [null, undefined, '', 'basic', 'pro', 'premium', 'valor_raro'];

    test.each(PLANES_POSIBLES.map((p) => [String(p)]))(
        'plan %s: ningún módulo pasa de disponible a bloqueado',
        (planStr) => {
            const plan = PLANES_POSIBLES.find((p) => String(p) === planStr);
            const ahora = resolveModules(plan, null);
            const regresiones = MODULE_KEYS.filter(
                (m) => disponibleAntes(plan, null, m) && !ahora[m],
            );
            expect(regresiones).toEqual([]);
        },
    );

    test('con overrides por gimnasio tampoco hay regresión', () => {
        const overrides = [
            { mobile_app: false },
            { classes: false },
            { classes: true, mobile_app: true },
        ];
        for (const plan of ['basic', 'pro', 'premium']) {
            for (const ov of overrides) {
                const ahora = resolveModules(plan, ov);
                const regresiones = MODULE_KEYS.filter(
                    (m) => disponibleAntes(plan, ov, m) && !ahora[m]
                        // rm depende de mobile_app: si se apaga la app a mano,
                        // que caiga rm es la intención, no una regresión.
                        && !(m === 'rm' && ov.mobile_app === false),
                );
                expect(`${plan}/${JSON.stringify(ov)}: ${regresiones}`).toBe(`${plan}/${JSON.stringify(ov)}: `);
            }
        }
    });

    test('el plan crm es el ÚNICO que restringe módulos nuevos', () => {
        // Es un plan nuevo: no puede haber ningún gimnasio en él todavía.
        const m = resolveModules('crm', null);
        expect(m.training).toBe(false);
        expect(m.displays).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESPEJO MÓVIL — la app móvil es otro repo/deploy y no puede importar de aquí,
// así que tiene una copia del catálogo. Este test impide que se desincronicen:
// si añades un plan o un módulo aquí y no lo replicas allí, falla.
// Se salta si la carpeta del móvil no está presente (clon solo de coreBuild).
// ─────────────────────────────────────────────────────────────────────────────
describe('Espejo del catálogo en la app móvil', () => {
    const espejo = path.join(__dirname, '../../../../gym-client-app/src/lib/entitlements.ts');
    const existe = fs.existsSync(espejo);
    const src = existe ? fs.readFileSync(espejo, 'utf-8') : '';

    const maybe = existe ? test : test.skip;

    maybe('declara exactamente los mismos planes', () => {
        const bloque = src.slice(src.indexOf('PLAN_MODULES'), src.indexOf('/** Módulos del núcleo'));
        const planesEnEspejo = [...bloque.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
        expect(planesEnEspejo.sort()).toEqual(Object.keys(PLANS).sort());
    });

    maybe('declara exactamente los mismos módulos', () => {
        // Extracción acotada al array: un slice hasta un comentario arrastraba
        // literales de otras líneas (p.ej. 'object' de un typeof).
        const bloque = /ALL_MODULES\s*=\s*\[([\s\S]*?)\]/.exec(src)[1];
        const modulosEnEspejo = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
        expect(modulosEnEspejo.sort()).toEqual([...MODULE_KEYS].sort());
    });

    maybe('cada plan del espejo lista los mismos módulos', () => {
        for (const [nombre, def] of Object.entries(PLANS)) {
            if (def.modules === '*') {
                expect(`${nombre}:${src.includes(`${nombre}: '*'`)}`).toBe(`${nombre}:true`);
                continue;
            }
            const linea = new RegExp(`${nombre}:\\s*\\[([^\\]]+)\\]`, 's').exec(src);
            expect(`${nombre} presente: ${!!linea}`).toBe(`${nombre} presente: true`);
            const enEspejo = [...linea[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
            expect(`${nombre}=${enEspejo.sort().join(',')}`)
                .toBe(`${nombre}=${[...def.modules].sort().join(',')}`);
        }
    });
});

describe('moduleForChannel()', () => {
    test('resuelve por prefijo de namespace', () => {
        expect(moduleForChannel('customers:create')).toBe('customers');
        expect(moduleForChannel('training:saveMesocycle')).toBe('training');
        expect(moduleForChannel('inventory:createProduct')).toBe('inventory');
    });

    test('las excepciones por canal ganan al prefijo', () => {
        expect(moduleForChannel('cloud:syncNow')).toBeNull();
        expect(moduleForChannel('cloud:inviteToMobile')).toBe('mobile_app');
        expect(moduleForChannel('cloud:getRmRecords')).toBe('rm');
        expect(moduleForChannel('cloud:displayPairStart')).toBe('displays');
    });

    test('los canales analytics: NO se atan al módulo analytics', () => {
        // Alimentan el Dashboard de todos los gimnasios: atarlos rompería el
        // dashboard de cualquier plan que no fuese Premium.
        expect(moduleForChannel('analytics:getDashboardData')).toBeNull();
    });

    test('namespace no declarado → undefined (lo caza el test de completitud)', () => {
        expect(moduleForChannel('loquesea:hola')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETITUD — la red de seguridad a largo plazo
// ─────────────────────────────────────────────────────────────────────────────
describe('Completitud del gating IPC', () => {
    const handlersSrc = fs.readFileSync(
        path.join(__dirname, '../ipc/handlers.js'),
        'utf-8',
    );
    const canales = [...handlersSrc.matchAll(/\bhandle\('([^']+)'/g)].map((m) => m[1]);

    test('se han detectado los canales IPC registrados', () => {
        expect(canales.length).toBeGreaterThan(100);
    });

    test('TODO canal IPC registrado tiene módulo declarado', () => {
        const huerfanos = canales.filter((c) => moduleForChannel(c) === undefined);
        // Si esto falla: añade el namespace a PREFIX_MODULE (o el canal a
        // CHANNEL_MODULE) en src/main/config/modules.js. Usa null si el canal
        // es de infraestructura y nunca debe bloquearse.
        expect(huerfanos).toEqual([]);
    });

    test('toda excepción de CHANNEL_MODULE corresponde a un canal real', () => {
        const fantasma = Object.keys(CHANNEL_MODULE).filter((c) => !canales.includes(c));
        expect(fantasma).toEqual([]);
    });

    test('todo módulo de PREFIX_MODULE/CHANNEL_MODULE existe en el catálogo', () => {
        const usados = [...Object.values(PREFIX_MODULE), ...Object.values(CHANNEL_MODULE)]
            .filter((m) => m !== null);
        const invalidos = usados.filter((m) => !MODULE_KEYS.includes(m));
        expect(invalidos).toEqual([]);
    });
});
