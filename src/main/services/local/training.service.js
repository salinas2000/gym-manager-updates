const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

// Validation Schemas
const exerciseSchema = z.object({
    name: z.string().min(1, "El nombre del ejercicio es obligatorio"),
    // categoryId is REQUIRED — los ejercicios van bajo una categoría directa
    categoryId: z.number({
        required_error: 'Debes seleccionar una categoría',
        invalid_type_error: 'Debes seleccionar una categoría'
    }).int().positive('Debes seleccionar una categoría'),
    // subcategoryId is kept for back-compat but no longer used
    subcategoryId: z.number().int().positive().nullable().optional(),
    video_url: z.string().url().optional().nullable().or(z.literal('')),
    videoUrl: z.string().url().optional().nullable().or(z.literal('')),
    notes: z.string().optional().nullable(),
    default_sets: z.any().optional(),
    default_reps: z.any().optional(),
    is_failure: z.any().optional(),
    default_intensity: z.any().optional(),
    custom_fields: z.record(z.any()).optional(),
    // How this exercise is measured/logged in the mobile app.
    trackingType: z.string().optional(),
    tracking_type: z.string().optional(),
});

const categorySchema = z.object({
    name: z.string().min(1, "El nombre de la categoría es obligatorio"),
    icon: z.string().min(1, "El icono es obligatorio")
});

const subcategorySchema = z.object({
    categoryId: z.number().int().positive(),
    name: z.string().min(1, "El nombre de la subcategoría es obligatorio")
});

const updateExerciseSchema = exerciseSchema.partial();
const updateCategorySchema = categorySchema.partial();
const updateSubcategorySchema = z.string().min(1, "El nombre de la subcategoría es obligatorio");

const mesocycleSchema = z.object({
    id: z.number().optional(),
    customerId: z.number().optional().nullable(),
    name: z.string().min(1, "El nombre del mesociclo es obligatorio"),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    notes: z.string().optional(),
    isTemplate: z.union([z.boolean(), z.number(), z.string()]).optional(),
    daysPerWeek: z.number().int().min(0).optional(),
    routines: z.array(z.any()).optional()
});

class TrainingService extends BaseService {
    constructor() {
        super(); // Call parent constructor
        // FIX: Cache for deleted field keys to prevent N+1 query
        this._deletedKeysCache = null;
    }

    get db() {
        return dbManager.getInstance();
    }

    // FIX: Removed getGymId() - now inherited from BaseService

    /**
     * Get cached set of deleted field keys
     * FIX: Prevents N+1 query by caching the result
     */
    getDeletedFieldKeys() {
        if (!this._deletedKeysCache) {
            this._deletedKeysCache = new Set(
                this.db.prepare('SELECT field_key FROM exercise_field_config WHERE is_deleted = 1')
                    .all()
                    .map(r => r.field_key)
            );
        }
        return this._deletedKeysCache;
    }

    /**
     * Invalidate deleted keys cache
     * Call this when field configs are modified
     */
    invalidateDeletedKeysCache() {
        this._deletedKeysCache = null;
    }

    // --- EXERCISES ---
    // --- EXERCISES (Relational) ---
    getExercises(filters = {}) {
        // Read category directly via e.category_id. Falls back to deriving from
        // legacy subcategory chain via LEFT JOIN if category_id is NULL.
        let query = `
            SELECT e.*,
                   COALESCE(c.id, c2.id) as category_id,
                   COALESCE(c.name, c2.name) as category_name,
                   COALESCE(c.icon, c2.icon) as category_icon
            FROM exercises e
            LEFT JOIN exercise_categories c ON e.category_id = c.id
            LEFT JOIN exercise_subcategories s ON e.subcategory_id = s.id
            LEFT JOIN exercise_categories c2 ON s.category_id = c2.id
        `;
        const params = [];
        const conditions = [];

        if (filters.search) {
            conditions.push('e.name LIKE ?');
            params.push(`%${filters.search}%`);
        }
        if (filters.category) {
            if (typeof filters.category === 'number') {
                conditions.push('COALESCE(c.id, c2.id) = ?');
                params.push(filters.category);
            } else {
                conditions.push('COALESCE(c.name, c2.name) = ?');
                params.push(filters.category);
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY e.name ASC';
        const rows = this.db.prepare(query).all(...params);

        // FIX: Use cached deleted keys to prevent N+1 query
        const deletedKeys = this.getDeletedFieldKeys();

        return rows.map(r => {
            let fields = {};
            if (r.custom_fields) {
                try { fields = JSON.parse(r.custom_fields); } catch { /* malformed JSON, skip */ }
            }
            if (deletedKeys.size > 0) {
                for (const key of deletedKeys) {
                    delete fields[key];
                }
            }
            return { ...r, custom_fields: fields };
        });
    }

    createExercise(data) {
        const validation = exerciseSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const videoUrl = data.video_url ?? data.videoUrl ?? null;
        const categoryId = data.categoryId;

        // Verify the category exists and belongs to this gym
        const cat = this.db
            .prepare('SELECT id FROM exercise_categories WHERE id = ? AND gym_id = ?')
            .get(categoryId, gymId);
        if (!cat) {
            throw new Error('Categoría no encontrada en este gimnasio');
        }

        const trackingType = data.tracking_type ?? data.trackingType ?? 'strength';

        const stmt = this.db.prepare(`
            INSERT INTO exercises (gym_id, name, category_id, video_url, custom_fields, tracking_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            gymId,
            data.name,
            categoryId,
            videoUrl,
            data.custom_fields ? JSON.stringify(data.custom_fields) : null,
            trackingType
        );
        return { id: info.lastInsertRowid, ...data, categoryId, video_url: videoUrl, tracking_type: trackingType };
    }

    updateExercise(id, data) {
        const validation = updateExerciseSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }
        const validatedData = validation.data;

        // Preserve the existing tracking_type if the caller didn't send one.
        const existing = this.db.prepare('SELECT tracking_type FROM exercises WHERE id = ?').get(id);
        const trackingType = validatedData.tracking_type
            ?? validatedData.trackingType
            ?? existing?.tracking_type
            ?? 'strength';

        const stmt = this.db.prepare(`
            UPDATE exercises
            SET name = @name, category_id = @categoryId, video_url = @video_url,
                custom_fields = @custom_fields, tracking_type = @tracking_type,
                synced = 0, updated_at = datetime('now')
            WHERE id = @id
        `);
        stmt.run({
            name: validatedData.name,
            categoryId: validatedData.categoryId ?? null,
            video_url: validatedData.video_url ?? validatedData.videoUrl ?? null,
            custom_fields: validatedData.custom_fields ? JSON.stringify(validatedData.custom_fields) : null,
            tracking_type: trackingType,
            id
        });
        return { id, ...data, tracking_type: trackingType };
    }

    deleteExercise(id) {
        if (!id) throw new Error('ID de ejercicio requerido');

        const transaction = this.db.transaction(() => {
            const gymId = this.getGymId();

            // Verify exercise exists
            const exercise = this.db.prepare('SELECT id FROM exercises WHERE id = ?').get(id);
            if (!exercise) throw new Error('Ejercicio no encontrado');

            // Log cascaded routine_items deletions for cloud sync
            const affectedItems = this.db.prepare('SELECT id FROM routine_items WHERE exercise_id = ?').all(id);
            const logStmt = this.db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            for (const item of affectedItems) {
                logStmt.run(gymId, 'routine_items', item.id);
            }

            // Log exercise deletion for cloud sync
            logStmt.run(gymId, 'exercises', id);

            // Manual Cascade: Remove from routine_items first
            this.db.prepare('DELETE FROM routine_items WHERE exercise_id = ?').run(id);
            this.db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
        });

        transaction();
        return { success: true, id };
    }

    // --- CATEGORIES & SUBCATEGORIES ---
    // ... (keep existing methods) ...

    // --- SAVE MESOCYCLE ITEM INSERTION UPDATE ---

    // ... (inside saveMesocycle method, replacing insertItem statement) ...
    /* 
       Note: I will use replace_file_content to target the specific `insertItem` SQL and execution loop.
    */


    // --- CATEGORIES & SUBCATEGORIES ---
    getCategories() {
        const categories = this.db.prepare('SELECT * FROM exercise_categories ORDER BY name ASC').all();
        return categories.map(c => ({
            ...c,
            // Convert 1/0 to bool for is_system
            is_system: !!c.is_system,
            subcategories: this.db.prepare('SELECT * FROM exercise_subcategories WHERE category_id = ? ORDER BY name ASC').all(c.id)
        }));
    }

    createCategory(data) {
        const validation = categorySchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const stmt = this.db.prepare('INSERT INTO exercise_categories (gym_id, name, icon) VALUES (?, ?, ?)');
        const info = stmt.run(gymId, data.name, data.icon);
        return { id: info.lastInsertRowid, ...data, is_system: false, subcategories: [] };
    }

    updateCategory(id, data) {
        const validation = updateCategorySchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }
        // Prevent changing is_system
        const stmt = this.db.prepare('UPDATE exercise_categories SET name = ?, icon = ? WHERE id = ?');
        stmt.run(validation.data.name, validation.data.icon, id);
        return { id, ...validation.data };
    }

    createSubcategory(data) {
        const validation = subcategorySchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const stmt = this.db.prepare('INSERT INTO exercise_subcategories (gym_id, category_id, name) VALUES (?, ?, ?)');
        const info = stmt.run(gymId, data.categoryId, data.name);
        return { id: info.lastInsertRowid, category_id: data.categoryId, name: data.name };
    }

    updateSubcategory(id, name) {
        const validation = updateSubcategorySchema.safeParse(name);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }
        const stmt = this.db.prepare('UPDATE exercise_subcategories SET name = ? WHERE id = ?');
        stmt.run(validation.data, id);
        return { id, name: validation.data };
    }

    deleteCategory(id) {
        if (!id) throw new Error('ID de categoría requerido');
        const cat = this.db.prepare('SELECT id FROM exercise_categories WHERE id = ?').get(id);
        if (!cat) throw new Error('Categoría no encontrada');

        const gymId = this.getGymId();

        const transaction = this.db.transaction(() => {
            const logStmt = this.db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            const deleteItemsStmt = this.db.prepare('DELETE FROM routine_items WHERE exercise_id = ?');

            // Log and delete cascaded: subcategories → exercises → routine_items
            const subs = this.db.prepare('SELECT id FROM exercise_subcategories WHERE category_id = ?').all(id);
            for (const sub of subs) {
                const exercises = this.db.prepare('SELECT id FROM exercises WHERE subcategory_id = ?').all(sub.id);
                for (const ex of exercises) {
                    const items = this.db.prepare('SELECT id FROM routine_items WHERE exercise_id = ?').all(ex.id);
                    for (const item of items) logStmt.run(gymId, 'routine_items', item.id);
                    deleteItemsStmt.run(ex.id); // Actually delete routine_items before CASCADE
                    logStmt.run(gymId, 'exercises', ex.id);
                }
                logStmt.run(gymId, 'exercise_subcategories', sub.id);
            }
            logStmt.run(gymId, 'exercise_categories', id);

            this.db.prepare('DELETE FROM exercise_categories WHERE id = ?').run(id);
        });

        transaction();
        return { success: true };
    }

    deleteSubcategory(id) {
        if (!id) throw new Error('ID de subcategoría requerido');
        const sub = this.db.prepare('SELECT id FROM exercise_subcategories WHERE id = ?').get(id);
        if (!sub) throw new Error('Subcategoría no encontrada');

        const gymId = this.getGymId();

        const transaction = this.db.transaction(() => {
            const logStmt = this.db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
            const deleteItemsStmt = this.db.prepare('DELETE FROM routine_items WHERE exercise_id = ?');

            // Log and delete cascaded: exercises → routine_items
            const exercises = this.db.prepare('SELECT id FROM exercises WHERE subcategory_id = ?').all(id);
            for (const ex of exercises) {
                const items = this.db.prepare('SELECT id FROM routine_items WHERE exercise_id = ?').all(ex.id);
                for (const item of items) logStmt.run(gymId, 'routine_items', item.id);
                deleteItemsStmt.run(ex.id); // Actually delete routine_items before CASCADE
                logStmt.run(gymId, 'exercises', ex.id);
            }
            logStmt.run(gymId, 'exercise_subcategories', id);

            this.db.prepare('DELETE FROM exercise_subcategories WHERE id = ?').run(id);
        });

        transaction();
        return { success: true };
    }

    // --- MESOCYCLES (Routines) ---
    getMesocyclesByCustomer(customerId) {
        // Exclude templates from the user timeline; filter by current gym to avoid cross-gym leaks
        const gymId = this.getGymId();
        // Chronological order: earliest mesocycle first, newest last.
        // SQLite sorts NULLs first by default with ASC, so push them last
        // explicitly. Stable tie-break by id keeps creation order intact.
        const mesocycles = this.db.prepare(`
            SELECT * FROM mesocycles
            WHERE customer_id = ? AND is_template = 0 AND gym_id = ?
            ORDER BY (start_date IS NULL), start_date ASC, id ASC
        `).all(customerId, gymId);

        // Calculate status calculated fields
        // Use YYYY-MM-DD strings to avoid Timezone headaches
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

        return mesocycles.map(m => {
            // FIX: Add NULL check to prevent crash if start_date is NULL
            const startStr = m.start_date ? m.start_date.split('T')[0] : todayStr;
            const endStr = m.end_date ? m.end_date.split('T')[0] : null;

            let status = 'expired';

            if (!m.active) {
                status = 'archived';
            } else if (startStr > todayStr) {
                status = 'future';
            } else if (!endStr || endStr >= todayStr) {
                status = 'active'; // Current (Today is included)
            }

            return { ...m, status, routines: this.getRoutinesByMesocycle(m.id) };
        });
    }

    getMesocycle(id) {
        const meso = this.db.prepare('SELECT * FROM mesocycles WHERE id = ?').get(id);
        if (!meso) return null;
        return {
            ...meso,
            routines: this.getRoutinesByMesocycle(meso.id)
        };
    }

    getRoutinesByMesocycle(mesocycleId) {
        // FIX: Use cached deleted keys to prevent N+1 query
        const deletedKeys = this.getDeletedFieldKeys();

        const routines = this.db.prepare('SELECT * FROM routines WHERE mesocycle_id = ? ORDER BY id ASC').all(mesocycleId);
        return routines.map(r => ({
            ...r,
            items: this.db.prepare(`
                SELECT ri.*, e.name as exercise_name,
                       (SELECT ec.name FROM exercise_categories ec
                        JOIN exercise_subcategories es ON es.category_id = ec.id
                        WHERE es.id = e.subcategory_id) as category
                FROM routine_items ri
                LEFT JOIN exercises e ON ri.exercise_id = e.id
                WHERE ri.routine_id = ?
                ORDER BY ri.order_index ASC
             `).all(r.id).map(item => {
                let fields = {};
                if (item.custom_fields) {
                    try { fields = JSON.parse(item.custom_fields); } catch { /* malformed JSON, skip */ }
                }
                if (deletedKeys.size > 0) {
                    for (const key of deletedKeys) {
                        delete fields[key];
                    }
                }
                return { ...item, custom_fields: fields };
            })
        }));
    }

    checkMesocycleOverlap(customerId, startDate, endDate, excludeId = null) {
        // Overlap: two ranges [A_start, A_end] and [B_start, B_end] overlap when:
        // A_start <= B_end AND A_end >= B_start
        // Here: existing.start_date <= newEndDate AND (existing.end_date >= newStartDate OR existing.end_date IS NULL)
        if (!customerId) return { hasOverlap: false }; // Templates don't overlap
        if (!startDate) return { hasOverlap: false }; // No start date = no range to check

        const gymId = this.getGymId();
        let query = `
            SELECT id FROM mesocycles
            WHERE gym_id = ?
            AND customer_id = ?
            AND active = 1
            AND is_template = 0
            AND start_date <= ?
            AND (end_date >= ? OR end_date IS NULL)
        `;
        const newEndDate = endDate || '9999-12-31';
        const params = [gymId, customerId, newEndDate, startDate];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const conflict = this.db.prepare(query).get(...params);
        return conflict ? { hasOverlap: true, conflictId: conflict.id } : { hasOverlap: false };
    }

    deleteMesocycle(id) {
        if (!id) throw new Error('ID de mesociclo requerido');
        const meso = this.db.prepare('SELECT id FROM mesocycles WHERE id = ?').get(id);
        if (!meso) throw new Error('Mesociclo no encontrado');

        const gymId = this.getGymId();
        // CRITICAL: wrap the entire delete in a single transaction. Without
        // it, a crash between the sync_deleted_log inserts and the actual
        // DELETE would leave the log claiming we deleted rows that still
        // exist locally — next sync would wipe them from cloud and then
        // re-upload them, causing a flap. With db.transaction, better-sqlite3
        // rolls back atomically if anything throws.
        const logStmt = this.db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)');
        const getRoutines = this.db.prepare('SELECT id FROM routines WHERE mesocycle_id = ?');
        const getItems = this.db.prepare('SELECT id FROM routine_items WHERE routine_id = ?');
        const deleteMeso = this.db.prepare('DELETE FROM mesocycles WHERE id = ?');

        const tx = this.db.transaction((mesoId) => {
            // Log cascaded deletions: routines → routine_items (CASCADE in DB)
            const routines = getRoutines.all(mesoId);
            for (const r of routines) {
                const items = getItems.all(r.id);
                for (const item of items) logStmt.run(gymId, 'routine_items', item.id);
                logStmt.run(gymId, 'routines', r.id);
            }
            logStmt.run(gymId, 'mesocycles', mesoId);
            return deleteMeso.run(mesoId);
        });

        return tx(id);
    }

    // --- TEMPLATES ---

    getTemplates(daysFilter = null) {
        // Templates are just mesocycles marked with is_template=1
        let query = 'SELECT * FROM mesocycles WHERE is_template = 1';
        const params = [];

        if (daysFilter) {
            query += ' AND days_per_week = ?';
            params.push(daysFilter);
        }

        query += ' ORDER BY days_per_week ASC, name ASC';

        const templates = this.db.prepare(query).all(...params);
        return templates.map(t => ({
            ...t,
            routines: this.getRoutinesByMesocycle(t.id)
        }));
    }

    saveTemplate(data) {
        // Create a copy of the structure with isTemplate flag
        const templateData = { ...data, isTemplate: true };
        return this.saveMesocycle(templateData);
    }

    // Transactional Save: Mesocycle + Routines + Items
    // v2.2.0 — surgical routine reconciliation (no more duplicate-day bug)
    saveMesocycle(data) {
        console.log('[saveMesocycle v2.2.0] called for meso id=', data?.id, 'routines=', (data?.routines || []).length);
        // Validation
        const validation = mesocycleSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        // Normalize Inputs
        // Critical: When exporting, we pass DB object (snake_case). Editor passes Form object (camelCase).
        const normalizedData = {
            id: data.id,
            customerId: data.customerId || data.customer_id,
            name: data.name,
            startDate: data.startDate || data.start_date,
            endDate: data.endDate || data.end_date,
            notes: data.notes,
            isTemplate: (data.isTemplate === true || data.isTemplate === 'true' || data.is_template === 1) ? 1 : 0,
            daysPerWeek: data.daysPerWeek || data.days_per_week,
            routines: data.routines
        };

        const isTemplate = normalizedData.isTemplate;
        const allowOverlap = (data.allowOverlap === true || data.allowOverlap === 'true');
        console.log('[saveMesocycle] Overlap Check Config:', { isTemplate, allowOverlap, dataAllowOverlap: data.allowOverlap });

        // If it's NOT a template, check overlaps
        const overlapCheck = this.checkMesocycleOverlap(
            normalizedData.customerId,
            normalizedData.startDate,
            normalizedData.endDate,
            normalizedData.id
        );
        if (!isTemplate && overlapCheck.hasOverlap && !allowOverlap) {
            throw new Error('Las fechas se solapan con otro mesociclo activo.');
        }

        // PREPARE STATEMENTS
        const gymId = this.getGymId();
        const insertMeso = this.db.prepare(`
            INSERT INTO mesocycles (gym_id, customer_id, name, start_date, end_date, notes, active, is_template, days_per_week)
            VALUES (@gymId, @customerId, @name, @startDate, @endDate, @notes, 1, @isTemplate, @daysPerWeek)
        `);

        const updateMeso = this.db.prepare(`
            UPDATE mesocycles
            SET name = @name, start_date = @startDate, end_date = @endDate,
                notes = @notes, active = 1, is_template = @isTemplate, days_per_week = @daysPerWeek,
                synced = 0, updated_at = datetime('now')
            WHERE id = @id
        `);

        // Routine reconciliation statements.
        // KEY FIX: instead of `DELETE FROM routines WHERE mesocycle_id = ?` (which
        // wiped all rows and re-inserted them with NEW local ids — leaving the
        // cloud with both the orphaned old "Día 1" AND the new one, producing
        // the duplicate-day bug), we now:
        //   1. Look up the routines already in this mesocycle.
        //   2. UPDATE in place the ones the payload still has.
        //   3. INSERT only the truly new ones.
        //   4. DELETE + log to sync_deleted_log the ones removed from the payload.
        const getExistingRoutines = this.db.prepare('SELECT id FROM routines WHERE mesocycle_id = ?');
        const insertRoutine = this.db.prepare(`
           INSERT INTO routines (gym_id, mesocycle_id, name, day_group, notes)
           VALUES (@gymId, @mesocycleId, @name, @dayGroup, @notes)
        `);
        const updateRoutine = this.db.prepare(`
            UPDATE routines
            SET name = @name, day_group = @dayGroup, notes = @notes,
                synced = 0, updated_at = datetime('now')
            WHERE id = @id
        `);
        const deleteRoutineById = this.db.prepare('DELETE FROM routines WHERE id = ?');

        // Item reconciliation — preserves per-item local_ids so that
        // customer_workout_logs (which reference routine_item_id) don't get
        // orphaned every time the user edits anything else in the routine.
        const getExistingItems = this.db.prepare('SELECT id FROM routine_items WHERE routine_id = ?');
        const deleteItemsByRoutine = this.db.prepare('DELETE FROM routine_items WHERE routine_id = ?');
        const deleteSingleItem = this.db.prepare('DELETE FROM routine_items WHERE id = ?');
        const logDelete = this.db.prepare(
            'INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)'
        );

        const insertItem = this.db.prepare(`
            INSERT INTO routine_items (gym_id, routine_id, exercise_id, series, reps, rpe, notes, order_index, intensity, custom_fields)
            VALUES (@gymId, @routineId, @exerciseId, @series, @reps, @rpe, @notes, @orderIndex, @intensity, @customFields)
        `);

        const updateItemStmt = this.db.prepare(`
            UPDATE routine_items
            SET exercise_id = @exerciseId,
                series = @series,
                reps = @reps,
                rpe = @rpe,
                notes = @notes,
                order_index = @orderIndex,
                intensity = @intensity,
                custom_fields = @customFields,
                synced = 0,
                updated_at = datetime('now')
            WHERE id = @id
        `);

        // Helper: reconcile the items of ONE routine against a payload list.
        // Items in payload with a matching DB id → UPDATE in place (preserves
        // workout_logs that reference routine_item_id). Items without an id
        // are inserted fresh. Anything in the existing set that the payload
        // doesn't keep is deleted + logged for cloud cleanup.
        const reconcileItems = (routineId, payloadItems) => {
            const existingItemIds = new Set(getExistingItems.all(routineId).map(i => i.id));
            const keptItemIds = new Set();
            let order = 0;
            for (const item of payloadItems || []) {
                const itemId = item.id;
                const isExistingItem =
                    typeof itemId === 'number' &&
                    Number.isInteger(itemId) &&
                    existingItemIds.has(itemId);
                const customFields = (item.customFields || item.custom_fields)
                    ? JSON.stringify(item.customFields || item.custom_fields)
                    : null;
                if (isExistingItem) {
                    updateItemStmt.run({
                        id: itemId,
                        exerciseId: item.exerciseId || item.exercise_id,
                        series: item.series ?? null,
                        reps: item.reps ?? null,
                        rpe: item.rpe || '',
                        notes: item.notes || '',
                        orderIndex: order++,
                        intensity: item.intensity || '',
                        customFields,
                    });
                    keptItemIds.add(itemId);
                } else {
                    insertItem.run({
                        gymId,
                        routineId,
                        exerciseId: item.exerciseId || item.exercise_id,
                        series: item.series ?? null,
                        reps: item.reps ?? null,
                        rpe: item.rpe || '',
                        notes: item.notes || '',
                        orderIndex: order++,
                        intensity: item.intensity || '',
                        customFields,
                    });
                }
            }
            // Anything existing but not in payload → delete + log
            for (const oldItemId of existingItemIds) {
                if (keptItemIds.has(oldItemId)) continue;
                logDelete.run(gymId, 'routine_items', oldItemId);
                deleteSingleItem.run(oldItemId);
            }
        };

        // EXECUTE TRANSACTION
        const transaction = this.db.transaction((mesoData) => {
            let mesoId = mesoData.id;
            let existingRoutineIds = new Set();

            if (mesoId) {
                // Update existing mesocycle
                updateMeso.run({
                    id: mesoId,
                    name: mesoData.name,
                    startDate: mesoData.startDate,
                    endDate: mesoData.endDate,
                    notes: mesoData.notes || '',
                    isTemplate: mesoData.isTemplate,
                    daysPerWeek: mesoData.daysPerWeek || 0
                });
                // Snapshot of what's currently in the DB for this mesocycle
                existingRoutineIds = new Set(getExistingRoutines.all(mesoId).map(r => r.id));
                console.log('[saveMesocycle v2.2.0] existing routines for meso', mesoId, '→', [...existingRoutineIds]);
                console.log('[saveMesocycle v2.2.0] payload routine ids →', (mesoData.routines || []).map(r => ({ id: r.id, idType: typeof r.id, isInt: Number.isInteger(r.id), name: r.name })));
            } else {
                // Insert new mesocycle
                const info = insertMeso.run({
                    gymId,
                    customerId: mesoData.customerId,
                    name: mesoData.name,
                    startDate: mesoData.startDate,
                    endDate: mesoData.endDate,
                    notes: mesoData.notes || '',
                    isTemplate: mesoData.isTemplate,
                    daysPerWeek: mesoData.daysPerWeek || 0
                });
                mesoId = info.lastInsertRowid;
            }

            // Track which existing routines the payload kept (everything else
            // will be deleted at the end).
            const keptRoutineIds = new Set();

            // Reconcile each routine in the payload
            if (mesoData.routines && mesoData.routines.length > 0) {
                for (const routine of mesoData.routines) {
                    let routineId;
                    const isExistingDbRoutine =
                        typeof routine.id === 'number' &&
                        Number.isInteger(routine.id) &&
                        existingRoutineIds.has(routine.id);

                    if (isExistingDbRoutine) {
                        console.log('[saveMesocycle v2.2.0] UPDATE in-place routine id=', routine.id);
                        // UPDATE the existing routine row (metadata only)
                        updateRoutine.run({
                            id: routine.id,
                            name: routine.name,
                            dayGroup: routine.dayGroup || '',
                            notes: ''
                        });
                        routineId = routine.id;
                        keptRoutineIds.add(routineId);
                        // Reconcile items in place — preserves item local_ids
                        // so customer_workout_logs stay attached to their slots.
                        reconcileItems(routineId, routine.items);
                    } else {
                        console.log('[saveMesocycle v2.2.0] INSERT new routine (payload id=', routine.id, 'not in existing set)');
                        // INSERT a new routine row
                        const rInfo = insertRoutine.run({
                            gymId,
                            mesocycleId: mesoId,
                            name: routine.name,
                            dayGroup: routine.dayGroup || '',
                            notes: ''
                        });
                        routineId = rInfo.lastInsertRowid;
                        console.log('[saveMesocycle v2.2.0] → new routine id=', routineId);
                        // No existing items on a brand-new routine — just insert
                        // the payload items. reconcileItems handles this correctly
                        // (existingItemIds is empty, so everything is INSERT).
                        reconcileItems(routineId, routine.items);
                    }
                }
            }

            // Anything that existed before but the payload no longer has → delete + log
            console.log('[saveMesocycle v2.2.0] kept routines →', [...keptRoutineIds], '/ existing was →', [...existingRoutineIds]);
            for (const oldId of existingRoutineIds) {
                if (keptRoutineIds.has(oldId)) continue;
                // Log all its items as deleted too (cloud needs to drop them)
                const itemIds = getExistingItems.all(oldId).map(i => i.id);
                console.log('[saveMesocycle v2.2.0] DELETE orphan routine id=', oldId, 'items=', itemIds, 'gymId=', gymId);
                for (const iid of itemIds) {
                    logDelete.run(gymId, 'routine_items', iid);
                }
                deleteItemsByRoutine.run(oldId);
                logDelete.run(gymId, 'routines', oldId);
                deleteRoutineById.run(oldId);
            }

            return { success: true, id: mesoId };
        });

        return transaction(normalizedData);
    }

    saveFileHistory(customerId, fileName, publicUrl) {
        if (!customerId || !fileName) return;
        const db = require('../../db/database').getInstance();
        const gymId = this.getGymId();
        // Include gym_id if the column exists, fallback to basic insert
        try {
            const stmt = db.prepare('INSERT INTO file_history (gym_id, customer_id, file_name, public_url) VALUES (?, ?, ?, ?)');
            stmt.run(gymId, customerId, fileName, publicUrl);
        } catch (e) {
            // Fallback if gym_id column doesn't exist yet
            const stmt = db.prepare('INSERT INTO file_history (customer_id, file_name, public_url) VALUES (?, ?, ?)');
            stmt.run(customerId, fileName, publicUrl);
        }
    }

    updateMesocycleLink(mesoId, publicUrl) {
        const db = require('../../db/database').getInstance();
        const stmt = db.prepare('UPDATE mesocycles SET drive_link = ? WHERE id = ?');
        stmt.run(publicUrl, mesoId);
    }

    // --- FIELD CONFIGURATION ---
    // All field-config reads/writes are scoped to the currently licensed gym.
    // Returning everything (across gyms) would mix tenants and let one gym's
    // toggle silently affect another's.
    getExerciseFieldConfigs() {
        const gymId = this.getGymId();
        const configs = this.db
            .prepare('SELECT * FROM exercise_field_config WHERE is_deleted = 0 AND gym_id = ? ORDER BY created_at ASC')
            .all(gymId);
        return configs.map(c => ({
            ...c,
            options: c.options ? JSON.parse(c.options) : null
        }));
    }

    // Returns ALL configs (including deleted) for the current gym only.
    getAllExerciseFieldConfigs() {
        const gymId = this.getGymId();
        const configs = this.db
            .prepare('SELECT * FROM exercise_field_config WHERE gym_id = ? ORDER BY created_at ASC')
            .all(gymId);
        return configs.map(c => ({
            ...c,
            options: c.options ? JSON.parse(c.options) : null
        }));
    }

    updateExerciseFieldConfig(key, data) {
        // is_loggable and is_prescribable are hardcoded per catalog entry —
        // we look them up rather than trusting whatever the caller passed.
        const { getCatalogField } = require('../../constants/field-catalog');
        const catalog = getCatalogField(key);
        const gymId = this.getGymId();
        // Filter by (gym_id, field_key) so a toggle in gym A never bleeds to gym B.
        const stmt = this.db.prepare(`
            UPDATE exercise_field_config
            SET label = @label, type = @type, is_active = @is_active,
                is_mandatory_in_template = @is_mandatory_in_template,
                is_loggable = @is_loggable, is_prescribable = @is_prescribable,
                options = @options,
                synced = 0, updated_at = datetime('now')
            WHERE field_key = @field_key AND gym_id = @gym_id
        `);
        stmt.run({
            label: data.label,
            type: data.type || 'text',
            is_active: data.is_active ? 1 : 0,
            is_mandatory_in_template: data.is_mandatory_in_template ? 1 : 0,
            // Catalog wins when the key is canonical; otherwise honor caller.
            is_loggable: catalog ? (catalog.loggable ? 1 : 0) : (data.is_loggable ? 1 : 0),
            is_prescribable: catalog ? (catalog.prescribable ? 1 : 0) : (data.is_prescribable ?? 1),
            options: data.options ? JSON.stringify(data.options) : null,
            field_key: key,
            gym_id: gymId,
        });
        return { success: true };
    }

    addFieldConfig(label, type, options = null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const gymId = this.getGymId();
        const optionsJson = options ? JSON.stringify(options) : null;

        // Check if a deleted field with the same key exists — recycle it
        const existing = this.db.prepare(
            'SELECT field_key FROM exercise_field_config WHERE field_key = ? AND gym_id = ?'
        ).get(key, gymId);

        if (existing) {
            this.db.prepare(`
                UPDATE exercise_field_config
                SET label = ?, type = ?, options = ?, is_active = 1, is_deleted = 0,
                    synced = 0, updated_at = datetime('now')
                WHERE field_key = ? AND gym_id = ?
            `).run(label, type || 'text', optionsJson, key, gymId);
        } else {
            this.db.prepare(`
                INSERT INTO exercise_field_config (gym_id, field_key, label, type, options, is_active, synced, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, 0, datetime('now'))
            `).run(gymId, key, label, type || 'text', optionsJson);
        }
        return { success: true, key };
    }

    deleteFieldConfig(key) {
        // Catalog entries are off-limits — the entire 9 are required for the
        // mobile app to render correctly. Anything else can be archived.
        const { isCatalogField } = require('../../constants/field-catalog');
        if (isCatalogField(key)) {
            throw new Error(`El campo "${key}" forma parte del catálogo y no se puede eliminar`);
        }
        const gymId = this.getGymId();
        const transaction = this.db.transaction(() => {
            // 1. Mark field config as deleted FOR THIS GYM ONLY
            this.db
                .prepare('UPDATE exercise_field_config SET is_deleted = 1, is_active = 0 WHERE field_key = ? AND gym_id = ?')
                .run(key, gymId);

            // 2. Remove field from exercises.custom_fields JSON (scoped to gym)
            const exercises = this.db
                .prepare("SELECT id, custom_fields FROM exercises WHERE custom_fields IS NOT NULL AND custom_fields != '{}' AND gym_id = ?")
                .all(gymId);
            const updateExStmt = this.db.prepare('UPDATE exercises SET custom_fields = ? WHERE id = ?');
            for (const ex of exercises) {
                try {
                    const fields = JSON.parse(ex.custom_fields);
                    if (key in fields) {
                        delete fields[key];
                        updateExStmt.run(Object.keys(fields).length > 0 ? JSON.stringify(fields) : null, ex.id);
                    }
                } catch { /* skip malformed JSON */ }
            }

            // 3. Remove field from routine_items.custom_fields JSON (scoped to gym)
            const items = this.db
                .prepare("SELECT id, custom_fields FROM routine_items WHERE custom_fields IS NOT NULL AND custom_fields != '{}' AND gym_id = ?")
                .all(gymId);
            const updateItemStmt = this.db.prepare('UPDATE routine_items SET custom_fields = ? WHERE id = ?');
            for (const item of items) {
                try {
                    const fields = JSON.parse(item.custom_fields);
                    if (key in fields) {
                        delete fields[key];
                        updateItemStmt.run(Object.keys(fields).length > 0 ? JSON.stringify(fields) : null, item.id);
                    }
                } catch { /* skip malformed JSON */ }
            }
        });

        transaction();
        return { success: true };
    }

    // --- PRIORITIES & MANAGEMENT ---
    getTrainingPriorities() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Last day of current month
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

        // Get active customers who are NOT scheduled to cancel this month
        // Using NOT EXISTS instead of NOT IN to avoid NULL pitfalls
        const query = `
            SELECT
                c.id,
                c.first_name,
                c.last_name,
                (SELECT end_date FROM mesocycles m
                 WHERE m.customer_id = c.id AND m.is_template = 0 AND m.active = 1
                 ORDER BY m.end_date DESC LIMIT 1) as plan_end_date
            FROM customers c
            WHERE c.active = 1
            AND NOT EXISTS (
                SELECT 1 FROM memberships mb
                WHERE mb.customer_id = c.id
                AND mb.end_date IS NOT NULL
                AND mb.end_date <= ?
                AND mb.end_date >= DATE('now', 'start of month')
            )
        `;

        const rawData = this.db.prepare(query).all(lastDayStr);

        const priorityList = rawData.map(c => {
            let status = 'none'; // No active plan found
            let daysRemaining = 999;

            if (c.plan_end_date) {
                const end = new Date(c.plan_end_date);
                const diffTime = end - today;
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (c.plan_end_date < todayStr) {
                    status = 'expired';
                } else if (daysRemaining <= 7) {
                    status = 'urgent';
                } else {
                    status = 'good';
                }
            } else {
                daysRemaining = -1; // No plan means highest priority
            }

            return {
                ...c,
                status,
                daysRemaining
            };
        });

        // Priority Sorting:
        // 1. Expired/None (Status order: expired -> none -> urgent -> good)
        // 2. Shortest remaining days
        return priorityList.sort((a, b) => {
            const order = { 'expired': 0, 'none': 1, 'urgent': 2, 'good': 3 };
            if (order[a.status] !== order[b.status]) {
                return order[a.status] - order[b.status];
            }
            return a.daysRemaining - b.daysRemaining;
        });
    }

    /**
     * Importa un dataset de ejercicios (JSON) de forma additiva.
     * Estructura esperada:
     *   {
     *     categories: [
     *       { name, icon, subcategories?: [{ name, exercises: [{name}] }] | exercises: [{name}] }
     *     ]
     *   }
     * Si no hay subcategorías, todos los ejercicios van a una "General" autocreada.
     * Devuelve estadísticas de qué se insertó vs. qué ya existía.
     */
    importDataset(dataset) {
        if (!dataset || !Array.isArray(dataset.categories)) {
            throw new Error('Dataset inválido: falta categories[]');
        }

        const gymId = this.getGymId();
        const insCat = this.db.prepare('INSERT OR IGNORE INTO exercise_categories (gym_id, name, icon, is_system) VALUES (?, ?, ?, 1)');
        const getCat = this.db.prepare('SELECT id FROM exercise_categories WHERE name = ? AND gym_id = ?');
        const insSub = this.db.prepare('INSERT OR IGNORE INTO exercise_subcategories (gym_id, category_id, name) VALUES (?, ?, ?)');
        const getSub = this.db.prepare('SELECT id FROM exercise_subcategories WHERE name = ? AND category_id = ?');
        const getEx = this.db.prepare('SELECT id FROM exercises WHERE name = ? AND gym_id = ?');
        const insEx = this.db.prepare(`
            INSERT INTO exercises (gym_id, subcategory_id, name, default_sets, default_reps, custom_fields, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        const stats = { categoriesNew: 0, categoriesExisting: 0, subcategoriesNew: 0, exercisesNew: 0, exercisesSkipped: 0 };

        const tx = this.db.transaction(() => {
            for (const cat of dataset.categories) {
                if (!cat?.name) continue;
                const icon = cat.icon || '💪';
                const before = getCat.get(cat.name, gymId);
                insCat.run(gymId, cat.name, icon);
                const catRow = getCat.get(cat.name, gymId);
                if (!catRow) continue;
                if (before) stats.categoriesExisting++; else stats.categoriesNew++;

                // Soporta ambas estructuras
                if (Array.isArray(cat.subcategories)) {
                    for (const sub of cat.subcategories) {
                        if (!sub?.name) continue;
                        const subBefore = getSub.get(sub.name, catRow.id);
                        insSub.run(gymId, catRow.id, sub.name);
                        const subRow = getSub.get(sub.name, catRow.id);
                        if (!subRow) continue;
                        if (!subBefore) stats.subcategoriesNew++;
                        for (const ex of (sub.exercises || [])) {
                            this._importExerciseRow(ex, gymId, subRow.id, getEx, insEx, stats);
                        }
                    }
                } else if (Array.isArray(cat.exercises)) {
                    insSub.run(gymId, catRow.id, 'General');
                    const subRow = getSub.get('General', catRow.id);
                    if (!subRow) continue;
                    if (!before) stats.subcategoriesNew++;
                    for (const ex of cat.exercises) {
                        this._importExerciseRow(ex, gymId, subRow.id, getEx, insEx, stats);
                    }
                }
            }
        });
        tx();
        return stats;
    }

    _importExerciseRow(ex, gymId, subId, getEx, insEx, stats) {
        if (!ex?.name) return;
        if (getEx.get(ex.name, gymId)) { stats.exercisesSkipped++; return; }
        const fields = ex.custom_fields || { series: 4, repeticiones: '8-12', peso: '', descanso: '90', rir: 2 };
        insEx.run(gymId, subId, ex.name, ex.default_sets || 4, ex.default_reps || '8-12', JSON.stringify(fields));
        stats.exercisesNew++;
    }

    /**
     * Exporta toda la biblioteca de ejercicios del gym a un objeto JSON-friendly.
     */
    exportDataset() {
        const gymId = this.getGymId();
        const cats = this.db.prepare('SELECT id, name, icon FROM exercise_categories WHERE gym_id = ? ORDER BY name').all(gymId);
        const result = {
            meta: {
                exported_at: new Date().toISOString(),
                gym_id: gymId,
                total_exercises: 0,
            },
            categories: [],
        };
        for (const c of cats) {
            const subs = this.db.prepare('SELECT id, name FROM exercise_subcategories WHERE category_id = ? ORDER BY name').all(c.id);
            const catObj = { name: c.name, icon: c.icon, subcategories: [] };
            for (const s of subs) {
                const exs = this.db.prepare('SELECT name, default_sets, default_reps, custom_fields FROM exercises WHERE subcategory_id = ? AND gym_id = ? ORDER BY name').all(s.id, gymId);
                const subObj = { name: s.name, exercises: exs.map(e => ({
                    name: e.name,
                    default_sets: e.default_sets,
                    default_reps: e.default_reps,
                    custom_fields: e.custom_fields ? (() => { try { return JSON.parse(e.custom_fields); } catch { return undefined; } })() : undefined,
                })) };
                catObj.subcategories.push(subObj);
                result.meta.total_exercises += exs.length;
            }
            result.categories.push(catObj);
        }
        return result;
    }
}

module.exports = new TrainingService();
