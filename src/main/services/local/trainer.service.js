/**
 * Trainer Service — CRUD for trainers and their weekly schedules.
 *
 * Trainers are entities (not just strings inside shifts). Each trainer
 * has their own weekly schedule. To find "who is on duty at this hour",
 * we query trainer_schedules by (day_of_week, start_time, end_time).
 *
 * Tables: trainers, trainer_schedules
 */

const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

const trainerSchema = z.object({
    name: z.string().min(1, 'El nombre del entrenador es obligatorio'),
    color_theme: z.string().optional().default('blue'),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal('')),
});

const scheduleSchema = z.object({
    trainer_id: z.number().int().positive(),
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
});

class TrainerService extends BaseService {
    /**
     * List all trainers in this gym with their schedule slot count.
     */
    getAll(filter = 'all') {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        let where = 'WHERE t.gym_id = ?';
        if (filter === 'active') where += ' AND t.active = 1';
        if (filter === 'inactive') where += ' AND t.active = 0';

        return db.prepare(`
            SELECT t.*,
                   (SELECT COUNT(*) FROM trainer_schedules s WHERE s.trainer_id = t.id) AS schedule_count
            FROM trainers t
            ${where}
            ORDER BY t.active DESC, t.name ASC
        `).all(gymId);
    }

    getById(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const trainer = db.prepare(
            'SELECT * FROM trainers WHERE id = ? AND gym_id = ?'
        ).get(id, gymId);
        if (!trainer) throw new Error('Entrenador no encontrado');
        const schedules = db.prepare(
            'SELECT * FROM trainer_schedules WHERE trainer_id = ? AND gym_id = ? ORDER BY day_of_week, start_time'
        ).all(id, gymId);
        return { ...trainer, schedules };
    }

    create(data) {
        const validation = trainerSchema.safeParse(data);
        if (!validation.success) throw new Error(validation.error.errors[0].message);
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const d = validation.data;
        const result = db.prepare(`
            INSERT INTO trainers (gym_id, name, color_theme, phone, email, active, synced, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 0, datetime('now'))
        `).run(gymId, d.name, d.color_theme || 'blue', d.phone || null, d.email || null);
        return { id: result.lastInsertRowid, gym_id: gymId, ...d };
    }

    update(id, data) {
        const validation = trainerSchema.partial().safeParse(data);
        if (!validation.success) throw new Error(validation.error.errors[0].message);
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const d = validation.data;
        const fields = [];
        const params = [];
        if (d.name !== undefined) { fields.push('name = ?'); params.push(d.name); }
        if (d.color_theme !== undefined) { fields.push('color_theme = ?'); params.push(d.color_theme); }
        if (d.phone !== undefined) { fields.push('phone = ?'); params.push(d.phone || null); }
        if (d.email !== undefined) { fields.push('email = ?'); params.push(d.email || null); }
        if (fields.length === 0) return this.getById(id);
        fields.push('synced = 0');
        fields.push("updated_at = datetime('now')");
        params.push(id, gymId);
        db.prepare(`UPDATE trainers SET ${fields.join(', ')} WHERE id = ? AND gym_id = ?`).run(...params);
        return this.getById(id);
    }

    toggleActive(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const result = db.prepare(`
            UPDATE trainers
            SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END,
                synced = 0, updated_at = datetime('now')
            WHERE id = ? AND gym_id = ?
        `).run(id, gymId);
        if (result.changes === 0) throw new Error('Entrenador no encontrado');
        return true;
    }

    delete(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const txn = db.transaction(() => {
            // Log schedule deletes for cloud sync (FK cascade fires after)
            const schedules = db.prepare('SELECT id FROM trainer_schedules WHERE trainer_id = ? AND gym_id = ?').all(id, gymId);
            const logDel = db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            for (const s of schedules) {
                try { logDel.run(gymId, 'trainer_schedules', s.id); } catch (_) {}
            }
            logDel.run(gymId, 'trainers', id);
            const r = db.prepare('DELETE FROM trainers WHERE id = ? AND gym_id = ?').run(id, gymId);
            if (r.changes === 0) throw new Error('Entrenador no encontrado');
        });
        txn();
        return true;
    }

    /**
     * Replace the trainer's entire weekly schedule.
     * @param {number} trainerId
     * @param {Array<{day_of_week, start_time, end_time}>} schedule
     */
    setSchedule(trainerId, schedule) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const trainer = db.prepare('SELECT id FROM trainers WHERE id = ? AND gym_id = ?').get(trainerId, gymId);
        if (!trainer) throw new Error('Entrenador no encontrado');

        const validRows = (Array.isArray(schedule) ? schedule : []).map((s) => ({
            day_of_week: parseInt(s.day_of_week),
            start_time: s.start_time,
            end_time: s.end_time,
        })).filter((s) =>
            Number.isInteger(s.day_of_week) && s.day_of_week >= 0 && s.day_of_week <= 6 &&
            /^\d{2}:\d{2}$/.test(s.start_time) && /^\d{2}:\d{2}$/.test(s.end_time) &&
            s.start_time < s.end_time
        );

        const txn = db.transaction(() => {
            // Log existing schedules for sync, then wipe
            const old = db.prepare('SELECT id FROM trainer_schedules WHERE trainer_id = ? AND gym_id = ?').all(trainerId, gymId);
            const logDel = db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            for (const o of old) { try { logDel.run(gymId, 'trainer_schedules', o.id); } catch (_) {} }
            db.prepare('DELETE FROM trainer_schedules WHERE trainer_id = ? AND gym_id = ?').run(trainerId, gymId);

            const insert = db.prepare(`
                INSERT INTO trainer_schedules (gym_id, trainer_id, day_of_week, start_time, end_time, synced, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
            `);
            for (const s of validRows) {
                insert.run(gymId, trainerId, s.day_of_week, s.start_time, s.end_time);
            }
        });
        txn();
        return this.getById(trainerId);
    }

    /**
     * Get all trainers on duty during a given (day_of_week, start_time, end_time).
     * Used by the mobile app and the desktop schedule view.
     */
    getOnDuty(dayOfWeek, startTime, endTime) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        return db.prepare(`
            SELECT DISTINCT t.id, t.name, t.color_theme
            FROM trainers t
            JOIN trainer_schedules s ON s.trainer_id = t.id AND s.gym_id = t.gym_id
            WHERE t.gym_id = ?
              AND t.active = 1
              AND s.day_of_week = ?
              AND s.start_time <= ?
              AND s.end_time >= ?
            ORDER BY t.name ASC
        `).all(gymId, dayOfWeek, startTime, endTime);
    }
}

module.exports = new TrainerService();
