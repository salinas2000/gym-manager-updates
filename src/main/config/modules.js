/**
 * Catálogo de módulos y planes — FUENTE DE VERDAD ÚNICA
 * ─────────────────────────────────────────────────────
 *
 * Dos ejes ortogonales gobiernan qué se puede hacer:
 *
 *   MÓDULO  = qué compró el gimnasio    → plan de la licencia (este fichero)
 *   PERMISO = qué puede hacer la persona → rol del usuario (fase posterior)
 *
 * Mantenerlos separados permite añadir un módulo sin tocar roles y al revés.
 *
 * La lógica vive SOLO aquí (proceso main). El renderer no calcula nada: recibe
 * el mapa ya resuelto vía `license:getStatus`, así que es imposible que la UI
 * y el backend discrepen. Ver docs/modulos-y-roles.md.
 */

// ─── Catálogo de módulos ─────────────────────────────────────────────────────
// core:     no se puede desactivar nunca (ni por plan ni por override).
// requires: dependencias; si falta alguna, el módulo se apaga solo.
// since:    versión en la que se introdujo (regla de compatibilidad, ver PLANS).
const MODULES = {
    customers:  { label: 'Socios',           core: true },
    finance:    { label: 'Pagos y tarifas',  core: true },
    training:   { label: 'Entrenamiento',    since: '2.4.0' },
    classes:    { label: 'Clases y reservas' },
    trainers:   { label: 'Entrenadores' },
    inventory:  { label: 'Almacén',          since: '2.4.0' },
    mobile_app: { label: 'App de socios' },
    rm:         { label: 'Revisión de RM',   requires: ['mobile_app'] },
    displays:   { label: 'Pantallas TV',     since: '2.4.0' },
    analytics:  { label: 'Analítica' },
};

const MODULE_KEYS = Object.keys(MODULES);

// ─── Planes ──────────────────────────────────────────────────────────────────
// REGLA DE ORO: un módulo nuevo nunca puede apagar algo que un gimnasio ya
// usaba. Por eso los módulos introducidos en 2.4.0 (training, inventory,
// displays) entran ACTIVOS en todos los planes que ya existían — antes no
// estaban gateados, así que todo el mundo los tenía. Solo el plan nuevo (crm)
// los tiene apagados. Consecuencia: ningún gimnasio actual nota el cambio,
// sea cual sea su plan.
const GRANDFATHERED = ['customers', 'finance', 'training', 'inventory', 'displays'];

const PLANS = {
    // El almacén entra en CRM: vender bebidas/suplementos es gestión de negocio,
    // no entrenamiento, así que encaja con un gimnasio que solo quiere el CRM.
    crm:     { label: 'CRM',     modules: ['customers', 'finance', 'inventory'] },
    basic:   { label: 'Básico',  modules: [...GRANDFATHERED] },
    pro:     { label: 'Pro',     modules: [...GRANDFATHERED, 'classes', 'trainers', 'mobile_app', 'rm'] },
    premium: { label: 'Premium', modules: '*' },
};

const PLAN_ORDER = ['crm', 'basic', 'pro', 'premium'];

/**
 * Resuelve el mapa completo de módulos de un gimnasio.
 *
 * Orden de aplicación (importa):
 *   1. Plan base. Plan desconocido/ausente → TODO activo (fail-open deliberado:
 *      un fallo de datos nunca debe dejar sin funciones a quien pagó).
 *   2. Overrides por gimnasio (licenses.features).
 *   3. Núcleo forzado a true — gana sobre todo lo anterior.
 *   4. Dependencias (requires) — se propagan hasta estabilizar.
 *
 * @returns {Record<string, boolean>} mapa módulo → activo
 */
function resolveModules(plan, features) {
    const out = {};
    const planDef = plan ? PLANS[plan] : null;

    // 1. Plan base
    if (!planDef) {
        for (const k of MODULE_KEYS) out[k] = true;
    } else {
        const allowed = planDef.modules === '*' ? MODULE_KEYS : planDef.modules;
        for (const k of MODULE_KEYS) out[k] = allowed.includes(k);
    }

    // 2. Overrides por gimnasio
    if (features && typeof features === 'object') {
        for (const k of MODULE_KEYS) {
            if (k in features) out[k] = !!features[k];
        }
    }

    // 3. El núcleo no se apaga jamás
    for (const k of MODULE_KEYS) {
        if (MODULES[k].core) out[k] = true;
    }

    // 4. Dependencias — bucle hasta estabilizar (soporta cadenas A→B→C)
    for (let pass = 0; pass < MODULE_KEYS.length; pass++) {
        let changed = false;
        for (const k of MODULE_KEYS) {
            const req = MODULES[k].requires;
            if (out[k] && req && !req.every((r) => out[r])) {
                out[k] = false;
                changed = true;
            }
        }
        if (!changed) break;
    }

    return out;
}

// ─── Mapeo canal IPC → módulo ────────────────────────────────────────────────
// Por prefijo de namespace. `null` = infraestructura o núcleo, nunca se bloquea.
//
// ⚠ `analytics:` va a null A PROPÓSITO: esos canales alimentan el Dashboard de
// TODOS los gimnasios. El módulo `analytics` es para una vista de analítica de
// negocio dedicada (todavía sin construir), no para estos canales. Atarlos
// rompería el dashboard de cualquier plan que no fuese Premium.
const PREFIX_MODULE = {
    customers:   'customers',
    memberships: 'customers',
    gdpr:        'customers',
    payments:    'finance',
    tariffs:     'finance',
    classes:     'classes',
    trainers:    'trainers',
    training:    'training',
    inventory:   'inventory',
    // Infraestructura / núcleo — siempre disponibles
    admin:        null,  // se rige por is_master, no por plan
    license:      null,
    credentials:  null,
    settings:     null,
    entitlements: null,  // el propio catálogo de módulos/planes
    analytics:   null,  // ver nota de arriba
    cloud:       null,  // sincronización; excepciones explícitas abajo
};

// Excepciones a nivel de canal (ganan sobre el prefijo).
const CHANNEL_MODULE = {
    'cloud:inviteToMobile':          'mobile_app',
    'cloud:revokeMobileAccess':      'mobile_app',
    'cloud:resetMobilePassword':     'mobile_app',
    'cloud:getCustomerMobileStatus': 'mobile_app',
    'cloud:getMobileLinkedCustomers':'mobile_app',
    'cloud:getRmRecords':            'rm',
    'cloud:reviewRmRecord':          'rm',
    'cloud:displayListDevices':      'displays',
    'cloud:displayPairStart':        'displays',
    'cloud:displayPairAuthorize':    'displays',
    'cloud:displayRenameDevice':     'displays',
    'cloud:displayRevokeDevice':     'displays',
};

/**
 * Módulo que exige un canal IPC.
 * @returns {string|null|undefined} nombre del módulo · null = siempre permitido
 *          · undefined = namespace no declarado (el test de completitud falla)
 */
function moduleForChannel(channel) {
    if (Object.prototype.hasOwnProperty.call(CHANNEL_MODULE, channel)) {
        return CHANNEL_MODULE[channel];
    }
    const prefix = String(channel).split(':')[0];
    if (Object.prototype.hasOwnProperty.call(PREFIX_MODULE, prefix)) {
        return PREFIX_MODULE[prefix];
    }
    return undefined;
}

module.exports = {
    MODULES,
    MODULE_KEYS,
    PLANS,
    PLAN_ORDER,
    resolveModules,
    moduleForChannel,
    PREFIX_MODULE,
    CHANNEL_MODULE,
};
