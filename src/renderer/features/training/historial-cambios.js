/**
 * Historial de cambios de un programa.
 *
 * El entrenador quiere ver qué tocó y cuándo. No hace falta guardar nada nuevo:
 * ya está en los datos. Cada ejercicio lleva desde cuándo vale y hasta cuándo,
 * así que de ahí sale la lista:
 *
 *   - un ejercicio con fecha de inicio → se AÑADIÓ ese día
 *   - un ejercicio con fecha de fin    → se QUITÓ al día siguiente
 *
 * Los que no llevan fechas son los originales del programa, y no aparecen: no
 * son un cambio, son con lo que empezó.
 *
 * Función pura, sin fechas propias.
 */

/** Día siguiente a 'YYYY-MM-DD'. */
function diaSiguiente(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    const f = new Date(y, m - 1, d + 1);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

/** Un ejercicio retirado de un programa sin empezar: no llegó a existir. */
function nuncaEstuvo(item) {
    return !!item.effective_from && !!item.effective_to && item.effective_from > item.effective_to;
}

/**
 * Cambios de un programa, agrupados por día y del más reciente al más antiguo.
 *
 * @param {Array<{name:string, items:Array}>} routines Días con sus ejercicios.
 * @returns {Array<{fecha:string, anadidos:Array, quitados:Array}>}
 */
export function historialDeCambios(routines) {
    const porFecha = new Map();
    const anota = (fecha, tipo, entrada) => {
        if (!fecha) return;
        if (!porFecha.has(fecha)) porFecha.set(fecha, { fecha, anadidos: [], quitados: [] });
        porFecha.get(fecha)[tipo].push(entrada);
    };

    for (const dia of routines || []) {
        for (const item of dia.items || []) {
            if (nuncaEstuvo(item)) continue;   // se puso y se quitó sin llegar a usarse
            const nombre = item.exercise_name || `Ejercicio #${item.exercise_id}`;
            if (item.effective_from) {
                anota(String(item.effective_from).slice(0, 10), 'anadidos', { dia: dia.name, nombre });
            }
            if (item.effective_to) {
                anota(diaSiguiente(item.effective_to), 'quitados', { dia: dia.name, nombre });
            }
        }
    }

    return [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
