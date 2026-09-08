/**
 * Vigencia por fechas de los ejercicios de un programa.
 *
 * Cada ejercicio de una rutina tiene effective_from / effective_to (NULL =
 * siempre). Al editar la semana N y guardar, el backend (saveMesocycle) cierra
 * lo que se quita el día anterior al corte y hace empezar en el corte lo que
 * se añade. El corte es el primer día de la semana N... salvo que ese día ya
 * haya pasado: lo ya entrenado no se reescribe, así que el corte se empuja a
 * HOY.
 *
 * Este módulo replica esa regla en el renderer para que la vista del editor
 * mire exactamente el mismo día que va a usar el backend. Si la vista mirase
 * el lunes mientras el backend corta hoy (martes), lo recién añadido (entra
 * hoy) no aparecería y lo recién quitado (cerrado ayer) seguiría saliendo:
 * parecería que no se ha guardado nada.
 *
 * Funciones puras: `hoy` entra por parámetro para poder probarlas.
 */

export function pad2(n) { return String(n).padStart(2, '0'); }

/** 'YYYY-MM-DD' en hora local (nada de toISOString, que desplaza a UTC). */
export function ymdLocal(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parseo sin desfase UTC (nada de new Date('2026-07-01')). */
export function parseIso(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).split('T')[0].split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

/** Primer día de la semana w (1..N) de un programa que empieza en startIso. */
export function weekStartStr(w, startIso) {
    const d = parseIso(startIso);
    if (!d) return null;
    d.setDate(d.getDate() + (w - 1) * 7);
    return ymdLocal(d);
}

/**
 * Día real desde el que entra lo que se guarde editando la semana w.
 *
 * Misma regla que saveMesocycle: el primer día de la semana, empujado a hoy si
 * ya ha pasado y el programa ya está en marcha. Un programa que aún no ha
 * empezado no tiene pasado que proteger, así que ahí el corte es siempre el
 * primer día de la semana.
 */
export function cutDayStr(w, startIso, hoy = ymdLocal(new Date())) {
    const first = weekStartStr(w, startIso);
    if (!first) return null;
    const inicio = String(startIso).slice(0, 10);
    return (first < hoy && inicio < hoy) ? hoy : first;
}

/** ¿Está el ejercicio vigente ese día? Sin día → se muestra todo. */
export function itemAppliesOn(item, day) {
    if (!day) return true;
    return (!item.effective_from || item.effective_from <= day)
        && (!item.effective_to || item.effective_to >= day);
}
