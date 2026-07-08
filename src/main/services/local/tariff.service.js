const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

const createTariffSchema = z.object({
    name: z.string().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    color_theme: z.string().optional(),
    // 1=mensual, 3=trimestral, 6=semestral, 12=anual
    billing_months: z.number().int().min(1).max(24).optional(),
    // false (default): amount es coste por mes. true: amount ya es el coste total del periodo.
    amount_is_total: z.union([z.boolean(), z.number()]).optional(),
});

class TariffService extends BaseService {
    // FIX: Removed getGymId() - now inherited from BaseService

    // Garantiza que exista la tarifa "Sin pago" (is_system=1, amount 0) para el
    // gimnasio activo. Es para socios que no abonan cuota (staff, familiares,
    // invitados) y no se puede eliminar. Idempotente: si ya existe una tarifa
    // llamada "Sin pago" (p.ej. recuperada de la nube) la marca como de sistema
    // en vez de duplicarla.
    ensureSystemTariff() {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        if (!gymId) return;

        const existing = db.prepare(
            "SELECT id, is_system FROM tariffs WHERE gym_id = ? AND (is_system = 1 OR lower(name) = 'sin pago') LIMIT 1"
        ).get(gymId);

        if (existing) {
            if (!existing.is_system) {
                db.prepare('UPDATE tariffs SET is_system = 1, synced = 0, updated_at = datetime(\'now\') WHERE id = ?').run(existing.id);
            }
            return;
        }

        db.prepare(
            "INSERT INTO tariffs (gym_id, name, amount, color_theme, billing_months, amount_is_total, is_system, synced) VALUES (?, 'Sin pago', 0, 'obsidian', 1, 0, 1, 0)"
        ).run(gymId);
    }

    getAll() {
        const db = dbManager.getInstance();
        this.ensureSystemTariff();
        // La tarifa de sistema ("Sin pago") va al final para no distraer de los planes de pago.
        return db.prepare('SELECT * FROM tariffs ORDER BY is_system ASC, id ASC').all();
    }

    create(data) {
        const validation = createTariffSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { name, amount, color_theme, billing_months, amount_is_total } = validation.data;
        const db = dbManager.getInstance();

        const theme = color_theme || 'emerald';
        const months = billing_months || 1;
        const isTotal = amount_is_total ? 1 : 0;
        const gymId = this.getGymId();

        const stmt = db.prepare('INSERT INTO tariffs (gym_id, name, amount, color_theme, billing_months, amount_is_total) VALUES (?, ?, ?, ?, ?, ?)');
        const info = stmt.run(gymId, name, amount, theme, months, isTotal);

        return { id: info.lastInsertRowid, name, amount, color_theme: theme, billing_months: months, amount_is_total: isTotal };
    }

    delete(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        // La tarifa de sistema ("Sin pago") no se puede eliminar.
        const target = db.prepare('SELECT is_system FROM tariffs WHERE id = ?').get(id);
        if (target && target.is_system) {
            throw new Error('La tarifa "Sin pago" es del sistema y no se puede eliminar.');
        }

        db.prepare('UPDATE customers SET tariff_id = NULL WHERE tariff_id = ?').run(id);
        // Log deletion for cloud sync before deleting
        db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)').run(gymId, 'tariffs', id);
        const info = db.prepare('DELETE FROM tariffs WHERE id = ?').run(id);
        return info.changes > 0;
    }

    update(id, data) {
        const validation = createTariffSchema.partial().safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const db = dbManager.getInstance();

        // La tarifa de sistema ("Sin pago") mantiene siempre importe 0: se puede
        // recolorear o renombrar, pero no convertir en una tarifa de pago.
        const target = db.prepare('SELECT is_system FROM tariffs WHERE id = ?').get(id);
        const isSystem = !!(target && target.is_system);

        const fields = [];
        const values = [];

        if (validation.data.name) { fields.push('name = ?'); values.push(validation.data.name); }
        if (validation.data.amount && !isSystem) { fields.push('amount = ?'); values.push(validation.data.amount); }
        if (validation.data.color_theme) { fields.push('color_theme = ?'); values.push(validation.data.color_theme); }
        if (validation.data.billing_months !== undefined) { fields.push('billing_months = ?'); values.push(validation.data.billing_months); }
        if (validation.data.amount_is_total !== undefined) { fields.push('amount_is_total = ?'); values.push(validation.data.amount_is_total ? 1 : 0); }

        // Always reset sync status on update
        fields.push('synced = 0');
        fields.push('updated_at = datetime(\'now\')');

        if (fields.length === 0) return { id, ...data }; // Nothing to update

        values.push(id);
        const stmt = db.prepare(`UPDATE tariffs SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);

        return { id, ...validation.data };
    }
}

module.exports = new TariffService();
