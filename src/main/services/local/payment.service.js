const dbManager = require('../../db/database');
const z = require('zod');

// Validation Schemas
const createPaymentSchema = z.object({
    customer_id: z.number().int().positive(),
    amount: z.number().positive(),
    tariff_name: z.string().optional(),
    payment_date: z.string().optional(), // ISO string from frontend
});

const monthlyReportSchema = z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12)
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
        const validation = monthlyReportSchema.safeParse({ year, month });
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

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
                (SELECT id FROM payments p 
                 WHERE p.customer_id = c.id 
                 AND p.payment_date >= ? AND p.payment_date < ?
                 ORDER BY payment_date DESC LIMIT 1) as payment_id,
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

        const data = stmt.all(startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate);

        return data.map(item => {
            let targetAmount = item.tariff_amount || 0;

            // Proration Logic: If joined mid-month, calculate percentage of month
            if (item.joined_date) {
                // Robust parsing of "YYYY-MM-DD" ignoring timezones
                const joinParts = item.joined_date.split(/[-T ]/);
                const joinYear = parseInt(joinParts[0], 10);
                const joinMonth = parseInt(joinParts[1], 10);
                const joinDay = parseInt(joinParts[2], 10);

                if (joinYear === year && joinMonth === month) {
                    // Joined exactly in this month -> Prorate
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const remainingDays = daysInMonth - joinDay + 1;

                    if (remainingDays < daysInMonth && remainingDays > 0) {
                        targetAmount = (targetAmount / daysInMonth) * remainingDays;
                        targetAmount = Math.round(targetAmount * 100) / 100;
                    }
                }
            }

            return {
                ...item,
                tariff_amount: targetAmount,
                paid_amount: item.paid_amount || 0,
                is_paid: (item.paid_amount || 0) >= (targetAmount - 0.5), // Increased tolerance to 0.50€ for small discrepancies
                debt: Math.max(0, Math.round((targetAmount - (item.paid_amount || 0)) * 100) / 100)
            };
        });
    }

    async getDebtors() {
        const db = dbManager.getInstance();
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // 1. Get all active customers with their tariff and Join Date
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

        // 2. Fetch ALL payments from the last 2 years in one go for these customers
        const twoYearsAgo = new Date(currentYear - 2, currentMonth, 1).toISOString();
        const allPayments = db.prepare(`
            SELECT customer_id, amount, payment_date,
                   strftime('%Y', payment_date) as year,
                   strftime('%m', payment_date) as month
            FROM payments
            WHERE payment_date >= ?
        `).all(twoYearsAgo);

        // Group payments by customer and month
        const paymentMap = new Map();
        allPayments.forEach(p => {
            const key = `${p.customer_id}-${p.year}-${parseInt(p.month, 10)}`;
            paymentMap.set(key, (paymentMap.get(key) || 0) + p.amount);
        });

        const debtors = [];
        const monthLetters = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

        customers.forEach(customer => {
            const joinDate = new Date(customer.joined_date);
            const unpaidMonths = [];
            let totalDebt = 0;

            // Iterator date: Start from the 1st of the join month
            let iterDate = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
            const stopDate = new Date(currentYear, currentMonth, 1);

            // Safety back-limit
            const startLimit = new Date(currentYear - 2, currentMonth, 1);
            if (iterDate < startLimit) iterDate = startLimit;

            while (iterDate <= stopDate) {
                const y = iterDate.getFullYear();
                const m = iterDate.getMonth();
                const monthDisplay = m + 1;

                const key = `${customer.id}-${y}-${monthDisplay}`;
                const paid = paymentMap.get(key) || 0;
                const tariff = customer.tariff_amount || 0;

                let requiredAmount = tariff;

                // Proration Join Month
                if (y === joinDate.getFullYear() && m === joinDate.getMonth()) {
                    const dayOfJoin = joinDate.getDate();
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
                        amount: Math.round((requiredAmount - paid) * 100) / 100
                    });
                    totalDebt += (requiredAmount - paid);
                }

                iterDate.setMonth(iterDate.getMonth() + 1);
            }

            if (unpaidMonths.length > 2) {
                debtors.push({
                    ...customer,
                    unpaid_months: unpaidMonths,
                    total_debt: parseFloat(totalDebt.toFixed(2)),
                    last_payment_date: null
                });
            }
        });

        return debtors;
    }
}

module.exports = new PaymentService();
