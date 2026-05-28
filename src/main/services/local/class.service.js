/**
 * Class Service — CRUD for gym classes and their weekly schedules.
 *
 * Tables:  gym_classes, gym_class_schedules
 * Pattern: Follows the same BaseService + Zod validation pattern as other services.
 */

const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

// ─── Validation Schemas ────────────────────────────────────────────────────────

const classSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio'),
    description: z.string().optional().nullable(),
    instructor: z.string().optional().nullable(),
    color_theme: z.string().optional().default('blue'),
    max_capacity: z.number().int().min(1, 'Capacidad minima: 1').max(200, 'Capacidad maxima: 200'),
    duration_minutes: z.number().int().min(15, 'Duracion minima: 15 min').max(480, 'Duracion maxima: 480 min'),
});

const scheduleSchema = z.object({
    class_id: z.number().int().positive('class_id invalido'),
    day_of_week: z.number().int().min(0, 'Dia invalido (0-6)').max(6, 'Dia invalido (0-6)'),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora invalido (HH:MM)'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora invalido (HH:MM)'),
});

// ─── Service ───────────────────────────────────────────────────────────────────

class ClassService extends BaseService {

    // ── Classes CRUD ───────────────────────────────────────────────────────────

    /**
     * Get all classes with their schedule count, optionally filtered.
     */
    getAll(filter = 'all') {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        let whereClause = 'WHERE c.gym_id = ?';
        if (filter === 'active') whereClause += ' AND c.active = 1';
        if (filter === 'inactive') whereClause += ' AND c.active = 0';

        const classes = db.prepare(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM gym_class_schedules s WHERE s.class_id = c.id) AS schedule_count
            FROM gym_classes c
            ${whereClause}
            ORDER BY c.active DESC, c.name ASC
        `).all(gymId);

        return classes;
    }

    /**
     * Get a single class by ID with its schedules.
     */
    getById(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const cls = db.prepare(
            'SELECT * FROM gym_classes WHERE id = ? AND gym_id = ?'
        ).get(id, gymId);

        if (!cls) throw new Error('Clase no encontrada');

        const schedules = db.prepare(
            'SELECT * FROM gym_class_schedules WHERE class_id = ? AND gym_id = ? ORDER BY day_of_week, start_time'
        ).all(id, gymId);

        return { ...cls, schedules };
    }

    /**
     * Create a new class.
     */
    create(data) {
        const validation = classSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const d = validation.data;

        const result = db.prepare(`
            INSERT INTO gym_classes (gym_id, name, description, instructor, color_theme, max_capacity, duration_minutes, synced, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(gymId, d.name, d.description || null, d.instructor || null, d.color_theme, d.max_capacity, d.duration_minutes);

        return { id: result.lastInsertRowid, gym_id: gymId, ...d };
    }

    /**
     * Update an existing class.
     */
    update(id, data) {
        const validation = classSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const d = validation.data;

        const result = db.prepare(`
            UPDATE gym_classes
            SET name = ?, description = ?, instructor = ?, color_theme = ?, max_capacity = ?, duration_minutes = ?,
                synced = 0, updated_at = datetime('now')
            WHERE id = ? AND gym_id = ?
        `).run(d.name, d.description || null, d.instructor || null, d.color_theme, d.max_capacity, d.duration_minutes, id, gymId);

        if (result.changes === 0) throw new Error('Clase no encontrada');
        return true;
    }

    /**
     * Toggle class active/inactive.
     */
    toggleActive(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const result = db.prepare(`
            UPDATE gym_classes
            SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END,
                synced = 0, updated_at = datetime('now')
            WHERE id = ? AND gym_id = ?
        `).run(id, gymId);

        if (result.changes === 0) throw new Error('Clase no encontrada');
        return true;
    }

    /**
     * Delete a class and its schedules.
     */
    delete(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const cls = db.prepare('SELECT * FROM gym_classes WHERE id = ? AND gym_id = ?').get(id, gymId);
        if (!cls) throw new Error('Clase no encontrada');

        db.transaction(() => {
            // Log schedule deletions for sync
            const schedules = db.prepare('SELECT id FROM gym_class_schedules WHERE class_id = ? AND gym_id = ?').all(id, gymId);
            const logStmt = db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            for (const s of schedules) {
                logStmt.run(gymId, 'gym_class_schedules', s.id);
            }

            // Log class deletion
            logStmt.run(gymId, 'gym_classes', id);

            // CASCADE will delete schedules
            db.prepare('DELETE FROM gym_classes WHERE id = ? AND gym_id = ?').run(id, gymId);
        })();

        return true;
    }

    // ── Schedules CRUD ─────────────────────────────────────────────────────────

    /**
     * Get schedules for a specific class.
     */
    getSchedules(classId) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        return db.prepare(
            'SELECT * FROM gym_class_schedules WHERE class_id = ? AND gym_id = ? ORDER BY day_of_week, start_time'
        ).all(classId, gymId);
    }

    /**
     * Add a schedule slot to a class.
     */
    addSchedule(data) {
        const validation = scheduleSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const d = validation.data;

        // Verify class exists
        const cls = db.prepare('SELECT id FROM gym_classes WHERE id = ? AND gym_id = ?').get(d.class_id, gymId);
        if (!cls) throw new Error('Clase no encontrada');

        // Check for time overlap on same day for the same class
        const overlap = db.prepare(`
            SELECT id FROM gym_class_schedules
            WHERE gym_id = ? AND class_id = ? AND day_of_week = ?
              AND start_time < ? AND end_time > ?
        `).get(gymId, d.class_id, d.day_of_week, d.end_time, d.start_time);

        if (overlap) throw new Error('Ya existe un horario que se solapa en ese dia');

        const result = db.prepare(`
            INSERT INTO gym_class_schedules (gym_id, class_id, day_of_week, start_time, end_time, synced, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(gymId, d.class_id, d.day_of_week, d.start_time, d.end_time);

        return { id: result.lastInsertRowid, gym_id: gymId, ...d };
    }

    /**
     * Update a schedule slot.
     */
    updateSchedule(id, data) {
        const partial = scheduleSchema.partial().safeParse(data);
        if (!partial.success) {
            throw new Error(partial.error.errors[0].message);
        }

        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const existing = db.prepare('SELECT * FROM gym_class_schedules WHERE id = ? AND gym_id = ?').get(id, gymId);
        if (!existing) throw new Error('Horario no encontrado');

        const merged = { ...existing, ...partial.data };

        // Check overlap excluding self
        const overlap = db.prepare(`
            SELECT id FROM gym_class_schedules
            WHERE gym_id = ? AND class_id = ? AND day_of_week = ? AND id != ?
              AND start_time < ? AND end_time > ?
        `).get(gymId, merged.class_id, merged.day_of_week, id, merged.end_time, merged.start_time);

        if (overlap) throw new Error('Ya existe un horario que se solapa en ese dia');

        db.prepare(`
            UPDATE gym_class_schedules
            SET day_of_week = ?, start_time = ?, end_time = ?,
                synced = 0, updated_at = datetime('now')
            WHERE id = ? AND gym_id = ?
        `).run(merged.day_of_week, merged.start_time, merged.end_time, id, gymId);

        return true;
    }

    /**
     * Delete a schedule slot.
     */
    deleteSchedule(id) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const existing = db.prepare('SELECT id FROM gym_class_schedules WHERE id = ? AND gym_id = ?').get(id, gymId);
        if (!existing) throw new Error('Horario no encontrado');

        db.transaction(() => {
            db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)').run(gymId, 'gym_class_schedules', id);
            db.prepare('DELETE FROM gym_class_schedules WHERE id = ? AND gym_id = ?').run(id, gymId);
        })();

        return true;
    }

    // ── Aggregate Queries ──────────────────────────────────────────────────────

    /**
     * Get full weekly schedule view (all classes + schedules joined).
     * Returns array sorted by day_of_week then start_time.
     */
    getWeeklySchedule() {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        return db.prepare(`
            SELECT
                s.id AS schedule_id,
                s.day_of_week,
                s.start_time,
                s.end_time,
                c.id AS class_id,
                c.name AS class_name,
                c.instructor,
                c.color_theme,
                c.max_capacity,
                c.duration_minutes,
                c.active
            FROM gym_class_schedules s
            JOIN gym_classes c ON c.id = s.class_id AND c.gym_id = s.gym_id
            WHERE s.gym_id = ? AND c.active = 1
            ORDER BY s.day_of_week, s.start_time
        `).all(gymId);
    }

    /**
     * Get bookings from Supabase for a given date.
     * Called from desktop to see who's signed up.
     * Uses direct query with service_role key (bypasses RLS).
     */
    async getBookingsForDate(date) {
        const cloudService = require('../cloud/cloud.service');
        const supabase = cloudService.supabase;

        if (!supabase) throw new Error('Supabase no configurado');

        const gymId = this.getGymId();

        const { data, error } = await supabase
            .from('gym_class_bookings')
            .select('*')
            .eq('gym_id', gymId)
            .eq('booking_date', date)
            .eq('status', 'confirmed');

        if (error) throw new Error(`Error cargando reservas: ${error.message}`);

        const bookings = data || [];

        // Enrich with customer names from local DB
        const db = dbManager.getInstance();
        const enriched = bookings.map(booking => {
            const customer = db.prepare(
                'SELECT first_name, last_name, email, phone FROM customers WHERE id = ? AND gym_id = ?'
            ).get(booking.customer_local_id, gymId);

            return {
                ...booking,
                customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Desconocido',
                customer_email: customer?.email,
                customer_phone: customer?.phone,
            };
        });

        return enriched;
    }

    // ── Sporadic Events (cloud-native, stored in Supabase) ──────────────────

    /**
     * Create a sporadic (one-off) class event.
     * Inserts directly to Supabase via service role.
     */
    async createEvent(data) {
        const cloudService = require('../cloud/cloud.service');
        const supabase = cloudService.supabase;
        if (!supabase) throw new Error('Supabase no configurado');

        const gymId = this.getGymId();
        const { error, data: result } = await supabase
            .from('gym_class_events')
            .insert({
                gym_id: gymId,
                class_id: data.class_id,
                event_date: data.event_date,
                start_time: data.start_time,
                end_time: data.end_time,
                max_capacity_override: data.max_capacity_override || null,
                instructor_override: data.instructor_override || null,
                notes: data.notes || null,
            })
            .select()
            .single();

        if (error) throw new Error(`Error creando evento: ${error.message}`);
        return result;
    }

    /**
     * Fetch sporadic events for a date range.
     */
    async getEvents(startDate, endDate) {
        const cloudService = require('../cloud/cloud.service');
        const supabase = cloudService.supabase;
        if (!supabase) throw new Error('Supabase no configurado');

        const gymId = this.getGymId();
        const { data, error } = await supabase
            .from('gym_class_events')
            .select('*')
            .eq('gym_id', gymId)
            .gte('event_date', startDate)
            .lte('event_date', endDate)
            .order('event_date', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) throw new Error(`Error cargando eventos: ${error.message}`);
        return data || [];
    }

    /**
     * Cancel a sporadic event (soft delete — set cancelled=true).
     */
    async cancelEvent(eventId) {
        const cloudService = require('../cloud/cloud.service');
        const supabase = cloudService.supabase;
        if (!supabase) throw new Error('Supabase no configurado');

        const gymId = this.getGymId();
        const { error } = await supabase
            .from('gym_class_events')
            .update({ cancelled: true })
            .eq('id', eventId)
            .eq('gym_id', gymId);

        if (error) throw new Error(`Error cancelando evento: ${error.message}`);
        return true;
    }

    /**
     * Delete a sporadic event (hard delete).
     */
    async deleteEvent(eventId) {
        const cloudService = require('../cloud/cloud.service');
        const supabase = cloudService.supabase;
        if (!supabase) throw new Error('Supabase no configurado');

        const gymId = this.getGymId();
        const { error } = await supabase
            .from('gym_class_events')
            .delete()
            .eq('id', eventId)
            .eq('gym_id', gymId);

        if (error) throw new Error(`Error eliminando evento: ${error.message}`);
        return true;
    }

    /**
     * Get bookings from Supabase for a date range (week view).
     * Returns bookings enriched with customer names from local DB.
     * Uses direct query with service_role key (bypasses RLS).
     */
    async getBookingsForWeek(startDate, endDate) {
        const cloudService = require('../cloud/cloud.service');
        const supabase = cloudService.supabase;

        if (!supabase) {
            console.error('[CLASS] Supabase client is null!');
            return [];
        }

        const gymId = this.getGymId();

        const { data, error } = await supabase
            .from('gym_class_bookings')
            .select('*')
            .eq('gym_id', gymId)
            .eq('status', 'confirmed')
            .gte('booking_date', startDate)
            .lte('booking_date', endDate);

        if (error) throw new Error(`Error cargando reservas: ${error.message}`);

        const bookings = data || [];

        // Enrich with customer names from local DB
        const db = dbManager.getInstance();
        const enriched = bookings.map(booking => {
            const customer = db.prepare(
                'SELECT first_name, last_name, email, phone FROM customers WHERE id = ? AND gym_id = ?'
            ).get(booking.customer_local_id, gymId);

            return {
                ...booking,
                customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Desconocido',
                customer_email: customer?.email,
                customer_phone: customer?.phone,
            };
        });

        return enriched;
    }
}

module.exports = new ClassService();
