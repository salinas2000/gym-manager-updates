/**
 * Cuándo avisar al entrenador sobre la encuesta semanal.
 *
 * La regla de fondo: la encuesta de esta semana no se toca, así que cualquier
 * cambio entra el lunes. Eso significa que el momento útil para decidir es el
 * final de la semana anterior — el lunes ya es tarde y el martes aún no sabe
 * qué quiere cambiar. De ahí la ventana de jueves a domingo.
 *
 * Se deja como función pura y sin fechas propias (`hoy` entra por parámetro)
 * porque si no, esto solo se puede probar esperando al jueves.
 */

/** Lunes de la semana de `d`, como 'YYYY-MM-DD'. */
export function lunesDe(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dia = x.getDay();                       // 0 = domingo
    x.setDate(x.getDate() - (dia === 0 ? 6 : dia - 1));
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Lunes de la semana siguiente a la de `d`. */
export function lunesProximo(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    return lunesDe(x);
}

/**
 * Decide qué aviso toca, o null si no toca ninguno.
 *
 * @param {Date}    hoy
 * @param {number}  clientesOnline  cuántos clientes tienen el horario oculto
 * @param {boolean} hayVigente      hay encuesta activa esta semana
 * @param {boolean} hayPendiente    ya hay un cambio programado para el lunes
 */
export function decidirAviso({ hoy, clientesOnline, hayVigente, hayPendiente }) {
    // Sin clientes online no hay a quién preguntar: la encuesta no pinta nada.
    if (!clientesOnline) return null;

    // Caso 1: hay gente esperando y no hay ninguna encuesta. Esto sí urge, y
    // avisa cualquier día: no tiene sentido esperar al jueves para decirlo.
    if (!hayVigente) {
        return {
            id: `encuesta-sin-activa-${lunesDe(hoy)}`,
            tipo: 'sin-activa',
            title: 'Tus clientes online no tienen encuesta',
            message: clientesOnline === 1
                ? 'Tienes 1 cliente online y ninguna encuesta publicada. Publica una plantilla y la verá al momento.'
                : `Tienes ${clientesOnline} clientes online y ninguna encuesta publicada. Publica una plantilla y la verán al momento.`,
            priority: 'high',
        };
    }

    // Caso 2: ya hay una funcionando. Solo se recuerda al final de la semana,
    // y solo si no ha programado nada: si ya lo ha hecho, callar.
    const dia = hoy.getDay();                     // 4=jueves … 0=domingo
    const finDeSemana = dia === 4 || dia === 5 || dia === 6 || dia === 0;
    if (!finDeSemana || hayPendiente) return null;

    return {
        id: `encuesta-recordatorio-${lunesProximo(hoy)}`,
        tipo: 'recordatorio',
        title: 'Encuesta de la semana que viene',
        message: 'Si quieres cambiar las preguntas para la semana que viene, activa otra plantilla antes del domingo. Si no haces nada, tus clientes seguirán con la de ahora.',
        priority: 'normal',
    };
}
