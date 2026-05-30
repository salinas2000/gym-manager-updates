/**
 * Canonical Field Catalog
 * ──────────────────────
 *
 * Two independent flags describe each field:
 *
 *   prescribable: true → the trainer can set a target value in the routine
 *                       builder (shows as a chip / input in desktop and as
 *                       the placeholder of the corresponding mobile input).
 *   loggable    : true → the customer fills it per set in the mobile (renders
 *                       as an input box inside each series row).
 *
 * Some fields are both — e.g. Repeticiones is prescribed as "10-12" and the
 * customer logs the actual reps done. Some are only one — Series is just a
 * prescription count (no per-set input), Notas is a free per-set comment with
 * no prescription.
 *
 * Mirror at: gym-client-app/src/lib/field-catalog.ts — keep them in sync.
 */
const FIELD_CATALOG = [
    { key: 'series',       label: 'Series',       type: 'number', prescribable: true,  loggable: false, description: 'Cuántas series tiene que hacer del ejercicio.' },
    { key: 'peso',         label: 'Peso',         type: 'number', prescribable: true,  loggable: true,  description: 'Peso en kg que mueve cada serie.' },
    { key: 'repeticiones', label: 'Repeticiones', type: 'text',   prescribable: true,  loggable: true,  description: 'Repeticiones objetivo (puede ser un rango como "8-10").' },
    { key: 'rpe',          label: 'RPE',          type: 'number', prescribable: true,  loggable: true,  description: 'Esfuerzo percibido (0-10) por serie.' },
    { key: 'rir',          label: 'RIR',          type: 'number', prescribable: true,  loggable: true,  description: 'Repeticiones en reserva por serie.' },
    { key: 'tempo',        label: 'Tempo',        type: 'text',   prescribable: true,  loggable: false, description: 'Cadencia (excéntrica-pausa-concéntrica-pausa, ej. "3-0-1-0").' },
    { key: 'descanso',     label: 'Descanso',     type: 'text',   prescribable: true,  loggable: false, description: 'Descanso entre series, ej. "90s".' },
    { key: 'intensidad',   label: 'Intensidad',   type: 'text',   prescribable: true,  loggable: false, description: 'Intensidad relativa (por ejemplo "% de 1RM").' },
    { key: 'notas',        label: 'Notas',        type: 'text',   prescribable: false, loggable: true,  description: 'Comentario del cliente por serie.' },
];

const CATALOG_BY_KEY = Object.fromEntries(FIELD_CATALOG.map(f => [f.key, f]));

function isCatalogField(key) {
    if (!key) return false;
    return key.toLowerCase().trim() in CATALOG_BY_KEY;
}

function getCatalogField(key) {
    if (!key) return null;
    return CATALOG_BY_KEY[key.toLowerCase().trim()] || null;
}

module.exports = { FIELD_CATALOG, CATALOG_BY_KEY, isCatalogField, getCatalogField };
