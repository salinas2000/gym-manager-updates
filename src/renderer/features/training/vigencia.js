/**
 * Vigencia por fechas de los ejercicios de un programa.
 *
 * UNA SOLA REGLA: lo que se guarda entra HOY.
 *
 * Cada ejercicio de una rutina tiene effective_from / effective_to (NULL =
 * siempre). Al guardar un programa YA EMPEZADO, lo que se quita no se borra:
 * se cierra el día anterior, y lo que se añade empieza hoy. Así el historial
 * del cliente queda intacto, porque sus pesos cuelgan de esa misma fila.
 *
 * Un programa que aún no ha empezado no tiene pasado que proteger: se edita
 * entero y sus ejercicios no llevan fecha.
 *
 * Antes esto se elegía semana a semana, con un selector de "Semana N". Se
 * retiró en la 2.3.14: en un gimnasio real todos los programas duran de 12 a
 * 16 semanas y están empezados, así que el selector aparecía siempre con diez
 * u once semanas tachadas y no aportaba nada. La protección del historial, que
 * era el motivo de todo esto, se conserva entera.
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

/**
 * Día desde el que entra lo que se guarde ahora.
 *
 * Devuelve hoy si el programa ya empezó, y null si todavía no (no hay pasado
 * que proteger: se edita entero). Tiene que decidir exactamente lo mismo que
 * saveMesocycle en el proceso principal; si divergen, el editor enseñaría una
 * cosa y se guardaría otra.
 *
 * @param {string|null} startIso Fecha de inicio del programa.
 * @param {string} hoy Día de referencia, 'YYYY-MM-DD'.
 * @returns {string|null}
 */
export function diaDeCorte(startIso, hoy = ymdLocal(new Date())) {
    if (!startIso) return null;
    // El día en que arranca ya cuenta como empezado: el cliente puede haber
    // entrenado esa misma mañana. Mismo criterio que saveMesocycle.
    return String(startIso).slice(0, 10) <= hoy ? hoy : null;
}

/**
 * Día por el que se filtra lo que se ENSEÑA en el editor.
 *
 * No es lo mismo que el corte. En un programa que aún no ha empezado no hay
 * corte (se edita entero), pero la vista sí necesita una fecha: al retirar un
 * ejercicio de un programa sin arrancar, su fila no se borra, se cierra el día
 * anterior al inicio y queda invisible. Sin filtrar por la fecha de inicio,
 * esas filas retiradas volverían a aparecer en pantalla como si nada.
 *
 * @param {string|null} startIso Fecha de inicio del programa.
 * @param {string} hoy Día de referencia, 'YYYY-MM-DD'.
 * @returns {string|null} null solo si el programa no tiene fecha de inicio.
 */
export function diaDeVista(startIso, hoy = ymdLocal(new Date())) {
    if (!startIso) return null;
    return diaDeCorte(startIso, hoy) || String(startIso).slice(0, 10);
}

/**
 * Fecha que se propone al crear un programa nuevo.
 *
 * Se parte de cuando debería arrancar (el día siguiente al fin del anterior, o
 * el día 1 de este mes si aquel terminó hace tiempo) y se alinea al lunes,
 * porque los programas van por semanas completas.
 *
 * La regla que faltaba: NUNCA proponer una fecha pasada. Con el programa
 * anterior terminado hace meses se proponía el día 1 del mes actual alineado a
 * lunes, que un día 9 cae en el pasado. El programa nacía "ya empezado" y el
 * entrenador se encontraba con que no podía tocarlo entero, sin haber hecho
 * nada raro. Si el lunes calculado ya pasó, se propone el siguiente.
 *
 * @param {Date} preferida Fecha desde la que debería arrancar.
 * @param {(from?: Date) => string} lunesDe Alineador a lunes (nextMondayStr).
 * @param {string} hoy 'YYYY-MM-DD'.
 */
export function fechaPropuesta(preferida, lunesDe, hoy = ymdLocal(new Date())) {
    const candidata = lunesDe(preferida);
    return candidata < hoy ? lunesDe(new Date()) : candidata;
}

/** ¿Está el ejercicio vigente ese día? Sin día → se muestra todo. */
export function itemAppliesOn(item, day) {
    if (!day) return true;
    return (!item.effective_from || item.effective_from <= day)
        && (!item.effective_to || item.effective_to >= day);
}
