const dbManager = require('../../db/database');
const licenseService = require('./license.service');

/**
 * Control de acceso al gimnasio.
 *
 * El socio se identifica con un código corto (lo teclea en recepción o lo
 * escanea) y el sistema decide si puede pasar. Toda decisión queda registrada
 * en `access_logs`, incluidos los intentos fallidos.
 *
 * Criterio de "está al día": existe una fila de pago que cubra el MES NATURAL
 * en curso. Es el mismo criterio que usa la app móvil, y es inmune a cambios de
 * tarifa (un pago trimestral deja filas de cobertura de 0 € en cada mes).
 */

/** Motivos de decisión. Se guardan en access_logs.reason. */
const REASONS = {
    OK: 'ok',
    OK_UNPAID: 'ok_con_deuda',   // pasa, pero debe dinero (modo permisivo)
    NOT_FOUND: 'codigo_no_encontrado',
    INACTIVE: 'socio_de_baja',
    UNPAID: 'pago_pendiente',
};

const REASON_LABELS = {
    [REASONS.OK]: 'Acceso permitido',
    [REASONS.OK_UNPAID]: 'Acceso permitido — tiene un pago pendiente',
    [REASONS.NOT_FOUND]: 'Código no reconocido',
    [REASONS.INACTIVE]: 'El socio está dado de baja',
    [REASONS.UNPAID]: 'Pago del mes pendiente',
};

// Sin ambigüedades visuales: fuera O/0, I/1, etc.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

class AccessService {
    get db() {
        return dbManager.getInstance();
    }

    getGymId() {
        return licenseService.getLicenseData()?.gym_id || 'DEFAULT_GYM';
    }

    /** ¿El gimnasio deniega la entrada a quien debe dinero? Por defecto NO: es
     *  peor dejar fuera a un socio al corriente por un fallo de datos que dejar
     *  pasar a un moroso. El gimnasio puede endurecerlo en Ajustes. */
    isStrictMode() {
        const row = this.db.prepare("SELECT value FROM settings WHERE key = 'access_deny_unpaid'").get();
        return row?.value === '1' || row?.value === 'true';
    }

    generateCode() {
        let out = '';
        for (let i = 0; i < CODE_LENGTH; i++) {
            out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
        }
        return out;
    }

    /** Asigna un código único al socio si aún no tiene. Devuelve el código. */
    ensureAccessCode(customerId) {
        if (!customerId) throw new Error('ID de socio requerido');
        const existing = this.db
            .prepare('SELECT access_code FROM customers WHERE id = ?')
            .get(customerId);
        if (!existing) throw new Error('Socio no encontrado');
        if (existing.access_code) return existing.access_code;

        const gymId = this.getGymId();
        // Reintenta ante colisión — con 32^6 combinaciones es rarísimo, pero el
        // índice único haría fallar el INSERT y no queremos romper el alta.
        for (let intento = 0; intento < 10; intento++) {
            const code = this.generateCode();
            const taken = this.db
                .prepare('SELECT 1 FROM customers WHERE gym_id = ? AND access_code = ?')
                .get(gymId, code);
            if (taken) continue;
            this.db
                .prepare("UPDATE customers SET access_code = ?, synced = 0, updated_at = datetime('now') WHERE id = ?")
                .run(code, customerId);
            return code;
        }
        throw new Error('No se pudo generar un código único');
    }

    /** Genera códigos para todos los socios activos que no tengan. */
    backfillAccessCodes() {
        const gymId = this.getGymId();
        const pendientes = this.db
            .prepare('SELECT id FROM customers WHERE gym_id = ? AND active = 1 AND (access_code IS NULL OR access_code = \'\')')
            .all(gymId);
        let generados = 0;
        for (const c of pendientes) {
            try { this.ensureAccessCode(c.id); generados++; } catch { /* seguir con el resto */ }
        }
        return { generados, total: pendientes.length };
    }

    /** ¿Tiene el socio un pago que cubra el mes natural en curso? */
    hasPaidCurrentMonth(customerId) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const row = this.db
            .prepare("SELECT 1 FROM payments WHERE customer_id = ? AND strftime('%Y-%m', payment_date) = ? LIMIT 1")
            .get(customerId, ym);
        return !!row;
    }

    /** ¿La tarifa del socio es de las que no requieren pago (p.ej. "Sin pago")? */
    isFreeTariff(customer) {
        if (!customer.tariff_id) return true;   // sin tarifa asignada → no se le exige pago
        const t = this.db
            .prepare('SELECT amount FROM tariffs WHERE id = ?')
            .get(customer.tariff_id);
        if (!t) return true;
        return Number(t.amount) === 0;
    }

    /**
     * Valida un código y registra el intento.
     * @returns {{allowed:boolean, reason:string, message:string, customer:object|null}}
     */
    checkIn(code, method = 'code') {
        const gymId = this.getGymId();
        const normalized = String(code || '').trim().toUpperCase();

        const deny = (reason, customer = null) => {
            this.log({ gymId, customerId: customer?.id || null, code: normalized, allowed: 0, reason, method });
            return { allowed: false, reason, message: REASON_LABELS[reason], customer };
        };
        const allow = (reason, customer) => {
            this.log({ gymId, customerId: customer.id, code: normalized, allowed: 1, reason, method });
            return { allowed: true, reason, message: REASON_LABELS[reason], customer };
        };

        if (!normalized) return deny(REASONS.NOT_FOUND);

        const customer = this.db
            .prepare('SELECT id, first_name, last_name, active, tariff_id, photo_url FROM customers WHERE gym_id = ? AND access_code = ?')
            .get(gymId, normalized);

        if (!customer) return deny(REASONS.NOT_FOUND);
        if (!customer.active) return deny(REASONS.INACTIVE, customer);

        if (this.isFreeTariff(customer) || this.hasPaidCurrentMonth(customer.id)) {
            return allow(REASONS.OK, customer);
        }

        // Debe dinero: denegar solo si el gimnasio ha activado el modo estricto.
        return this.isStrictMode()
            ? deny(REASONS.UNPAID, customer)
            : allow(REASONS.OK_UNPAID, customer);
    }

    log({ gymId, customerId, code, allowed, reason, method }) {
        try {
            this.db
                .prepare('INSERT INTO access_logs (gym_id, customer_id, code_used, allowed, reason, method) VALUES (?, ?, ?, ?, ?, ?)')
                .run(gymId, customerId, code, allowed, reason, method || 'code');
        } catch (e) {
            // Nunca impedir el paso por un fallo de registro.
            console.error('[access] no se pudo registrar el acceso:', e.message);
        }
    }

    /** Últimos accesos, con el nombre del socio resuelto. */
    getRecent(limit = 50) {
        const gymId = this.getGymId();
        const n = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
        return this.db.prepare(`
            SELECT a.id, a.customer_id, a.code_used, a.allowed, a.reason, a.method, a.created_at,
                   c.first_name, c.last_name
            FROM access_logs a
            LEFT JOIN customers c ON c.id = a.customer_id
            WHERE a.gym_id = ?
            ORDER BY a.created_at DESC
            LIMIT ?
        `).all(gymId, n);
    }

    /** Resumen del día para la cabecera del panel. */
    getTodayStats() {
        const gymId = this.getGymId();
        const row = this.db.prepare(`
            SELECT
                COUNT(*) AS intentos,
                COALESCE(SUM(allowed), 0) AS permitidos,
                COUNT(DISTINCT CASE WHEN allowed = 1 THEN customer_id END) AS socios_unicos
            FROM access_logs
            WHERE gym_id = ? AND date(created_at) = date('now', 'localtime')
        `).get(gymId);
        return {
            intentos: row?.intentos || 0,
            permitidos: row?.permitidos || 0,
            denegados: (row?.intentos || 0) - (row?.permitidos || 0),
            sociosUnicos: row?.socios_unicos || 0,
        };
    }
}

module.exports = new AccessService();
module.exports.REASONS = REASONS;
module.exports.REASON_LABELS = REASON_LABELS;
