/**
 * Desenvoltura de las respuestas del IPC.
 *
 * El envoltorio de handlers.js hace SIEMPRE `return { success: true, data: result }`
 * con lo que devuelva el servicio. Y los servicios de nube ya devuelven de por sí
 * `{ success, data }`. Así que al renderer le llega un doble envoltorio:
 *
 *     { success: true, data: { success: true, data: [...] } }
 *
 * Mientras que un servicio local que devuelve un array llega con uno solo:
 *
 *     { success: true, data: [...] }
 *
 * Leerlo a mano en cada sitio es una fuente segura de fallos: si te equivocas de
 * nivel, unas veces revienta ("x is not iterable") y otras falla en silencio
 * dentro de un catch y la pantalla sale vacía sin decir por qué. Estas dos
 * funciones aceptan las dos formas, así que da igual cuál devuelva el canal.
 */

/** Devuelve el objeto del servicio, venga con uno o con dos envoltorios. */
export function unwrap(res) {
    if (!res || typeof res !== 'object') return null;
    const dentro = res.data;
    if (dentro && typeof dentro === 'object' && !Array.isArray(dentro) && 'success' in dentro) {
        return dentro;
    }
    return res;
}

/** Lista de un campo de la respuesta. Siempre un array, nunca undefined. */
export function unwrapList(res, campo = 'data') {
    const obj = unwrap(res);
    const v = obj ? obj[campo] : null;
    return Array.isArray(v) ? v : [];
}
