const dbManager = require('../../db/database');
const z = require('zod');

// Validation Schemas
const createPaymentSchema = z.object({
    customer_id: z.number().int().positive(),
    amount: z.number().positive(),
    tariff_name: z.string().optional(),
    payment_date: z.string().optional(), // ISO string from frontend
});

class PaymentService {
    getGymId() {
        try {
            const licenseService = require('./license.service');
            const data = licenseService.getLicenseData();
            return data ? data.gym_id : 'LOCAL_DEV';
        } catch (e) {
            return 'LOCAL_DEV';
        }
    }

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

        const gymId = this.getGymId();
        const stmt = db.prepare(`
            INSERT INTO payments (gym_id, customer_id, amount, tariff_name, payment_date)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(gymId, customer_id, amount, tariff_name || null, finalDate);

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
        const gymId = this.getGymId();

        const result = db.transaction(() => {
            db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)')
                .run(gymId, 'payments', id);

            const info = db.prepare('DELETE FROM payments WHERE id = ?').run(id);
            return info.changes > 0;
        })();

        return result;
    }

    async getMonthlyReport(year, month) {
        const db = dbManager.getInstance();

        // months are 1-12
        const monthStr = String(month).padStart(2, '0');
        const startDate = `${year}-${monthStr}-01`;
        const endDate = month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, '0')}-01`;

        // Join customers with their payments in this range
        // ONLY include customers who were already registered (memberships.start_date < endDate)
        const stmt = db.prepare(`
            SELECT 
                c.id, 
                c.first_name, 
                c.last_name, 
                c.active,
                t.name as tariff_name, 
                t.amount as tariff_amount,
                (SELECT SUM(amount) FROM payments p 
                 WHERE p.customer_id = c.id 
                 AND p.payment_date >= ? AND p.payment_date < ?) as paid_amount,
                (SELECT MAX(payment_date) FROM payments p WHERE p.customer_id = c.id) as last_payment_date,
                (SELECT start_date FROM memberships m 
                 WHERE m.customer_id = c.id 
                 AND (m.end_date IS NULL OR m.end_date >= ?)
                 AND m.start_date < ?
                 ORDER BY m.start_date DESC LIMIT 1) as joined_date
            FROM customers c
            LEFT JOIN tariffs t ON c.tariff_id = t.id
            WHERE EXISTS (
                SELECT 1 FROM memberships m 
                WHERE m.customer_id = c.id 
                AND (m.end_date IS NULL OR m.end_date >= ?)
                AND m.start_date < ?
            )
            ORDER BY c.last_name ASC, c.first_name ASC
        `);

        const data = stmt.all(startDate, endDate, startDate, endDate, startDate, endDate);

        return data.map(item => {
            let targetAmount = item.tariff_amount || 0;

            // Proration Logic: If joined mid-month, calculate percentage of month
            if (item.joined_date) {
                const joinDate = new Date(item.joined_date);
                const monthStart = new Date(startDate);
                const nextMonth = new Date(endDate);

                if (joinDate >= monthStart && joinDate < nextMonth) {
                    // Joined exactly in this month -> Prorate
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const remainingDays = daysInMonth - joinDate.getDate() + 1;

                    if (remainingDays < daysInMonth) {
                        targetAmount = (targetAmount / daysInMonth) * remainingDays;
                        targetAmount = parseFloat(targetAmount.toFixed(2));
                    }
                } else if (joinDate >= nextMonth) {
                    // This customer shouldn't even be in the report (filtered by WHERE EXISTS already, but double check)
                    targetAmount = 0;
                }
                // If joinDate < monthStart, targetAmount remains baseAmount (100%)
            }

            return {
                ...item,
                tariff_amount: targetAmount,
                paid_amount: item.paid_amount || 0,
                is_paid: (item.paid_amount || 0) >= (targetAmount - 0.05), // Small margin for rounding
                debt: Math.max(0, targetAmount - (item.paid_amount || 0))
            };
        });
    }

    getDebtors() {
        const db = dbManager.getInstance();
        const now = new Date();

        // 1. Get all active customers with their tariff and Join Date
        // We only care about customers who HAVE a joined_date (active membership history)
        const customers = db.prepare(`
            SELECT 
                c.id, 
                c.first_name, 
                c.last_name, 
                t.name as tariff_name, 
                t.amount as tariff_amount,
                (SELECT start_date FROM memberships m 
                 WHERE m.customer_id = c.id 
                 ORDER BY m.start_date DESC LIMIT 1) as joined_date
            FROM customers c
            LEFT JOIN tariffs t ON c.tariff_id = t.id
            WHERE c.active = 1 AND joined_date IS NOT NULL
        `).all();

        const debtors = [];
        const monthLetters = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

        customers.forEach(customer => {
            const joinDate = new Date(customer.joined_date);
            const unpaidMonths = [];
            let totalDebt = 0;

            // Iterator date: Start from the 1st of the join month
            let iterDate = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);

            // Limit: Up to current month (inclusive)
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            // Safety: Don't go back more than 2 years to avoid performance kills
            const minDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
            if (iterDate < minDate) iterDate = minDate;

            while (iterDate <= currentMonthStart) {
                const y = iterDate.getFullYear();
                const m = iterDate.getMonth();

                // Define the window for this month's payment
                // (e.g. 2024-01-01 to 2024-02-01)
                const monthStartStr = iterDate.toISOString().slice(0, 10);
                const nextMonthDate = new Date(y, m + 1, 1);
                const monthEndStr = nextMonthDate.toISOString().slice(0, 10);

                // Check if paid in this window
                // We assume one payment covers one month for simplicity in this logic
                const payment = db.prepare(`
                    SELECT SUM(amount) as paidTotal FROM payments 
                    WHERE customer_id = ? 
                    AND payment_date >= ? AND payment_date < ?
                `).get(customer.id, monthStartStr, monthEndStr);

                const paid = payment.paidTotal || 0;

                // If paid less than 95% of tariff, it's unpaid
                // (Using 95% to allow small caching/rounding diffs)
                const tariff = customer.tariff_amount || 0;

                // Special Proration Logic for Join Month only:
                // If joined on day 20, they should only pay ~33%
                let requiredAmount = tariff;

                if (y === joinDate.getFullYear() && m === joinDate.getMonth()) {
                    const dayOfJoin = joinDate.getDate();
                    // If joined after day 1, checks proration
                    if (dayOfJoin > 1) {
                        const daysInMonth = new Date(y, m + 1, 0).getDate();
                        const daysToPay = daysInMonth - dayOfJoin + 1;
                        requiredAmount = (tariff / daysInMonth) * daysToPay;
                    }
                }

                if (paid < (requiredAmount - 1.0) && requiredAmount > 0) {
                    unpaidMonths.push({
                        year: y,
                        month: m,
                        letter: monthLetters[m],
                        amount: requiredAmount - paid
                    });
                    totalDebt += (requiredAmount - paid);
                }

                // Next month
                iterDate.setMonth(iterDate.getMonth() + 1);
            }

            // Filter Criteria: Must owe more than 2 months equivalent OR have more than 2 distinct unpaid months?
            // User requirement: "estado mas de 2 meses sin pagar"
            // Let's stick to "More than 2 unpaid periods"
            if (unpaidMonths.length > 2) {
                debtors.push({
                    ...customer,
                    unpaid_months: unpaidMonths, // List of objects {year, month, letter}
                    total_debt: parseFloat(totalDebt.toFixed(2)),
                    last_payment_date: null // Not strictly needed for new UI but safe to keep schema
                });
            }
        });

        return debtors;
    }
}

module.exports = new PaymentService();
