const dbManager = require('../db/database');
const z = require('zod');

// Validation Schemas
const createPaymentSchema = z.object({
    customer_id: z.number().int().positive(),
    amount: z.number().positive(),
    tariff_name: z.string().optional(),
    payment_date: z.string().optional(), // ISO string from frontend
});

class PaymentService {
    getByCustomer(customerId) {
        const db = dbManager.getInstance();
        const stmt = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC');
        return stmt.all(customerId);
    }

    create(data) {
        const validation = createPaymentSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { customer_id, amount, tariff_name, payment_date } = validation.data;
        const db = dbManager.getInstance();

        // Default date if not provided (should be provided for specific month/year payments)
        const finalDate = payment_date || new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO payments (customer_id, amount, tariff_name, payment_date)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(customer_id, amount, tariff_name || null, finalDate);

        return {
            id: info.lastInsertRowid,
            customer_id,
            amount,
            tariff_name,
            payment_date: finalDate
        };
    }

    delete(id) {
        const db = dbManager.getInstance();
        const info = db.prepare('DELETE FROM payments WHERE id = ?').run(id);
        return info.changes > 0;
    }

    // Deprecated but kept for backward compatibility if needed, though we are moving to explicit create/delete
    toggle(customerId, year, month, amount, paymentMethod) {
        // ... (Logic removed as we are replacing it with create/delete flows on frontend)
        throw new Error("Toggle is deprecated. Use create/delete.");
    }
}

module.exports = new PaymentService();
