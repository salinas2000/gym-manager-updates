/**
 * Recupera el orden de los días de los programas antiguos.
 *
 * El problema: hasta la 2.3.12 el orden de los días no se guardaba en ninguna
 * parte. Al arrastrar un día, el editor renumeraba los nombres automáticos por
 * posición ("Día 1", "Día 2"...) pero al leer se ordenaba por id, así que al
 * reabrir salían revueltos. En el programa de un cliente real quedó como
 * "Día 1, Día 2, Día 4, Día 3".
 *
 * La clave: ese orden NO se perdió del todo. Está escrito en los propios
 * nombres. Si los cuatro días se llaman "Día 1".."Día 4", el número dice
 * exactamente en qué posición los dejó el entrenador. Esta migración lo lee de
 * ahí y lo guarda en day_group, que es la columna que a partir de ahora manda.
 *
 * Dónde NO se inventa nada: si algún día tiene nombre puesto a mano (Empuje,
 * Pierna...) no hay forma de saber el orden que quería, así que se congela el
 * que ve hoy (por id). No cambia nada de lo que tiene delante, y a partir de
 * ahí arrastrar ya funciona.
 *
 * Se ejecuta en cada arranque y es inofensiva a partir de la primera vez: solo
 * mira programas en los que NINGÚN día tiene posición todavía.
 */

/** "Día 3" -> 3. Cualquier otra cosa -> null. */
function numeroDeDia(nombre) {
    const m = /^\s*d[íi]a\s+(\d{1,3})\s*$/i.exec(String(nombre || ''));
    return m ? Number(m[1]) : null;
}

/**
 * Posiciones que le tocan a los días de UN programa.
 *
 * @param {Array<{id:number, name:string}>} routines Días del programa.
 * @returns {{posiciones: Array<{id:number, posicion:number}>, segun: 'nombre'|'id'}}
 *          `segun` dice de dónde salió el orden, solo para el registro.
 */
function posicionesDeUnPrograma(routines) {
    const dias = [...(routines || [])];
    if (dias.length === 0) return { posiciones: [], segun: 'id' };

    const numeros = dias.map(r => numeroDeDia(r.name));
    // El nombre solo vale si TODOS lo llevan. Con uno a mano ya no se puede
    // deducir el orden del conjunto.
    const todosNumerados = numeros.every(n => n !== null);

    const ordenados = todosNumerados
        // Empate (dos "Día 2") o hueco: se rompe por id, que es determinista.
        ? dias
            .map((r, i) => ({ r, n: numeros[i] }))
            .sort((a, b) => (a.n - b.n) || (a.r.id - b.r.id))
            .map(x => x.r)
        : [...dias].sort((a, b) => a.id - b.id);

    return {
        posiciones: ordenados.map((r, i) => ({ id: r.id, posicion: i })),
        segun: todosNumerados ? 'nombre' : 'id',
    };
}

/**
 * Aplica las posiciones a todos los programas que aún no las tienen.
 *
 * Las filas tocadas se marcan synced = 0 para que la sincronización las suba:
 * si no, la app del socio seguiría enseñando los días en el orden viejo.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{programas:number, dias:number, porNombre:number}} Resumen.
 */
function rellenarPosicionesDeDias(db) {
    // Solo programas en los que NINGÚN día tiene posición. Si alguno ya la
    // tiene, es que se guardó con una versión nueva: no se toca.
    const pendientes = db.prepare(`
        SELECT mesocycle_id
        FROM routines
        GROUP BY mesocycle_id
        HAVING SUM(CASE WHEN day_group IS NULL OR day_group = '' THEN 0 ELSE 1 END) = 0
           AND COUNT(*) > 0
    `).all().map(r => r.mesocycle_id);

    if (pendientes.length === 0) return { programas: 0, dias: 0, porNombre: 0 };

    const diasDe = db.prepare('SELECT id, name FROM routines WHERE mesocycle_id = ? ORDER BY id ASC');
    const guardar = db.prepare(
        "UPDATE routines SET day_group = @posicion, synced = 0, updated_at = datetime('now') WHERE id = @id"
    );

    let dias = 0;
    let porNombre = 0;

    const tx = db.transaction(() => {
        for (const mesoId of pendientes) {
            const { posiciones, segun } = posicionesDeUnPrograma(diasDe.all(mesoId));
            for (const p of posiciones) {
                guardar.run({ id: p.id, posicion: String(p.posicion) });
                dias++;
            }
            if (segun === 'nombre') porNombre++;
        }
    });
    tx();

    return { programas: pendientes.length, dias, porNombre };
}

/**
 * La posición tal y como debe viajar a la nube: un NÚMERO, o null.
 *
 * En SQLite day_group es texto ('0', '1'...); en la nube la columna es
 * numérica. Mandar el texto obligaría a Postgres a convertirlo, y un valor
 * raro (restos antiguos como 'A') tumbaría la subida de TODAS las rutinas del
 * lote. Aquí se convierte lo que es una posición y lo demás se manda vacío.
 *
 * @param {*} dayGroup Valor guardado en local.
 * @returns {number|null}
 */
function posicionParaNube(dayGroup) {
    const s = String(dayGroup ?? '').trim();
    return /^\d{1,3}$/.test(s) ? Number(s) : null;
}

module.exports = { numeroDeDia, posicionesDeUnPrograma, rellenarPosicionesDeDias, posicionParaNube };
