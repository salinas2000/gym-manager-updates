/**
 * CUÁNDO ENTRA UN CAMBIO, Y QUÉ FECHAS SE PUEDEN PONER.
 *
 * Las dos decisiones que gobiernan la edición de un programa. Van aparte y sin
 * fechas propias (`hoy` entra por parámetro) porque de ellas depende que el
 * cliente no vea nunca algo raro.
 *
 * REGLA 1 — cuándo entra un cambio. Hoy, salvo en un día que el cliente ya haya
 * entrenado esta semana: ese entra en la semana siguiente, para no descuadrarle
 * una sesión hecha. Se decide por DÍA, no por programa: si el lunes hizo el
 * Día 1 y el miércoles se le cambia el Día 2, el Día 2 entra hoy.
 *
 * REGLA 2 — qué fechas valen. Las que dejen todos los entrenamientos
 * registrados dentro del programa. Mover el inicio no descoloca nada por sí
 * solo: como cada entrenamiento está clavado a su fecha real, la rejilla de
 * semanas se desplaza por encima y caen en la semana que les toca. Lo que hace
 * daño es dejar alguno fuera.
 *
 * Las semanas se cuentan desde el INICIO del programa, no desde el lunes del
 * calendario: cuatro de los programas del gimnasio no empiezan en lunes, y ahí
 * la semana del cliente va, por ejemplo, de miércoles a martes.
 */

function pad2(n) { return String(n).padStart(2, '0'); }

/** 'YYYY-MM-DD' en hora local. */
function ymdLocal(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Fecha local desde 'YYYY-MM-DD'. null si no lo es. */
function desdeIso(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    const f = new Date(y, m - 1, d);
    return Number.isNaN(f.getTime()) ? null : f;
}

/** Suma días por calendario: inmune al cambio de hora. */
function sumaDias(iso, n) {
    const f = desdeIso(iso);
    if (!f) return null;
    f.setDate(f.getDate() + n);
    return ymdLocal(f);
}

/** Días de calendario entre dos fechas. */
function diasEntre(desde, hasta) {
    const a = desdeIso(desde);
    const b = desdeIso(hasta);
    if (!a || !b) return null;
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
        - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/**
 * Tramo de la semana del PROGRAMA en la que cae `dia`.
 *
 * Las semanas van de siete en siete desde el inicio. Antes de empezar, la
 * primera. Sin fecha de inicio no hay semanas.
 */
function semanaDelPrograma(inicio, dia) {
    const dias = diasEntre(inicio, dia);
    if (dias === null) return null;
    const n = Math.max(0, Math.floor(dias / 7));
    const start = sumaDias(String(inicio).slice(0, 10), n * 7);
    return { start, end: sumaDias(start, 6), numero: n + 1 };
}

/**
 * Desde qué día entra lo que se guarde AHORA en un día del programa.
 *
 * @param {boolean} entrenadoEstaSemana El cliente tiene entrenamientos de ese
 *        día dentro de la semana del programa en curso.
 * @param {string|null} inicio Fecha de inicio del programa.
 * @param {string} hoy 'YYYY-MM-DD'.
 * @returns {string|null} null si el programa no ha empezado (se edita entero).
 */
function corteDelDia(entrenadoEstaSemana, inicio, hoy) {
    if (!inicio) return null;                       // sin fechas: sin cortes
    if (String(inicio).slice(0, 10) > hoy) return null;   // aún no ha empezado
    if (!entrenadoEstaSemana) return hoy;
    const semana = semanaDelPrograma(inicio, hoy);
    return semana ? sumaDias(semana.end, 1) : hoy;  // el día siguiente al fin de su semana
}

/**
 * ¿Valen estas fechas para el programa?
 *
 * @param {{inicio:string, fin:string, primerEntreno:string|null, ultimoEntreno:string|null}} d
 */
function fechasValidas({ inicio, fin, primerEntreno, ultimoEntreno }) {
    const inicioMaximo = primerEntreno || null;
    const finMinimo = ultimoEntreno || null;

    if (inicio && fin && inicio > fin) {
        return { ok: false, motivo: 'La fecha de fin es anterior a la de inicio.', inicioMaximo, finMinimo };
    }
    if (primerEntreno && inicio && inicio > primerEntreno) {
        return {
            ok: false,
            motivo: `Hay entrenamientos registrados desde el ${primerEntreno}. Con ese inicio quedarían fuera del programa.`,
            inicioMaximo, finMinimo,
        };
    }
    if (ultimoEntreno && fin && fin < ultimoEntreno) {
        return {
            ok: false,
            motivo: `Hay entrenamientos registrados hasta el ${ultimoEntreno}. Con ese fin quedarían fuera del programa.`,
            inicioMaximo, finMinimo,
        };
    }
    return { ok: true, motivo: null, inicioMaximo, finMinimo };
}

/** Fin equivalente al mover el inicio, para que el programa dure lo mismo. */
function finQueMantieneLaDuracion(inicioViejo, finViejo, inicioNuevo) {
    const dias = diasEntre(inicioViejo, finViejo);
    return dias === null ? null : sumaDias(inicioNuevo, dias);
}

/**
 * Lunes que se propone al crear un programa: el de la fecha preferida, y nunca
 * uno que ya haya pasado.
 */
function lunesPropuesto(preferida, hoy) {
    const alLunes = (iso) => {
        const f = desdeIso(iso);
        if (!f) return null;
        const dia = f.getDay();
        f.setDate(f.getDate() + (dia === 1 ? 0 : (dia === 0 ? 1 : 8 - dia)));
        return ymdLocal(f);
    };
    const candidato = alLunes(preferida) || alLunes(hoy);
    return candidato >= hoy ? candidato : alLunes(hoy);
}

module.exports = {
    ymdLocal, desdeIso, sumaDias, diasEntre,
    semanaDelPrograma, corteDelDia, fechasValidas,
    finQueMantieneLaDuracion, lunesPropuesto,
};
