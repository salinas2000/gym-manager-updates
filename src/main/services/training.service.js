const dbManager = require('../db/database');

class TrainingService {
    get db() {
        return dbManager.getInstance();
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
        return this.db.prepare(query).all(...params);
    }

    createExercise(data) {
        const stmt = this.db.prepare(`
            INSERT INTO exercises (name, subcategory_id, video_url, default_sets, default_reps, is_failure, default_intensity) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            data.name,
            data.subcategoryId,
            data.video_url,
            data.default_sets || 4,
            data.default_reps || '',
            data.is_failure ? 1 : 0,
            data.default_intensity || ''
        );
        return { id: info.lastInsertRowid, ...data };
    }

    updateExercise(id, data) {
        console.log('[TrainingService] updateExercise:', id, data);
        const stmt = this.db.prepare(`
            UPDATE exercises 
            SET name = ?, subcategory_id = ?, video_url = ?, default_sets = ?, default_reps = ?, is_failure = ?, default_intensity = ?
            WHERE id = ?
        `);
        const info = stmt.run(
            data.name,
            data.subcategoryId,
            data.video_url,
            data.default_sets,
            data.default_reps,
            data.is_failure ? 1 : 0,
            data.default_intensity,
            id
        );
        console.log('[TrainingService] update info:', info);
        return { id, ...data };
    }

    deleteExercise(id) {
        // ... (keep existing) ...
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
        const stmt = this.db.prepare('INSERT INTO exercise_categories (name, icon) VALUES (?, ?)');
        const info = stmt.run(data.name, data.icon);
        return { id: info.lastInsertRowid, ...data, is_system: false, subcategories: [] };
    }

    updateCategory(id, data) {
        // Prevent changing is_system
        const stmt = this.db.prepare('UPDATE exercise_categories SET name = ?, icon = ? WHERE id = ?');
        stmt.run(data.name, data.icon, id);
        return { id, ...data };
    }

    createSubcategory(data) {
        const stmt = this.db.prepare('INSERT INTO exercise_subcategories (category_id, name) VALUES (?, ?)');
        const info = stmt.run(data.categoryId, data.name);
        return { id: info.lastInsertRowid, category_id: data.categoryId, name: data.name };
    }

    updateSubcategory(id, name) {
        const stmt = this.db.prepare('UPDATE exercise_subcategories SET name = ? WHERE id = ?');
        stmt.run(name, id);
        return { id, name };
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
            const startStr = m.start_date.split('T')[0];
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
        const routines = this.db.prepare('SELECT * FROM routines WHERE mesocycle_id = ? ORDER BY id ASC').all(mesocycleId);
        return routines.map(r => ({
            ...r,
            items: this.db.prepare(`
                SELECT ri.*, e.name as exercise_name, e.category 
                FROM routine_items ri
                LEFT JOIN exercises e ON ri.exercise_id = e.id
                WHERE ri.routine_id = ?
                ORDER BY ri.order_index ASC
             `).all(r.id)
        }));
    }

    checkMesocycleOverlap(customerId, startDate, endDate, excludeId = null) {
        // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
        if (!customerId) return { hasOverlap: false }; // Templates don't overlap

        let query = `
            SELECT id FROM mesocycles
            WHERE customer_id = ?
            AND active = 1
            AND (
                (start_date <= ? AND (end_date >= ? OR end_date IS NULL))
            )
        `;
        console.log('[checkMesocycleOverlap] Checking:', { customerId, startDate, endDate, excludeId });
        const params = [customerId, endDate || '9999-12-31', startDate];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const conflict = this.db.prepare(query).get(...params);
        console.log('[checkMesocycleOverlap] Result:', conflict);
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
        // Normalize Inputs (Handle varying case from Frontend vs DB)
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
        const insertMeso = this.db.prepare(`
            INSERT INTO mesocycles (customer_id, name, start_date, end_date, notes, active, is_template, days_per_week)
            VALUES (@customerId, @name, @startDate, @endDate, @notes, 1, @isTemplate, @daysPerWeek)
        `);

        const updateMeso = this.db.prepare(`
            UPDATE mesocycles 
            SET name = @name, start_date = @startDate, end_date = @endDate, notes = @notes, active = 1, is_template = @isTemplate, days_per_week = @daysPerWeek
            WHERE id = @id
        `);

        // Routines & Items
        const deleteRoutines = this.db.prepare('DELETE FROM routines WHERE mesocycle_id = ?');

        const insertRoutine = this.db.prepare(`
           INSERT INTO routines (mesocycle_id, name, day_group, notes)
           VALUES (@mesocycleId, @name, @dayGroup, @notes) 
        `);

        const insertItem = this.db.prepare(`
            INSERT INTO routine_items (routine_id, exercise_id, series, reps, rpe, notes, order_index, intensity)
            VALUES (@routineId, @exerciseId, @series, @reps, @rpe, @notes, @orderIndex, @intensity)
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
                                routineId,
                                exerciseId: item.exerciseId || item.exercise_id, // Flexible ID source
                                series: item.series,
                                reps: item.reps,
                                rpe: item.rpe || '',
                                notes: item.notes || '',
                                orderIndex: order++,
                                intensity: item.intensity || ''
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
        const db = require('../db/database').getInstance();
        const stmt = db.prepare('INSERT INTO file_history (customer_id, file_name, public_url) VALUES (?, ?, ?)');
        stmt.run(customerId, fileName, publicUrl);
    }

    updateMesocycleLink(mesoId, publicUrl) {
        const db = require('../db/database').getInstance();
        const stmt = db.prepare('UPDATE mesocycles SET drive_link = ? WHERE id = ?');
        stmt.run(publicUrl, mesoId);
    }
}

module.exports = new TrainingService();
