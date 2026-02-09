const dbManager = require('../../db/database');
const z = require('zod');
const BaseService = require('../BaseService');

// Validation Schemas
const exerciseSchema = z.object({
    name: z.string().min(1, "El nombre del ejercicio es obligatorio"),
    subcategoryId: z.number().int().positive("La subcategoría es obligatoria"),
    video_url: z.string().url().optional().nullable().or(z.literal('')),
    // Legacy fields made optional
    default_sets: z.any().optional(),
    default_reps: z.any().optional(),
    is_failure: z.any().optional(),
    default_intensity: z.any().optional(),
    custom_fields: z.record(z.any()).optional()
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
        let query = `
            SELECT e.*, 
                   s.name as subcategory_name, 
                   s.id as subcategory_id,
                   c.name as category_name, 
                   c.icon as category_icon,
                   c.id as category_id
            FROM exercises e
            LEFT JOIN exercise_subcategories s ON e.subcategory_id = s.id
            LEFT JOIN exercise_categories c ON s.category_id = c.id
        `;
        const params = [];
        const conditions = [];

        if (filters.search) {
            conditions.push('e.name LIKE ?');
            params.push(`%${filters.search}%`);
        }
        if (filters.category) {
            conditions.push('c.name = ?');
            params.push(filters.category);
        }
        if (filters.subcategory) { // Support ID or Name
            if (typeof filters.subcategory === 'number') {
                conditions.push('s.id = ?');
                params.push(filters.subcategory);
            } else {
                conditions.push('s.name = ?');
                params.push(filters.subcategory);
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
        const stmt = this.db.prepare(`
            INSERT INTO exercises (gym_id, name, subcategory_id, video_url, custom_fields) 
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            gymId,
            data.name,
            data.subcategoryId,
            data.video_url,
            data.custom_fields ? JSON.stringify(data.custom_fields) : null
        );
        return { id: info.lastInsertRowid, ...data };
    }

    updateExercise(id, data) {
        const validation = updateExerciseSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }
        const validatedData = validation.data;

        const stmt = this.db.prepare(`
            UPDATE exercises 
            SET name = @name, subcategory_id = @subcategoryId, video_url = @video_url, 
                custom_fields = @custom_fields,
                synced = 0, updated_at = datetime('now')
            WHERE id = @id
        `);
        stmt.run({
            name: validatedData.name,
            subcategoryId: validatedData.subcategoryId,
            video_url: validatedData.video_url,
            custom_fields: validatedData.custom_fields ? JSON.stringify(validatedData.custom_fields) : null,
            id
        });
        return { id, ...data };
    }

    deleteExercise(id) {
        // Manual Cascade: Remove from routine_items first
        const deleteItems = this.db.prepare('DELETE FROM routine_items WHERE exercise_id = ?');
        const deleteEx = this.db.prepare('DELETE FROM exercises WHERE id = ?');

        const transaction = this.db.transaction(() => {
            deleteItems.run(id);
            deleteEx.run(id);
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
        // Users can delete any category, even seeded ones if they wish. Database CASCADE handles children.
        return this.db.prepare('DELETE FROM exercise_categories WHERE id = ?').run(id);
    }

    deleteSubcategory(id) {
        // Database rules will handle cascade to exercises (now fixed to CASCADE)
        return this.db.prepare('DELETE FROM exercise_subcategories WHERE id = ?').run(id);
    }

    // --- MESOCYCLES (Routines) ---
    getMesocyclesByCustomer(customerId) {
        // Exclude templates from the user timeline
        const mesocycles = this.db.prepare(`
            SELECT * FROM mesocycles 
            WHERE customer_id = ? AND is_template = 0 
            ORDER BY start_date DESC
        `).all(customerId);

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
                SELECT ri.*, e.name as exercise_name, e.category
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

        let query = `
            SELECT id FROM mesocycles
            WHERE customer_id = ?
            AND active = 1
            AND is_template = 0
            AND start_date <= ?
            AND (end_date >= ? OR end_date IS NULL)
        `;
        const newEndDate = endDate || '9999-12-31';
        const params = [customerId, newEndDate, startDate];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const conflict = this.db.prepare(query).get(...params);
        return conflict ? { hasOverlap: true, conflictId: conflict.id } : { hasOverlap: false };
    }

    deleteMesocycle(id) {
        return this.db.prepare('DELETE FROM mesocycles WHERE id = ?').run(id);
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
    // Transactional Save: Mesocycle + Routines + Items
    saveMesocycle(data) {
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

        // Routines & Items
        const deleteRoutines = this.db.prepare('DELETE FROM routines WHERE mesocycle_id = ?');

        const insertRoutine = this.db.prepare(`
           INSERT INTO routines (gym_id, mesocycle_id, name, day_group, notes)
           VALUES (@gymId, @mesocycleId, @name, @dayGroup, @notes) 
        `);

        const insertItem = this.db.prepare(`
            INSERT INTO routine_items (gym_id, routine_id, exercise_id, series, reps, rpe, notes, order_index, intensity, custom_fields)
            VALUES (@gymId, @routineId, @exerciseId, @series, @reps, @rpe, @notes, @orderIndex, @intensity, @customFields)
        `);

        // EXECUTE TRANSACTION
        const transaction = this.db.transaction((mesoData) => {
            let mesoId = mesoData.id;

            if (mesoId) {
                // Update existing
                updateMeso.run({
                    id: mesoId,
                    name: mesoData.name,
                    startDate: mesoData.startDate,
                    endDate: mesoData.endDate,
                    notes: mesoData.notes || '',
                    isTemplate: mesoData.isTemplate,
                    daysPerWeek: mesoData.daysPerWeek || 0
                });
                // Rebuild routines (Delete all + Re-insert)
                deleteRoutines.run(mesoId);
            } else {
                // Insert new
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

            // Insert Routines
            if (mesoData.routines && mesoData.routines.length > 0) {
                for (const routine of mesoData.routines) {
                    const rInfo = insertRoutine.run({
                        gymId,
                        mesocycleId: mesoId,
                        name: routine.name,
                        dayGroup: routine.dayGroup || '',
                        notes: ''
                    });
                    const routineId = rInfo.lastInsertRowid;

                    // Insert Items
                    if (routine.items && routine.items.length > 0) {
                        let order = 0;
                        for (const item of routine.items) {
                            insertItem.run({
                                gymId,
                                routineId,
                                exerciseId: item.exerciseId || item.exercise_id, // Flexible ID source
                                series: item.series,
                                reps: item.reps,
                                rpe: item.rpe || '',
                                notes: item.notes || '',
                                orderIndex: order++,
                                intensity: item.intensity || '',
                                customFields: item.customFields || item.custom_fields ? JSON.stringify(item.customFields || item.custom_fields) : null
                            });
                        }
                    }
                }
            }
            return { success: true, id: mesoId };
        });

        return transaction(normalizedData);
    }

    saveFileHistory(customerId, fileName, publicUrl) {
        const db = require('../../db/database').getInstance();
        const stmt = db.prepare('INSERT INTO file_history (customer_id, file_name, public_url) VALUES (?, ?, ?)');
        stmt.run(customerId, fileName, publicUrl);
    }

    updateMesocycleLink(mesoId, publicUrl) {
        const db = require('../../db/database').getInstance();
        const stmt = db.prepare('UPDATE mesocycles SET drive_link = ? WHERE id = ?');
        stmt.run(publicUrl, mesoId);
    }

    // --- FIELD CONFIGURATION ---
    getExerciseFieldConfigs() {
        const configs = this.db.prepare('SELECT * FROM exercise_field_config WHERE is_deleted = 0 ORDER BY created_at ASC').all();
        return configs.map(c => ({
            ...c,
            options: c.options ? JSON.parse(c.options) : null
        }));
    }

    // New method to get ALL configs including deleted ones for rendering history
    getAllExerciseFieldConfigs() {
        const configs = this.db.prepare('SELECT * FROM exercise_field_config ORDER BY created_at ASC').all();
        return configs.map(c => ({
            ...c,
            options: c.options ? JSON.parse(c.options) : null
        }));
    }

    updateExerciseFieldConfig(key, data) {
        const stmt = this.db.prepare(`
            UPDATE exercise_field_config 
            SET label = @label, type = @type, is_active = @is_active, 
                is_mandatory_in_template = @is_mandatory_in_template, options = @options
            WHERE field_key = @field_key
        `);
        stmt.run({
            label: data.label,
            type: data.type || 'text',
            is_active: data.is_active ? 1 : 0,
            is_mandatory_in_template: data.is_mandatory_in_template ? 1 : 0,
            options: data.options ? JSON.stringify(data.options) : null,
            field_key: key
        });
        return { success: true };
    }

    addFieldConfig(label, type, options = null) {
        const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const gymId = this.getGymId();
        const stmt = this.db.prepare(`
            INSERT INTO exercise_field_config (gym_id, field_key, label, type, options, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `);
        stmt.run(gymId, key, label, type || 'text', options ? JSON.stringify(options) : null);
        return { success: true, key };
    }

    deleteFieldConfig(key) {
        const transaction = this.db.transaction(() => {
            // 1. Mark field config as deleted
            this.db.prepare('UPDATE exercise_field_config SET is_deleted = 1, is_active = 0 WHERE field_key = ?').run(key);

            // 2. Remove field from exercises.custom_fields JSON
            const exercises = this.db.prepare("SELECT id, custom_fields FROM exercises WHERE custom_fields IS NOT NULL AND custom_fields != '{}'").all();
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

            // 3. Remove field from routine_items.custom_fields JSON
            const items = this.db.prepare("SELECT id, custom_fields FROM routine_items WHERE custom_fields IS NOT NULL AND custom_fields != '{}'").all();
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
}

module.exports = new TrainingService();
