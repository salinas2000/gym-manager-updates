const dbManager = require('../../db/database');

class MembershipService {
    update(id, { start_date, end_date }) {
        const db = dbManager.getInstance();
        const stmt = db.prepare(`
            UPDATE memberships 
            SET start_date = ?, end_date = ?
            WHERE id = ?
        `);
        // Handle empty string as null for end_date
        const finalEndDate = end_date === '' ? null : end_date;

        stmt.run(start_date, finalEndDate, id);

        // After update, we must check which customer this belonged to and recalculate their status
        const membership = db.prepare('SELECT customer_id FROM memberships WHERE id = ?').get(id);
        if (membership) {
            this.recalculateCustomerStatus(membership.customer_id);
        }
        return { id, start_date, end_date: finalEndDate };
    }

    delete(id) {
        const db = dbManager.getInstance();

        // Transaction to ensure atomicity
        const transaction = db.transaction(() => {
            const membership = db.prepare('SELECT * FROM memberships WHERE id = ?').get(id);
            if (!membership) return false;

            // Cascade: Delete payments within this period
            // If end_date is NULL (active), delete everything from start_date onwards
            if (membership.end_date) {
                db.prepare(`
                    DELETE FROM payments 
                    WHERE customer_id = ? 
                    AND payment_date >= ? 
                    AND payment_date <= ?
                `).run(membership.customer_id, membership.start_date, membership.end_date);
            } else {
                db.prepare(`
                    DELETE FROM payments 
                    WHERE customer_id = ? 
                    AND payment_date >= ?
                `).run(membership.customer_id, membership.start_date);
            }

            // Delete period
            db.prepare('DELETE FROM memberships WHERE id = ?').run(id);

            // Recalculate Logic
            this.recalculateCustomerStatus(membership.customer_id);

            return true;
        });

        return transaction();
    }

    // Critical: Ensure customer 'active' flag matches reality
    recalculateCustomerStatus(customerId) {
        const db = dbManager.getInstance();

        // Find if there is ANY open membership (end_date IS NULL)
        // OR a membership that covers "today" (start <= now <= end)
        const now = new Date().toISOString();

        const activeMembership = db.prepare(`
            SELECT id FROM memberships 
            WHERE customer_id = ? 
            AND (end_date IS NULL OR end_date >= ?)
            LIMIT 1
        `).get(customerId, now);

        const newStatus = activeMembership ? 1 : 0;

        db.prepare('UPDATE customers SET active = ? WHERE id = ?').run(newStatus, customerId);
        return newStatus;
    }
}

module.exports = new MembershipService();
