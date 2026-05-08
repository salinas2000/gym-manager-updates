const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

// Validation Schemas
const createCustomerSchema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    // FIX: Normalize email to prevent duplicates (trim + lowercase)
    email: z.string()
        .email("Invalid email address")
        .transform(val => val.toLowerCase().trim()),
    phone: z.string().optional(),
    tariff_id: z.number().optional().nullable(),
    // Profile fields
    dni: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    height_cm: z.number().optional().nullable(),
    weight_kg: z.number().optional().nullable(),
    birth_date: z.string().optional().nullable(),
    medical_info: z.object({
        diseases: z.string().optional().default(''),
        injuries: z.string().optional().default(''),
        allergies: z.string().optional().default(''),
        surgeries: z.string().optional().default(''),
    }).optional().nullable(),
});

const updateCustomerSchema = createCustomerSchema.partial();

class CustomerService extends BaseService {
    // FIX: Removed getGymId() - now inherited from BaseService

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
        const customer = stmt.get(id);
        if (customer && customer.medical_info) {
            try { customer.medical_info = JSON.parse(customer.medical_info); } catch (e) { /* keep as string */ }
        }
        return customer;
    }

    create(data) {
        // Validation
        const validation = createCustomerSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { first_name, last_name, email, phone, tariff_id, dni, address, height_cm, weight_kg, birth_date, medical_info } = validation.data;
        const db = dbManager.getInstance();

        try {
            const gymId = this.getGymId();
            const medicalJson = medical_info ? JSON.stringify(medical_info) : null;
            // Transaction so we create customer AND membership record atomically
            const transaction = db.transaction(() => {
                const stmt = db.prepare(`
                    INSERT INTO customers (gym_id, first_name, last_name, email, phone, tariff_id, dni, address, height_cm, weight_kg, birth_date, medical_info)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                const info = stmt.run(gymId, first_name, last_name, email, phone || null, tariff_id || null, dni || null, address || null, height_cm || null, weight_kg || null, birth_date || null, medicalJson);
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
            // better-sqlite3 uses error.message, not error.code for constraint errors
            if (error.message && (error.message.includes('UNIQUE constraint failed') || error.message.includes('SQLITE_CONSTRAINT'))) {
                throw new Error('Ya existe un cliente con ese email');
            }
            throw error;
        }
    }

    update(id, data) {
        const validation = updateCustomerSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const db = dbManager.getInstance();
        const validatedData = validation.data;

        const fields = [];
        const values = [];

        if (validatedData.first_name) { fields.push('first_name = ?'); values.push(validatedData.first_name); }
        if (validatedData.last_name) { fields.push('last_name = ?'); values.push(validatedData.last_name); }
        if (validatedData.email) { fields.push('email = ?'); values.push(validatedData.email); }
        if (validatedData.phone !== undefined) { fields.push('phone = ?'); values.push(validatedData.phone); }
        if (validatedData.active !== undefined) { fields.push('active = ?'); values.push(validatedData.active ? 1 : 0); }
        if (validatedData.tariff_id !== undefined) { fields.push('tariff_id = ?'); values.push(validatedData.tariff_id); }
        if (validatedData.dni !== undefined) { fields.push('dni = ?'); values.push(validatedData.dni); }
        if (validatedData.address !== undefined) { fields.push('address = ?'); values.push(validatedData.address); }
        if (validatedData.height_cm !== undefined) { fields.push('height_cm = ?'); values.push(validatedData.height_cm); }
        if (validatedData.weight_kg !== undefined) { fields.push('weight_kg = ?'); values.push(validatedData.weight_kg); }
        if (validatedData.birth_date !== undefined) { fields.push('birth_date = ?'); values.push(validatedData.birth_date); }
        if (validatedData.medical_info !== undefined) { fields.push('medical_info = ?'); values.push(validatedData.medical_info ? JSON.stringify(validatedData.medical_info) : null); }

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
                // FIX: Clear ANY future scheduled cancellations when reactivating
                // This prevents race conditions where a renewal happens before a scheduled cancellation

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

                // FIX: Clear ALL future scheduled cancellations for this customer
                // This prevents the race condition where user renews but old cancellation still fires
                db.prepare(`
                    UPDATE memberships
                    SET end_date = NULL, synced = 0, updated_at = datetime('now')
                    WHERE customer_id = ? AND end_date > ?
                `).run(id, nowISO);

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

    bulkImport(customers) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const insertStmt = db.prepare(`
            INSERT INTO customers (gym_id, first_name, last_name, email, phone, tariff_id, dni, address, height_cm, weight_kg, birth_date, medical_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMembership = db.prepare(`
            INSERT INTO memberships (gym_id, customer_id, start_date)
            VALUES (?, ?, ?)
        `);

        let imported = 0;
        let skipped = 0;
        const errors = [];

        const transaction = db.transaction((items) => {
            for (const c of items) {
                try {
                    const email = (c.email || '').toLowerCase().trim();
                    if (!email || !c.first_name) {
                        skipped++;
                        continue;
                    }

                    // Check duplicate
                    const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
                    if (existing) {
                        skipped++;
                        errors.push(`${c.first_name} ${c.last_name}: email duplicado`);
                        continue;
                    }

                    const medicalJson = c.medical_info ? JSON.stringify(c.medical_info) : null;
                    const info = insertStmt.run(
                        gymId, c.first_name, c.last_name || '', email, c.phone || null, null,
                        c.dni || null, c.address || null, c.height_cm || null, c.weight_kg || null,
                        c.birth_date || null, medicalJson
                    );
                    // Honrar el campo active si viene en el JSON (default = 1 si no se especifica)
                    if (c.active === false || c.active === 0) {
                        db.prepare('UPDATE customers SET active = 0 WHERE id = ?').run(info.lastInsertRowid);
                    }

                    // Default start_date: 1st of current month if not specified
                    const defaultStart = (() => {
                        const now = new Date();
                        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                    })();
                    insertMembership.run(gymId, info.lastInsertRowid, c.start_date || defaultStart);
                    imported++;
                } catch (err) {
                    skipped++;
                    errors.push(`${c.first_name || 'Unknown'}: ${err.message}`);
                }
            }
        });

        transaction(customers);
        return { imported, skipped, errors };
    }

    getByIds(ids) {
        if (!ids || ids.length === 0) return [];
        const db = dbManager.getInstance();
        const placeholders = ids.map(() => '?').join(',');
        return db.prepare(`
            SELECT c.*, t.name as tariff_name, t.amount as tariff_amount
            FROM customers c
            LEFT JOIN tariffs t ON c.tariff_id = t.id
            WHERE c.id IN (${placeholders})
        `).all(...ids);
    }

    /**
     * Importa clientes desde un dataset JSON (add-only por email).
     * Estructura esperada:
     *   { customers: [{ first_name, last_name, email, phone, dni, address,
     *                   height_cm, weight_kg, birth_date, medical_info, start_date }] }
     */
    importDataset(dataset) {
        if (!dataset || !Array.isArray(dataset.customers)) {
            throw new Error('Dataset inválido: falta customers[]');
        }
        return this.bulkImport(dataset.customers);
    }

    /**
     * Exporta toda la cartera de clientes del gym a un objeto JSON-friendly.
     * Incluye membresía actual (la más reciente sin end_date o la última).
     */
    exportDataset() {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const rows = db.prepare(`
            SELECT id, first_name, last_name, email, phone, dni, address,
                   height_cm, weight_kg, birth_date, medical_info, active, created_at
            FROM customers
            WHERE gym_id = ?
            ORDER BY id ASC
        `).all(gymId);

        const customers = rows.map(c => {
            let medical = null;
            if (c.medical_info) {
                try { medical = typeof c.medical_info === 'string' ? JSON.parse(c.medical_info) : c.medical_info; }
                catch { medical = null; }
            }
            const lastMem = db.prepare(`
                SELECT start_date FROM memberships
                WHERE customer_id = ? AND gym_id = ?
                ORDER BY start_date DESC LIMIT 1
            `).get(c.id, gymId);
            return {
                first_name: c.first_name,
                last_name: c.last_name,
                email: c.email,
                phone: c.phone,
                dni: c.dni,
                address: c.address,
                height_cm: c.height_cm,
                weight_kg: c.weight_kg,
                birth_date: c.birth_date,
                medical_info: medical,
                active: !!c.active,
                start_date: lastMem?.start_date || c.created_at,
            };
        });

        return {
            meta: {
                exported_at: new Date().toISOString(),
                gym_id: gymId,
                total_customers: customers.length,
            },
            customers,
        };
    }
}

module.exports = new CustomerService();
