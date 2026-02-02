const dbManager = require('../../db/database');
const z = require('zod');

// Validation Schemas
const createCustomerSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    tariff_id: z.number().optional().nullable(),
});

class CustomerService {
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
        // Join with tariffs to get name
        // Also fetch the LATEST membership end_date for the customer to detect scheduled drops
        const stmt = db.prepare(`
            SELECT 
                c.*, 
                t.name as tariff_name, 
                t.amount as tariff_amount,
                (SELECT end_date FROM memberships m WHERE m.customer_id = c.id ORDER BY start_date DESC LIMIT 1) as latest_end_date
            FROM customers c 
            LEFT JOIN tariffs t ON c.tariff_id = t.id 
            ORDER BY c.created_at DESC
        `);
        return stmt.all();
    }

    getById(id) {
        const db = dbManager.getInstance();
        const stmt = db.prepare('SELECT * FROM customers WHERE id = ?');
        return stmt.get(id);
    }

    create(data) {
        // Validation
        const validation = createCustomerSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { first_name, last_name, email, phone, tariff_id } = validation.data;
        const db = dbManager.getInstance();

        try {
            const gymId = this.getGymId();
            // Transaction so we create customer AND membership record atomically
            const transaction = db.transaction(() => {
                const stmt = db.prepare(`
                    INSERT INTO customers (gym_id, first_name, last_name, email, phone, tariff_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                const info = stmt.run(gymId, first_name, last_name, email, phone || null, tariff_id || null);
                const newId = info.lastInsertRowid;

                // Create initial Membership record
                db.prepare(`
                    INSERT INTO memberships (gym_id, customer_id, start_date)
                    VALUES (?, ?, ?)
                `).run(gymId, newId, new Date().toISOString());

                return { id: newId, ...data };
            });

            return transaction();
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error('Email already exists');
            }
            throw error;
        }
    }

    update(id, data) {
        // Partial validation could be added here
        const db = dbManager.getInstance();

        // Dynamic update query builder could be used, simpler version here:
        const fields = [];
        const values = [];

        if (data.first_name) { fields.push('first_name = ?'); values.push(data.first_name); }
        if (data.last_name) { fields.push('last_name = ?'); values.push(data.last_name); }
        if (data.email) { fields.push('email = ?'); values.push(data.email); }
        if (data.phone) { fields.push('phone = ?'); values.push(data.phone); }
        // NOTE: Active status update via general 'update' should probably also trigger history logic
        // But usually we use toggleActive. If strict, we should handle it here too.
        // For now, let's assume 'toggleActive' is the main way to change status or user knows what they do.
        if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
        if (data.tariff_id !== undefined) { fields.push('tariff_id = ?'); values.push(data.tariff_id); }

        // Always reset sync status on update
        fields.push('synced = 0');
        fields.push('updated_at = datetime(\'now\')');

        if (fields.length === 0) return this.getById(id);

        values.push(id);

        const stmt = db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        return this.getById(id);
    }

    toggleActive(id, mode = 'immediate') {
        const db = dbManager.getInstance();

        const result = db.transaction(() => {
            const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
            if (!customer) throw new Error('Customer not found');

            const currentActive = customer.active === 1;
            // If currently active, we are turning OFF (Deactivating)
            // If currently inactive, we are turning ON (Activating/Reactivating)

            const now = new Date(); // Local time for calculation logic
            const nowISO = now.toISOString();

            if (currentActive) {
                // DEACTIVATING
                let endDate = nowISO;
                let setActive = 0;

                if (mode === 'end_of_month') {
                    // Set end_date to end of current month
                    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    endDate = endOfMonth.toISOString();
                    setActive = 1; // KEEP ACTIVE until the date passes (cleanup routine handles flip to 0)
                } else {
                    // Immediate
                    setActive = 0;
                }

                // Update Customer Status
                db.prepare('UPDATE customers SET active = ?, synced = 0, updated_at = datetime(\'now\') WHERE id = ?').run(setActive, id);

                // Close current open membership
                db.prepare(`
                    UPDATE memberships 
                    SET end_date = ?, synced = 0, updated_at = datetime('now')
                    WHERE customer_id = ? AND end_date IS NULL
                `).run(endDate, id);

                // Return updated object WITH latest_end_date so UI updates immediately
                return { ...customer, active: setActive, latest_end_date: endDate };

            } else {
                // REACTIVATING
                // Monthly Uniqueness Check:
                // Check if there is a membership that started this month or ended this month (or is scheduled to end)

                // We are looking for a record where:
                // (start_date in current month) OR (end_date in current month AND end_date >= now)
                // Actually, simplest is: Is there a record with start_date in this month? 
                // OR Is there a record with end_date > start of this month?

                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                const existingThisMonth = db.prepare(`
                    SELECT id FROM memberships 
                    WHERE customer_id = ? 
                    AND (
                        start_date >= ? OR 
                        (end_date >= ? AND end_date IS NOT NULL)
                    )
                    ORDER BY start_date DESC
                    LIMIT 1
                `).get(id, startOfMonth, startOfMonth);

                if (existingThisMonth) {
                    // Case A: Rejoining in same month (or cancelling a scheduled drop)
                    // Just clear the end_date
                    db.prepare('UPDATE memberships SET end_date = NULL, synced = 0, updated_at = datetime(\'now\') WHERE id = ?').run(existingThisMonth.id);
                } else {
                    // Case B: Clean rejoin
                    db.prepare(`
                        INSERT INTO memberships (gym_id, customer_id, start_date)
                        VALUES (?, ?, ?)
                    `).run(this.getGymId(), id, nowISO);
                }

                // Always set to active
                db.prepare('UPDATE customers SET active = 1, synced = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);

                return { ...customer, active: 1, latest_end_date: null };
            }
        })();

        return result;
    }

    getMembershipHistory(customerId) {
        const db = dbManager.getInstance();
        const stmt = db.prepare(`
            SELECT * FROM memberships 
            WHERE customer_id = ? 
            ORDER BY start_date DESC
        `);
        return stmt.all(customerId);
    }

    delete(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const result = db.transaction(() => {
            // Log for cloud sync
            db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)')
                .run(gymId, 'customers', id);

            const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
            return stmt.run(id);
        })();

        return result;
    }
}

module.exports = new CustomerService();
