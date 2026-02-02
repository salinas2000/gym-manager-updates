const dbManager = require('../../db/database');

class AnalyticsService {
    // 1. Revenue History (Sum amount group by month)
    getRevenueHistory(year) {
        const db = dbManager.getInstance();
        const yearStr = String(year);

        // Initialize array for 12 months
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Query to get sum per month
        const stmt = db.prepare(`
            SELECT strftime('%m', payment_date) as month, SUM(amount) as total
            FROM payments
            WHERE strftime('%Y', payment_date) = ?
            GROUP BY month
        `);

        const rows = stmt.all(yearStr);

        // Map rows to array
        return months.map((monthName, index) => {
            const monthNum = String(index + 1).padStart(2, '0');
            const row = rows.find(r => r.month === monthNum);
            return {
                month: monthName,
                revenue: row ? row.total : 0
            };
        });
    }

    // 2. Active Members History (Complex Overlap Logic)
    getActiveMembersHistory(year) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        return months.map((monthName, index) => {
            const count = this.getActiveCountForMonth(year, index);
            return {
                month: monthName,
                members: count
            };
        });
    }

    // 3. Tariff Distribution (Active Users)
    getTariffDistribution() {
        const db = dbManager.getInstance();
        const stmt = db.prepare(`
            SELECT 
                COALESCE(t.name, 'Sin Tarifa') as name, 
                COALESCE(t.color_theme, 'slate') as color_theme, 
                COUNT(c.id) as value
            FROM customers c
            LEFT JOIN tariffs t ON c.tariff_id = t.id
            WHERE c.active = 1
            GROUP BY COALESCE(t.id, -1)
        `);
        return stmt.all();
    }

    // 3.5 Strictly Active Count (Single Source of Truth)
    getActiveCount() {
        const db = dbManager.getInstance();
        return db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1').get().count;
    }

    // 4. Available Years (for Filter)
    getAvailableYears() {
        const db = dbManager.getInstance();
        const stmt = db.prepare(`
            SELECT DISTINCT strftime('%Y', payment_date) as year
            FROM payments
            ORDER BY year DESC
        `);
        const result = stmt.all();
        // Always include current year if no data
        const currentYear = String(new Date().getFullYear());
        const years = result.map(r => r.year);
        if (!years.includes(currentYear)) {
            years.unshift(currentYear);
        }
        return years;
    }

    // 5. Recent Transactions
    getRecentTransactions(limit = 5) {
        const db = dbManager.getInstance();
        const stmt = db.prepare(`
            SELECT p.*, c.first_name, c.last_name, c.email
            FROM payments p
            JOIN customers c ON p.customer_id = c.id
            ORDER BY p.payment_date DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // Helper: "Query Mágica": Count active users in a specific month/year

    // 6. New Members History (Sign-ups)
    getNewMembersHistory(year) {
        const db = dbManager.getInstance();
        const yearStr = String(year);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const stmt = db.prepare(`
            SELECT strftime('%m', created_at) as month, COUNT(*) as count
            FROM customers
            WHERE strftime('%Y', created_at) = ?
            GROUP BY month
        `);

        const rows = stmt.all(yearStr);

        return months.map((monthName, index) => {
            const monthNum = String(index + 1).padStart(2, '0');
            const row = rows.find(r => r.month === monthNum);
            return {
                month: monthName,
                members: row ? row.count : 0
            };
        });
    }

    // Helper: "Query Mágica": Count active users in a specific month/year
    getActiveCountForMonth(year, month) {
        const db = dbManager.getInstance();

        // Construct dates. YYYY-MM-DD
        const paddedMonth = String(month + 1).padStart(2, '0');
        const startDateStr = `${year}-${paddedMonth}-01`;

        // End date: Last day of month
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endDateStr = `${year}-${paddedMonth}-${lastDay}`;

        /* 
           Logic:
           start_date <= end_of_month
           AND 
           (end_date IS NULL OR end_date >= start_of_month)
        */

        const stmt = db.prepare(`
            SELECT count(DISTINCT customer_id) as count 
            FROM memberships
            WHERE start_date <= ?
            AND (end_date IS NULL OR end_date >= ?)
         `);

        const result = stmt.get(endDateStr, startDateStr);
        return result.count;

    }
}

module.exports = new AnalyticsService();
