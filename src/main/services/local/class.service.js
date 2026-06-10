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
    trainer_id: z.number().int().positive().optional().nullable(),
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
                   t.name AS trainer_name,
                   (SELECT COUNT(*) FROM gym_class_schedules s WHERE s.class_id = c.id) AS schedule_count
            FROM gym_classes c
            LEFT JOIN trainers t ON t.id = c.trainer_id AND t.gym_id = c.gym_id
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

        const cls = db.prepare(`
            SELECT c.*, t.name AS trainer_name
            FROM gym_classes c
            LEFT JOIN trainers t ON t.id = c.trainer_id AND t.gym_id = c.gym_id
            WHERE c.id = ? AND c.gym_id = ?
        `).get(id, gymId);

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
            INSERT INTO gym_classes (gym_id, name, description, instructor, trainer_id, color_theme, max_capacity, duration_minutes, synced, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(gymId, d.name, d.description || null, d.instructor || null, d.trainer_id ?? null, d.color_theme, d.max_capacity, d.duration_minutes);

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
            SET name = ?, description = ?, instructor = ?, trainer_id = ?, color_theme = ?, max_capacity = ?, duration_minutes = ?,
                synced = 0, updated_at = datetime('now')
            WHERE id = ? AND gym_id = ?
        `).run(d.name, d.description || null, d.instructor || null, d.trainer_id ?? null, d.color_theme, d.max_capacity, d.duration_minutes, id, gymId);

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
                c.trainer_id,
                t.name AS trainer_name,
                c.color_theme,
                c.max_capacity,
                c.duration_minutes,
                c.active
            FROM gym_class_schedules s
            JOIN gym_classes c ON c.id = s.class_id AND c.gym_id = s.gym_id
            LEFT JOIN trainers t ON t.id = c.trainer_id AND t.gym_id = c.gym_id
            WHERE s.gym_id = ? AND c.active = 1
            ORDER BY s.day_of_week, s.start_time
        `).all(gymId);
    }

    /**
     * Get bookings from Supabase for a given date.
     * Called from desktop to see who's signed up.
     * Routes through owner-data Edge Function (owner_token bearer).
     */
    async getBookingsForDate(date) {
        const ownerData = require('../cloud/owner-data.client');
        const gymId = this.getGymId();

        const res = await ownerData.select('gym_class_bookings', {
            gymId,
            filters: {
                booking_date: date,
                status: 'confirmed',
            },
        });
        if (!res?.success) throw new Error(`Error cargando reservas: ${res?.error || 'select_failed'}`);

        const bookings = res.data || [];

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
     * Routes through owner-data Edge Function.
     */
    async createEvent(data) {
        const ownerData = require('../cloud/owner-data.client');
        const gymId = this.getGymId();

        const res = await ownerData.insert('gym_class_events', [{
            class_id: data.class_id,
            event_date: data.event_date,
            start_time: data.start_time,
            end_time: data.end_time,
            max_capacity_override: data.max_capacity_override || null,
            instructor_override: data.instructor_override || null,
            notes: data.notes || null,
        }], { gymId, returning: true });
        if (!res?.success) throw new Error(`Error creando evento: ${res?.error || 'insert_failed'}`);
        return Array.isArray(res.data) ? res.data[0] : null;
    }

    /**
     * Fetch sporadic events for a date range.
     */
    async getEvents(startDate, endDate) {
        const ownerData = require('../cloud/owner-data.client');
        const gymId = this.getGymId();

        const res = await ownerData.select('gym_class_events', {
            gymId,
            // Array form on the same column applies all ops in sequence.
            filters: {
                event_date: [
                    { op: 'gte', value: startDate },
                    { op: 'lte', value: endDate },
                ],
            },
            order: [
                { column: 'event_date', ascending: true },
                { column: 'start_time', ascending: true },
            ],
        });
        if (!res?.success) throw new Error(`Error cargando eventos: ${res?.error || 'select_failed'}`);
        return res.data || [];
    }

    /**
     * Cancel a sporadic event (soft delete — set cancelled=true).
     */
    async cancelEvent(eventId) {
        const ownerData = require('../cloud/owner-data.client');
        const gymId = this.getGymId();
        const res = await ownerData.update('gym_class_events',
            { cancelled: true },
            { gymId, filters: { id: eventId } }
        );
        if (!res?.success) throw new Error(`Error cancelando evento: ${res?.error || 'update_failed'}`);
        return true;
    }

    /**
     * Delete a sporadic event (hard delete).
     */
    async deleteEvent(eventId) {
        const ownerData = require('../cloud/owner-data.client');
        const gymId = this.getGymId();
        const res = await ownerData.deleteMatch('gym_class_events',
            { id: eventId },
            { gymId }
        );
        if (!res?.success) throw new Error(`Error eliminando evento: ${res?.error || 'delete_failed'}`);
        return true;
    }

    /**
     * Get bookings from Supabase for a date range (week view).
     * Routes through owner-data Edge Function.
     */
    async getBookingsForWeek(startDate, endDate) {
        const ownerData = require('../cloud/owner-data.client');
        const gymId = this.getGymId();

        const res = await ownerData.select('gym_class_bookings', {
            gymId,
            filters: {
                status: 'confirmed',
                booking_date: [
                    { op: 'gte', value: startDate },
                    { op: 'lte', value: endDate },
                ],
            },
        });
        if (!res?.success) throw new Error(`Error cargando reservas: ${res?.error || 'select_failed'}`);

        const bookings = res.data || [];

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

    // ── Gym Hours Helper ───────────────────────────────────────────────────────
    // Manages the special "Gimnasio" class (gym open hours) without forcing the
    // user to know that it's modeled as a regular class internally.

    /**
     * Get the current gym hours configuration. Returns the special "Gimnasio"
     * class with its schedules grouped per day.
     */
    /**
     * Parse the instructor field, which can be:
     * - null/empty → { shifts: [] }
     * - single string (legacy) → { shifts: [{ days:[0..6], start:'00:00', end:'23:59', instructors:[name] }] }
     * - JSON array of names (older format) → wrap into single all-day shift
     * - JSON object { shifts: [...] } → return as-is
     */
    _parseInstructorConfig(raw) {
        if (!raw || typeof raw !== 'string') return { shifts: [] };
        const trimmed = raw.trim();
        if (!trimmed) return { shifts: [] };

        if (trimmed.startsWith('{')) {
            try {
                const obj = JSON.parse(trimmed);
                if (obj && Array.isArray(obj.shifts)) {
                    return {
                        shifts: obj.shifts.map((s, i) => ({
                            id: s.id || `shift-${i}`,
                            days: Array.isArray(s.days) ? s.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
                            start: typeof s.start === 'string' ? s.start : '00:00',
                            end: typeof s.end === 'string' ? s.end : '23:59',
                            instructors: Array.isArray(s.instructors) ? s.instructors.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [],
                        })),
                    };
                }
            } catch (_) { /* fall through */ }
        }

        if (trimmed.startsWith('[')) {
            try {
                const arr = JSON.parse(trimmed);
                if (Array.isArray(arr)) {
                    const names = arr.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
                    if (names.length > 0) {
                        return {
                            shifts: [{
                                id: 'shift-legacy',
                                days: [0, 1, 2, 3, 4, 5, 6],
                                start: '00:00',
                                end: '23:59',
                                instructors: names,
                            }],
                        };
                    }
                }
            } catch (_) { /* fall through */ }
        }

        // Plain string → wrap as single all-day shift
        return {
            shifts: [{
                id: 'shift-legacy',
                days: [0, 1, 2, 3, 4, 5, 6],
                start: '00:00',
                end: '23:59',
                instructors: [trimmed],
            }],
        };
    }

    getGymHours() {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();

        const gymClass = db
            .prepare("SELECT * FROM gym_classes WHERE gym_id = ? AND name = 'Gimnasio' LIMIT 1")
            .get(gymId);

        if (!gymClass) {
            return { configured: false, max_capacity: 30, duration_minutes: 60, instructors: [], days: [] };
        }

        const rows = db
            .prepare('SELECT day_of_week, start_time, end_time FROM gym_class_schedules WHERE class_id = ? AND gym_id = ? ORDER BY day_of_week, start_time')
            .all(gymClass.id, gymId);

        // Detect slot duration from the first slot (rough heuristic)
        let detectedDuration = gymClass.duration_minutes || 60;
        if (rows.length > 0) {
            const [sh, sm] = rows[0].start_time.split(':').map(Number);
            const [eh, em] = rows[0].end_time.split(':').map(Number);
            detectedDuration = (eh * 60 + em) - (sh * 60 + sm);
        }

        // Group by day, picking earliest start and latest end (treating as one
        // continuous block per day).
        const byDay = new Map();
        for (const row of rows) {
            const existing = byDay.get(row.day_of_week);
            if (!existing) {
                byDay.set(row.day_of_week, { day_of_week: row.day_of_week, start_time: row.start_time, end_time: row.end_time });
            } else {
                if (row.start_time < existing.start_time) existing.start_time = row.start_time;
                if (row.end_time > existing.end_time) existing.end_time = row.end_time;
            }
        }

        const days = Array.from(byDay.values()).sort((a, b) => a.day_of_week - b.day_of_week);
        const instructorConfig = this._parseInstructorConfig(gymClass.instructor);

        return {
            configured: true,
            class_id: gymClass.id,
            enabled: gymClass.active === 1,
            max_capacity: gymClass.max_capacity,
            duration_minutes: detectedDuration,
            shifts: instructorConfig.shifts,
            color_theme: gymClass.color_theme,
            days,
        };
    }

    /**
     * Quick toggle to enable/disable the gym schedule in the mobile app
     * without having to reconfigure everything. When disabled (active=0),
     * the gym slots disappear for clients but the configuration is kept.
     */
    setGymEnabled(enabled) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const activeFlag = enabled ? 1 : 0;
        const result = db.prepare(`
            UPDATE gym_classes
            SET active = ?, synced = 0, updated_at = datetime('now')
            WHERE gym_id = ? AND name = 'Gimnasio'
        `).run(activeFlag, gymId);
        return { success: true, updated: result.changes, enabled: !!enabled };
    }

    /**
     * Configure (or reconfigure) the gym open hours.
     * Creates the "Gimnasio" class if it doesn't exist, then replaces ALL
     * its schedules with the provided config.
     *
     * @param {object} config
     * @param {number} config.max_capacity - max simultaneous users
     * @param {array}  config.days - [{ day_of_week, start_time, end_time }]
     *                 Each "day" is split internally into 1-hour slots so the
     *                 mobile booking UX stays per-hour.
     */
    setGymHours(config) {
        const db = dbManager.getInstance();
        const gymId = this.getGymId();
        const maxCapacity = Math.max(1, Math.min(500, parseInt(config?.max_capacity) || 30));
        const days = Array.isArray(config?.days) ? config.days : [];
        const enabledFlag = config?.enabled === false ? 0 : 1;

        // Shifts are the source of truth for both schedule slots AND trainer assignments.
        // A shift may have no trainers (gym is open but no trainer on duty).
        let shifts = [];
        if (Array.isArray(config?.shifts)) {
            shifts = config.shifts
                .map((s) => ({
                    id: s.id || `shift-${Math.random().toString(36).slice(2, 8)}`,
                    days: Array.isArray(s.days) ? s.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
                    start: /^\d{2}:\d{2}$/.test(s.start) ? s.start : '00:00',
                    end: /^\d{2}:\d{2}$/.test(s.end) ? s.end : '23:59',
                    instructors: Array.isArray(s.instructors) ? s.instructors.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [],
                }))
                .filter((s) => s.days.length > 0 && s.start < s.end);
        } else if (Array.isArray(config?.instructors)) {
            // Legacy fallback: instructors array → single all-week shift
            const names = config.instructors.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
            if (names.length) {
                shifts = [{ id: 'shift-default', days: [0, 1, 2, 3, 4, 5, 6], start: '07:00', end: '22:00', instructors: names }];
            }
        } else if (typeof config?.instructor === 'string' && config.instructor.trim()) {
            shifts = [{ id: 'shift-default', days: [0, 1, 2, 3, 4, 5, 6], start: '07:00', end: '22:00', instructors: [config.instructor.trim()] }];
        }

        const instructor = shifts.length > 0 ? JSON.stringify({ shifts }) : null;

        // Slot duration: validate against allowed values [30, 60, 90, 120]
        const allowedDurations = new Set([30, 60, 90, 120]);
        let duration = parseInt(config?.duration_minutes);
        if (!allowedDurations.has(duration)) duration = 60;

        const txn = db.transaction(() => {
            // 1. Ensure the canonical "Gimnasio" class exists. If there are
            //    duplicates from earlier manual creates, consolidate them all
            //    into the oldest one and delete the rest.
            // Pick the row with non-null instructor FIRST (preserves shifts on consolidate)
            // then fall back to oldest by id.
            const all = db
                .prepare(`
                    SELECT * FROM gym_classes WHERE gym_id = ? AND name = 'Gimnasio'
                    ORDER BY (CASE WHEN instructor IS NOT NULL AND instructor != '' THEN 0 ELSE 1 END), id ASC
                `)
                .all(gymId);
            let gymClass;
            if (all.length === 0) {
                const result = db.prepare(`
                    INSERT INTO gym_classes (gym_id, name, description, instructor, color_theme, max_capacity, duration_minutes, active, synced, updated_at)
                    VALUES (?, 'Gimnasio', 'Horario de gimnasio libre', ?, 'slate', ?, ?, ?, 0, datetime('now'))
                `).run(gymId, instructor, maxCapacity, duration, enabledFlag);
                gymClass = { id: result.lastInsertRowid };
            } else {
                gymClass = all[0];
                // Move schedules from duplicates onto the canonical one, then delete the dups
                if (all.length > 1) {
                    const logDel = db.prepare(
                        'INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)'
                    );
                    for (let i = 1; i < all.length; i++) {
                        try {
                            db.prepare('UPDATE gym_class_schedules SET class_id = ? WHERE class_id = ? AND gym_id = ?')
                                .run(gymClass.id, all[i].id, gymId);
                            logDel.run(gymId, 'gym_classes', all[i].id);
                            db.prepare('DELETE FROM gym_classes WHERE id = ? AND gym_id = ?').run(all[i].id, gymId);
                            console.log(`[Class] Removed duplicate Gimnasio id=${all[i].id} (consolidated into ${gymClass.id})`);
                        } catch (e) {
                            console.warn(`[Class] Failed consolidating Gimnasio #${all[i].id}: ${e.message}`);
                        }
                    }
                }
                db.prepare(`
                    UPDATE gym_classes
                    SET max_capacity = ?, instructor = ?, duration_minutes = ?, active = ?, synced = 0, updated_at = datetime('now')
                    WHERE id = ? AND gym_id = ?
                `).run(maxCapacity, instructor, duration, enabledFlag, gymClass.id, gymId);
            }

            // 2. Log existing schedules for sync_deleted_log, then wipe them
            const oldSchedules = db
                .prepare('SELECT id FROM gym_class_schedules WHERE class_id = ? AND gym_id = ?')
                .all(gymClass.id, gymId);
            const logDel = db.prepare(
                'INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)'
            );
            for (const s of oldSchedules) {
                try { logDel.run(gymId, 'gym_class_schedules', s.id); } catch (_) {}
            }
            db.prepare('DELETE FROM gym_class_schedules WHERE class_id = ? AND gym_id = ?').run(gymClass.id, gymId);

            // 3. Generate slots from SHIFTS (single source of truth).
            //    For each shift, for each day enabled, split [start, end] into N-minute slots.
            //    Deduplicate so overlapping shifts don't create duplicate slots.
            const insertSch = db.prepare(`
                INSERT INTO gym_class_schedules (gym_id, class_id, day_of_week, start_time, end_time, synced, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
            `);
            const fmt = (mins) => {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            };
            const generatedSet = new Set(); // "dayIdx|startMins" for dedup
            let totalSlots = 0;

            for (const shift of shifts) {
                const [sh, sm] = shift.start.split(':').map(Number);
                const [eh, em] = shift.end.split(':').map(Number);
                const startMins = sh * 60 + sm;
                const endMins = eh * 60 + em;

                for (const dayIdx of shift.days) {
                    for (let cur = startMins; cur + duration <= endMins; cur += duration) {
                        const key = `${dayIdx}|${cur}`;
                        if (generatedSet.has(key)) continue;
                        generatedSet.add(key);
                        insertSch.run(gymId, gymClass.id, dayIdx, fmt(cur), fmt(cur + duration));
                        totalSlots++;
                    }
                }
            }

            return { class_id: gymClass.id, total_slots: totalSlots, shifts: shifts.length, duration_minutes: duration };
        });

        return txn();
    }
}

module.exports = new ClassService();
