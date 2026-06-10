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
// `modalities` lists the tracking types a field applies to. Omitted = universal
// (every type). Keep in sync with the mobile mirror (field-catalog.ts) and the
// FIELD_MODALITIES map in ExerciseModal.jsx.
const FIELD_CATALOG = [
    { key: 'series',       label: 'Series',       type: 'number', prescribable: true,  loggable: false, description: 'Cuántas series tiene que hacer del ejercicio.' },
    { key: 'peso',         label: 'Peso',         type: 'number', prescribable: true,  loggable: true,  description: 'Peso en kg que mueve cada serie.', modalities: ['strength'] },
    { key: 'repeticiones', label: 'Repeticiones', type: 'text',   prescribable: true,  loggable: true,  description: 'Repeticiones objetivo (puede ser un rango como "8-10").', modalities: ['strength', 'reps_only'] },
    { key: 'tiempo',       label: 'Tiempo objetivo (min)', type: 'text', prescribable: true, loggable: false, description: 'Duración objetivo en minutos (ej. "30"). El cliente lo registra.', modalities: ['cardio_distance', 'cardio_time', 'time_only'] },
    { key: 'distancia',    label: 'Distancia objetivo (m)', type: 'text', prescribable: true, loggable: false, description: 'Distancia objetivo en metros (ej. "5000"). El cliente registra la real.', modalities: ['cardio_distance'] },
    { key: 'ritmo',        label: 'Ritmo objetivo (min/km)', type: 'text', prescribable: true, loggable: false, description: 'Ritmo objetivo min/km (ej. "6:00" o "6,5"). Se calcula solo con tiempo y distancia.', modalities: ['cardio_distance'] },
    { key: 'rpe',          label: 'RPE',          type: 'number', prescribable: true,  loggable: true,  description: 'Esfuerzo percibido (0-10) por serie.', defaultActive: false },
    { key: 'rir',          label: 'RIR',          type: 'number', prescribable: true,  loggable: true,  description: 'Repeticiones en reserva por serie.', modalities: ['strength', 'reps_only'], defaultActive: false },
    { key: 'tempo',        label: 'Tempo',        type: 'text',   prescribable: true,  loggable: false, description: 'Cadencia (excéntrica-pausa-concéntrica-pausa, ej. "3-0-1-0").', modalities: ['strength'], defaultActive: false },
    { key: 'descanso',     label: 'Descanso',     type: 'text',   prescribable: true,  loggable: false, description: 'Descanso entre series, ej. "90s".' },
    { key: 'intensidad',   label: 'Intensidad',   type: 'text',   prescribable: true,  loggable: false, description: 'Intensidad relativa (por ejemplo "% de 1RM").', modalities: ['strength'] },
    { key: 'notas',        label: 'Notas',        type: 'text',   prescribable: false, loggable: true,  description: 'Comentario del cliente por serie.' },
];

/**
 * Tracking types (exercise modalities). Each exercise declares one; it drives
 * which metric inputs the trainer prescribes and the customer logs. Plain
 * strings (no DB CHECK) so new types are a JS-only change.
 *
 * `metrics` lists the first-class log columns shown for that type:
 *   weight | reps | rpe | duration | distance
 * `custom` means "don't filter — show all active gym fields" (legacy behavior).
 *
 * Mirror at: gym-client-app/src/lib/field-catalog.ts — keep in sync.
 */
const TRACKING_TYPES = [
    { key: 'strength',        label: 'Fuerza (peso · reps)',        icon: '🏋', metrics: ['weight', 'reps', 'rpe'] },
    { key: 'cardio_distance', label: 'Cardio distancia (tiempo · km · ritmo)', icon: '🏃', metrics: ['duration', 'distance', 'pace'] },
    { key: 'cardio_time',     label: 'Cardio tiempo (solo tiempo)',  icon: '⏱', metrics: ['duration'] },
    { key: 'time_only',       label: 'Isométrico (solo tiempo)',     icon: '🧘', metrics: ['duration'] },
    { key: 'reps_only',       label: 'Peso corporal (solo reps)',    icon: '💪', metrics: ['reps', 'rpe'] },
    { key: 'custom',          label: 'Personalizado (todos los campos)', icon: '⚙', metrics: ['weight', 'reps', 'rpe', 'duration', 'distance'] },
];

const TRACKING_TYPE_BY_KEY = Object.fromEntries(TRACKING_TYPES.map(t => [t.key, t]));

const CATALOG_BY_KEY = Object.fromEntries(FIELD_CATALOG.map(f => [f.key, f]));

function isCatalogField(key) {
    if (!key) return false;
    return key.toLowerCase().trim() in CATALOG_BY_KEY;
}

function getCatalogField(key) {
    if (!key) return null;
    return CATALOG_BY_KEY[key.toLowerCase().trim()] || null;
}

module.exports = { FIELD_CATALOG, CATALOG_BY_KEY, isCatalogField, getCatalogField, TRACKING_TYPES, TRACKING_TYPE_BY_KEY };
