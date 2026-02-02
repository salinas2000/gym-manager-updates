const dbManager = require('../../db/database');
const z = require('zod');

const createTariffSchema = z.object({
    name: z.string().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    color_theme: z.string().optional(),
});

class TariffService {
    getGymId() {
        try {
            const licenseService = require('./license.service');
            const data = licenseService.getLicenseData();
            return data ? data.gym_id : 'LOCAL_DEV';
        } catch (e) {
            return 'LOCAL_DEV';
        }
    }

    getAll() {
        const db = dbManager.getInstance();
        return db.prepare('SELECT * FROM tariffs').all();
    }

    create(data) {
        const validation = createTariffSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { name, amount, color_theme } = validation.data;
        const db = dbManager.getInstance();

        const theme = color_theme || 'emerald';
        const gymId = this.getGymId();

        const stmt = db.prepare('INSERT INTO tariffs (gym_id, name, amount, color_theme) VALUES (?, ?, ?, ?)');
        const info = stmt.run(gymId, name, amount, theme);

        return { id: info.lastInsertRowid, name, amount, color_theme: theme };
    }

    delete(id) {
        const db = dbManager.getInstance();
        // Maybe set customers tariff_id to NULL before delete? Or rely on FK constraints?
        // SQLite FKs are disabled by default unless PRAGMA foreign_keys = ON.
        // We enabled it in database.js (check?). database.js has PRAGMA foreign_keys = ON.
        // If ON, we need to decide. ON DELETE NO ACTION is default usually.
        // Let's just update customers to null first to be safe or assume cascade if configured (not configured).

        db.prepare('UPDATE customers SET tariff_id = NULL WHERE tariff_id = ?').run(id);
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
