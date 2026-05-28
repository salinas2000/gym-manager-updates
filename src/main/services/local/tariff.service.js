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

    getAll() {
        const db = dbManager.getInstance();
        return db.prepare('SELECT * FROM tariffs').all();
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
        const fields = [];
        const values = [];

        if (validation.data.name) { fields.push('name = ?'); values.push(validation.data.name); }
        if (validation.data.amount) { fields.push('amount = ?'); values.push(validation.data.amount); }
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
