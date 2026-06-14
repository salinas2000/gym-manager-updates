/**
 * GDPR / RGPD service — data-subject rights for a single customer.
 *
 *  - exportCustomerData / exportCustomerDataFull → right of access & portability.
 *  - anonymizeCustomer → right to erasure, while KEEPING financial records
 *    (payments/memberships) which the gym must retain for tax/accounting.
 *
 * Cloud purges are best-effort (via owner-data); the local scrub is guaranteed.
 */

const dbManager = require('../../db/database');
const ownerData = require('../cloud/owner-data.client');
const BaseService = require('../BaseService');

class GdprService extends BaseService {
    /** Everything we hold locally about ONE customer. */
    exportCustomerData(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND gym_id = ?').get(id, gymId);
        if (!customer) throw new Error('Cliente no encontrado');
        if (customer.medical_info) {
            try { customer.medical_info = JSON.parse(customer.medical_info); } catch (e) { /* keep raw */ }
        }
        const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? AND gym_id = ?').all(id, gymId);
        const memberships = db.prepare('SELECT * FROM memberships WHERE customer_id = ? AND gym_id = ?').all(id, gymId);
        const mesocycles = db.prepare('SELECT * FROM mesocycles WHERE customer_id = ? AND gym_id = ?').all(id, gymId);
        return {
            _meta: { exported_at: new Date().toISOString(), gym_id: gymId, format: 'gdpr-export-v1' },
            customer, payments, memberships, mesocycles,
        };
    }

    /** Local data + the customer's cloud-only data (training, bookings…). */
    async exportCustomerDataFull(id) {
        const data = this.exportCustomerData(id);
        const gymId = this.getGymId();
        const cloud = {};
        const tables = [
            ['customer_workout_logs', 'workout_logs'],
            ['gym_class_bookings', 'bookings'],
            ['customer_rm_records', 'rm_records'],
            ['customer_profile_submissions', 'profile_submissions'],
        ];
        for (const [table, key] of tables) {
            try {
                const res = await ownerData.select(table, { gymId, filters: { customer_local_id: id } });
                cloud[key] = res?.rows || res?.data || (res?.success === false ? { error: res.error } : []);
            } catch (e) {
                cloud[key] = { error: 'no_disponible' };
            }
        }
        data.cloud = cloud;
        return data;
    }

    /**
     * Anonymize a customer: scrub PII + medical locally (keep the row so
     * financial records stay linked) and purge cloud-only personal data.
     */
    async anonymizeCustomer(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND gym_id = ?').get(id, gymId);
        if (!customer) throw new Error('Cliente no encontrado');

        db.prepare(`
            UPDATE customers
            SET first_name = 'Anonimizado', last_name = '', email = NULL, phone = NULL,
                dni = NULL, address = NULL, birth_date = NULL, height_cm = NULL,
                weight_kg = NULL, medical_info = NULL,
                anonymized = 1, synced = 0, updated_at = datetime('now')
            WHERE id = ? AND gym_id = ?
        `).run(id, gymId);

        // Purge cloud-only personal data (best-effort — local scrub already done).
        const cloudPurged = {};
        const tables = [
            'customer_workout_logs',
            'gym_class_bookings',
            'customer_rm_records',
            'customer_profile_submissions',
            'mobile_client_links',
        ];
        for (const table of tables) {
            try {
                const res = await ownerData.deleteMatch(table, { customer_local_id: id }, { gymId });
                cloudPurged[table] = res?.success !== false;
            } catch (e) {
                cloudPurged[table] = false;
            }
        }

        return { success: true, cloudPurged };
    }

    /** Record that a customer gave GDPR consent (e.g. for processing health data). */
    setConsent(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        db.prepare("UPDATE customers SET gdpr_consent_at = datetime('now'), synced = 0 WHERE id = ? AND gym_id = ?")
            .run(id, gymId);
        return { success: true };
    }
}

module.exports = new GdprService();
