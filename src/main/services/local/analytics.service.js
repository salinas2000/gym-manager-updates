const dbManager = require('../../db/database');

class AnalyticsService {
    getGymId() {
        try {
            const licenseService = require('./license.service');
            const data = licenseService.getLicenseData();
            return data ? data.gym_id : 'LOCAL_DEV';
        } catch (e) {
            return 'LOCAL_DEV';
        }
    }

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

    // 3.1 Total Revenue (All time or per year)
    getTotalRevenue(year = null) {
        const db = dbManager.getInstance();
        if (year) {
            return db.prepare("SELECT SUM(amount) as total FROM payments WHERE strftime('%Y', payment_date) = ?").get(String(year)).total || 0;
        }
        return db.prepare("SELECT SUM(amount) as total FROM payments").get().total || 0;
    }

    // 3.2 Debtor Count (Active members without payment in current month)
    getDebtorCount() {
        const db = dbManager.getInstance();
        const now = new Date();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const yearStr = String(now.getFullYear());
        const startDate = `${yearStr}-${monthStr}-01`;

        return db.prepare(`
            SELECT COUNT(*) as count
            FROM customers c
            WHERE c.active = 1
            AND NOT EXISTS (
                SELECT 1 FROM payments p
                WHERE p.customer_id = c.id
                AND p.payment_date >= ?
            )
        `).get(startDate).count || 0;
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

        // Construct dates. YYYY-MM-DD (month is 0-indexed from caller)
        const paddedMonth = String(month + 1).padStart(2, '0');
        const startDateStr = `${year}-${paddedMonth}-01`;

        // End date: Last day of month (pad day to 2 digits)
        const lastDay = String(new Date(year, month + 1, 0).getDate()).padStart(2, '0');
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

    // --- LOGICA DE INVENTARIO (NUEVA) ---

    getInventoryDashboardData(year, category = 'all') {
        const db = dbManager.getInstance();
        const yearStr = String(year);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        // 0. Get available categories
        const categories = db.prepare(`SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''`).all().map(r => r.category);

        // 1. Revenue & Profit History
        let historyQuery = `
            SELECT 
                strftime('%m', o.created_at) as month,
                SUM(o.total_cost) as revenue,
                SUM(o.total_cost - (o.quantity * p.purchase_price)) as profit
            FROM inventory_orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.type = 'sale' AND strftime('%Y', o.created_at) = ?
        `;
        const historyParams = [yearStr];

        if (category !== 'all') {
            historyQuery += ` AND p.category = ?`;
            historyParams.push(category);
        }
        historyQuery += ` GROUP BY month`;

        const revenueRows = db.prepare(historyQuery).all(...historyParams);

        const history = months.map((monthName, index) => {
            const monthNum = String(index + 1).padStart(2, '0');
            const row = revenueRows.find(r => r.month === monthNum);
            return {
                month: monthName,
                revenue: row ? row.revenue : 0,
                profit: row ? row.profit : 0
            };
        });

        // 2. Top Selling Products
        let productsQuery = `
            SELECT 
                p.name,
                SUM(o.quantity) as sold,
                SUM(o.total_cost) as total_revenue
            FROM inventory_orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.type = 'sale'
        `;
        const productsParams = [];
        if (category !== 'all') {
            productsQuery += ` AND p.category = ?`;
            productsParams.push(category);
        }
        productsQuery += ` GROUP BY o.product_id ORDER BY sold DESC LIMIT 5`;
        const topProducts = db.prepare(productsQuery).all(...productsParams);

        // 2.1 Product Averages (New)
        let averagesQuery = `
            SELECT 
                p.name,
                SUM(o.total_cost) / 12.0 as avg_monthly_revenue,
                SUM(o.quantity) as total_units
            FROM inventory_orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.type = 'sale' AND strftime('%Y', o.created_at) = ?
        `;
        const averagesParams = [yearStr];
        if (category !== 'all') {
            averagesQuery += ` AND p.category = ?`;
            averagesParams.push(category);
        }
        averagesQuery += ` GROUP BY o.product_id ORDER BY avg_monthly_revenue DESC`;
        const productAverages = db.prepare(averagesQuery).all(...averagesParams);

        // 3. Top Customers (Inventory)
        let customersQuery = `
            SELECT 
                c.first_name || ' ' || c.last_name as name,
                SUM(o.total_cost) as total_spent,
                COUNT(o.id) as orders_count
            FROM inventory_orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN products p ON o.product_id = p.id
            WHERE o.type = 'sale'
        `;
        const customersParams = [];
        if (category !== 'all') {
            customersQuery += ` AND p.category = ?`;
            customersParams.push(category);
        }
        customersQuery += ` GROUP BY o.customer_id ORDER BY total_spent DESC LIMIT 5`;
        const topCustomers = db.prepare(customersQuery).all(...customersParams);

        // 4. Stock Alerts
        const stockAlerts = db.prepare(`
            SELECT COUNT(*) as count FROM products WHERE stock <= min_stock
        `).get().count;

        // 5. Total Inventory Value (Stock * Purchase Price)
        const totalValue = db.prepare(`
            SELECT SUM(stock * purchase_price) as value FROM products
        `).get().value || 0;

        return {
            history,
            topProducts,
            topCustomers,
            stockAlerts,
            totalValue,
            categories,
            productAverages
        };
    }
}

module.exports = new AnalyticsService();
