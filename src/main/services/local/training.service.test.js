/**
 * Training Service Tests
 * Covers: exercises, categories, subcategories, mesocycles, field configs, deletes
 */

jest.mock('../../db/database');
jest.mock('./license.service');

const trainingService = require('./training.service');

let mockStatement;
let mockDb;

beforeEach(() => {
    mockStatement = {
        run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        get: jest.fn(),
        all: jest.fn().mockReturnValue([])
    };

    mockDb = {
        prepare: jest.fn().mockReturnValue(mockStatement),
        exec: jest.fn(),
        pragma: jest.fn(),
        transaction: jest.fn((fn) => (...args) => fn(...args)),
        close: jest.fn()
    };

    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);

    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({ gym_id: 'TEST_GYM' }));

    jest.clearAllMocks();
    // Re-assign after clearAllMocks
    dbManager.getInstance = jest.fn(() => mockDb);
    licenseService.getLicenseData = jest.fn(() => ({ gym_id: 'TEST_GYM' }));

    // Reset deleted keys cache
    trainingService._deletedKeysCache = null;
});

// ============================================================
// EXERCISES
// ============================================================
describe('TrainingService - Exercises', () => {
    describe('getExercises()', () => {
        test('should return all exercises with parsed custom_fields', () => {
            mockStatement.all.mockReturnValue([
                { id: 1, name: 'Bench Press', custom_fields: '{"rpe":"8"}', subcategory_name: 'Pecho' },
                { id: 2, name: 'Squat', custom_fields: null, subcategory_name: 'Pierna' }
            ]);

            const result = trainingService.getExercises();

            expect(result).toHaveLength(2);
            expect(result[0].custom_fields).toEqual({ rpe: '8' });
            expect(result[1].custom_fields).toEqual({});
        });

        test('should filter by search term', () => {
            mockStatement.all.mockReturnValue([]);
            trainingService.getExercises({ search: 'bench' });

            // Find the prepare call that contains LIKE
            const likeCall = mockDb.prepare.mock.calls.find(c => c[0].includes('LIKE'));
            expect(likeCall).toBeDefined();
        });

        test('should handle malformed JSON in custom_fields gracefully', () => {
            mockStatement.all.mockReturnValue([
                { id: 1, name: 'Test', custom_fields: '{invalid json}' }
            ]);

            const result = trainingService.getExercises();
            expect(result[0].custom_fields).toEqual({});
        });

        test('should strip deleted field keys from results', () => {
            // Pre-populate cache with deleted key
            trainingService._deletedKeysCache = new Set(['tempo']);

            mockStatement.all.mockReturnValue([
                { id: 1, name: 'Bench', custom_fields: '{"rpe":"8","tempo":"3010"}' }
            ]);

            const result = trainingService.getExercises();
            expect(result[0].custom_fields).toEqual({ rpe: '8' });
            expect(result[0].custom_fields.tempo).toBeUndefined();
        });
    });

    describe('createExercise()', () => {
        test('should create exercise with valid data', () => {
            const data = { name: 'Bench Press', subcategoryId: 1, video_url: '' };
            const result = trainingService.createExercise(data);

            expect(mockStatement.run).toHaveBeenCalled();
            expect(result.id).toBe(1);
            expect(result.name).toBe('Bench Press');
        });

        test('should reject exercise without name', () => {
            expect(() => trainingService.createExercise({ name: '', subcategoryId: 1 }))
                .toThrow();
        });

        test('should reject exercise without subcategoryId', () => {
            expect(() => trainingService.createExercise({ name: 'Test', subcategoryId: -1 }))
                .toThrow();
        });
    });

    describe('updateExercise()', () => {
        test('should update exercise fields', () => {
            const result = trainingService.updateExercise(1, {
                name: 'Updated Name',
                subcategoryId: 2,
                video_url: 'https://youtube.com/watch?v=123'
            });

            expect(mockStatement.run).toHaveBeenCalled();
            expect(result.id).toBe(1);
        });
    });

    describe('deleteExercise()', () => {
        test('should delete exercise and cascade to routine_items', () => {
            mockStatement.get.mockReturnValue({ id: 1 }); // exercise exists

            const result = trainingService.deleteExercise(1);

            expect(result).toEqual({ success: true, id: 1 });
            // Should have called prepare for: SELECT, DELETE routine_items, DELETE exercises
            expect(mockDb.prepare).toHaveBeenCalledTimes(3);
        });

        test('should throw if exercise not found', () => {
            mockStatement.get.mockReturnValue(undefined);

            expect(() => trainingService.deleteExercise(999))
                .toThrow('Ejercicio no encontrado');
        });

        test('should throw if id is null/undefined', () => {
            expect(() => trainingService.deleteExercise(null))
                .toThrow('ID de ejercicio requerido');
            expect(() => trainingService.deleteExercise(undefined))
                .toThrow('ID de ejercicio requerido');
        });
    });
});

// ============================================================
// CATEGORIES & SUBCATEGORIES
// ============================================================
describe('TrainingService - Categories', () => {
    describe('getCategories()', () => {
        test('should return categories with subcategories', () => {
            mockStatement.all
                .mockReturnValueOnce([{ id: 1, name: 'Pecho', icon: 'dumbbell', is_system: 1 }])
                .mockReturnValueOnce([{ id: 10, name: 'Press', category_id: 1 }]);

            const result = trainingService.getCategories();

            expect(result).toHaveLength(1);
            expect(result[0].is_system).toBe(true);
            expect(result[0].subcategories).toHaveLength(1);
        });
    });

    describe('createCategory()', () => {
        test('should create category with valid data', () => {
            const result = trainingService.createCategory({ name: 'Pierna', icon: 'leg' });
            expect(result.name).toBe('Pierna');
            expect(result.is_system).toBe(false);
            expect(result.subcategories).toEqual([]);
        });

        test('should reject empty name', () => {
            expect(() => trainingService.createCategory({ name: '', icon: 'x' }))
                .toThrow();
        });

        test('should reject empty icon', () => {
            expect(() => trainingService.createCategory({ name: 'Test', icon: '' }))
                .toThrow();
        });
    });

    describe('deleteCategory()', () => {
        test('should delete existing category', () => {
            mockStatement.get.mockReturnValue({ id: 1 });
            trainingService.deleteCategory(1);
            expect(mockStatement.run).toHaveBeenCalled();
        });

        test('should throw if category not found', () => {
            mockStatement.get.mockReturnValue(undefined);
            expect(() => trainingService.deleteCategory(999))
                .toThrow('Categoría no encontrada');
        });

        test('should throw if id is null', () => {
            expect(() => trainingService.deleteCategory(null))
                .toThrow('ID de categoría requerido');
        });
    });

    describe('createSubcategory()', () => {
        test('should create subcategory', () => {
            const result = trainingService.createSubcategory({ categoryId: 1, name: 'Press' });
            expect(result.name).toBe('Press');
            expect(result.category_id).toBe(1);
        });

        test('should reject empty name', () => {
            expect(() => trainingService.createSubcategory({ categoryId: 1, name: '' }))
                .toThrow();
        });
    });

    describe('deleteSubcategory()', () => {
        test('should delete existing subcategory', () => {
            mockStatement.get.mockReturnValue({ id: 1 });
            trainingService.deleteSubcategory(1);
            expect(mockStatement.run).toHaveBeenCalled();
        });

        test('should throw if subcategory not found', () => {
            mockStatement.get.mockReturnValue(undefined);
            expect(() => trainingService.deleteSubcategory(999))
                .toThrow('Subcategoría no encontrada');
        });

        test('should throw if id is null', () => {
            expect(() => trainingService.deleteSubcategory(null))
                .toThrow('ID de subcategoría requerido');
        });
    });
});

// ============================================================
// MESOCYCLES
// ============================================================
describe('TrainingService - Mesocycles', () => {
    describe('getMesocycle()', () => {
        test('should return mesocycle with routines', () => {
            mockStatement.get.mockReturnValue({ id: 1, name: 'Week 1', customer_id: 10 });
            mockStatement.all.mockReturnValue([]); // deleted keys + routines

            const result = trainingService.getMesocycle(1);
            expect(result).not.toBeNull();
            expect(result.id).toBe(1);
            expect(result.routines).toBeDefined();
        });

        test('should return null if not found', () => {
            mockStatement.get.mockReturnValue(undefined);
            const result = trainingService.getMesocycle(999);
            expect(result).toBeNull();
        });
    });

    describe('getMesocyclesByCustomer()', () => {
        test('should return mesocycles with calculated status', () => {
            const today = new Date();
            const futureDate = new Date(today);
            futureDate.setDate(futureDate.getDate() + 30);

            mockStatement.all
                .mockReturnValueOnce([{
                    id: 1,
                    name: 'Plan A',
                    customer_id: 10,
                    active: 1,
                    is_template: 0,
                    start_date: today.toISOString(),
                    end_date: futureDate.toISOString()
                }]);

            const result = trainingService.getMesocyclesByCustomer(10);
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('active');
        });

        test('should handle null start_date gracefully', () => {
            mockStatement.all
                .mockReturnValueOnce([{
                    id: 1, name: 'Plan B', customer_id: 10,
                    active: 1, is_template: 0,
                    start_date: null, end_date: null
                }]);

            const result = trainingService.getMesocyclesByCustomer(10);
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('active');
        });

        test('should mark archived mesocycles', () => {
            mockStatement.all.mockReturnValueOnce([{
                id: 1, name: 'Old', customer_id: 10,
                active: 0, is_template: 0,
                start_date: '2024-01-01', end_date: '2024-02-01'
            }]);

            const result = trainingService.getMesocyclesByCustomer(10);
            expect(result[0].status).toBe('archived');
        });
    });

    describe('deleteMesocycle()', () => {
        test('should delete existing mesocycle', () => {
            mockStatement.get.mockReturnValue({ id: 1 });
            trainingService.deleteMesocycle(1);
            expect(mockStatement.run).toHaveBeenCalled();
        });

        test('should throw if mesocycle not found', () => {
            mockStatement.get.mockReturnValue(undefined);
            expect(() => trainingService.deleteMesocycle(999))
                .toThrow('Mesociclo no encontrado');
        });

        test('should throw if id is null', () => {
            expect(() => trainingService.deleteMesocycle(null))
                .toThrow('ID de mesociclo requerido');
        });
    });

    describe('checkMesocycleOverlap()', () => {
        test('should return no overlap for templates (no customerId)', () => {
            const result = trainingService.checkMesocycleOverlap(null, '2025-01-01', '2025-02-01');
            expect(result.hasOverlap).toBe(false);
        });

        test('should return no overlap when no start date', () => {
            const result = trainingService.checkMesocycleOverlap(1, null, '2025-02-01');
            expect(result.hasOverlap).toBe(false);
        });

        test('should detect overlap', () => {
            mockStatement.get.mockReturnValue({ id: 2 });
            const result = trainingService.checkMesocycleOverlap(1, '2025-01-01', '2025-02-01');
            expect(result.hasOverlap).toBe(true);
            expect(result.conflictId).toBe(2);
        });

        test('should return no overlap when none found', () => {
            mockStatement.get.mockReturnValue(undefined);
            const result = trainingService.checkMesocycleOverlap(1, '2025-01-01', '2025-02-01');
            expect(result.hasOverlap).toBe(false);
        });
    });

    describe('saveMesocycle()', () => {
        test('should create new mesocycle', () => {
            mockStatement.get.mockReturnValue(undefined); // no overlap
            mockStatement.run.mockReturnValue({ lastInsertRowid: 5, changes: 1 });

            const result = trainingService.saveMesocycle({
                name: 'Test Plan',
                startDate: '2025-03-01',
                endDate: '2025-04-01',
                routines: []
            });

            expect(result.success).toBe(true);
            expect(result.id).toBe(5);
        });

        test('should update existing mesocycle', () => {
            mockStatement.get.mockReturnValue(undefined); // no overlap

            const result = trainingService.saveMesocycle({
                id: 5,
                name: 'Updated Plan',
                startDate: '2025-03-01',
                endDate: '2025-04-01',
                routines: []
            });

            expect(result.success).toBe(true);
        });

        test('should throw on overlap (non-template)', () => {
            mockStatement.get.mockReturnValue({ id: 2 }); // overlap found

            expect(() => trainingService.saveMesocycle({
                customerId: 1,
                name: 'Overlap Plan',
                startDate: '2025-03-01',
                endDate: '2025-04-01',
                routines: []
            })).toThrow('Las fechas se solapan');
        });

        test('should allow overlap if allowOverlap is true', () => {
            mockStatement.get.mockReturnValue({ id: 2 }); // overlap found
            mockStatement.run.mockReturnValue({ lastInsertRowid: 6, changes: 1 });

            const result = trainingService.saveMesocycle({
                customerId: 1,
                name: 'Allowed Overlap',
                startDate: '2025-03-01',
                endDate: '2025-04-01',
                allowOverlap: true,
                routines: []
            });

            expect(result.success).toBe(true);
        });

        test('should reject mesocycle without name', () => {
            expect(() => trainingService.saveMesocycle({
                name: '',
                routines: []
            })).toThrow();
        });

        test('should save routines with items', () => {
            mockStatement.get.mockReturnValue(undefined);
            mockStatement.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 });

            trainingService.saveMesocycle({
                name: 'With Routines',
                startDate: '2025-03-01',
                routines: [{
                    name: 'Day 1',
                    dayGroup: 'A',
                    items: [{
                        exerciseId: 1,
                        series: '4',
                        reps: '10',
                        rpe: '8',
                        notes: ''
                    }]
                }]
            });

            // Should have called run multiple times: meso insert + routine insert + item insert
            expect(mockStatement.run.mock.calls.length).toBeGreaterThanOrEqual(3);
        });
    });
});

// ============================================================
// FIELD CONFIGS
// ============================================================
describe('TrainingService - Field Configs', () => {
    describe('getExerciseFieldConfigs()', () => {
        test('should return active configs with parsed options', () => {
            mockStatement.all.mockReturnValue([
                { field_key: 'rpe', label: 'RPE', type: 'number', options: '["1","2","3"]', is_deleted: 0 },
                { field_key: 'tempo', label: 'Tempo', type: 'text', options: null, is_deleted: 0 }
            ]);

            const result = trainingService.getExerciseFieldConfigs();
            expect(result).toHaveLength(2);
            expect(result[0].options).toEqual(['1', '2', '3']);
            expect(result[1].options).toBeNull();
        });
    });

    describe('addFieldConfig()', () => {
        test('should create field config with sanitized key', () => {
            const result = trainingService.addFieldConfig('My Custom Field', 'text');
            expect(result.success).toBe(true);
            expect(result.key).toBe('my_custom_field');
        });

        test('should strip special characters from key', () => {
            const result = trainingService.addFieldConfig('RPE (escala)', 'number');
            expect(result.key).toBe('rpe_escala');
        });
    });

    describe('deleteFieldConfig()', () => {
        test('should soft-delete and clean exercises/routine_items JSON', () => {
            // Mock exercises with the field
            mockStatement.all
                .mockReturnValueOnce([{ id: 1, custom_fields: '{"rpe":"8","tempo":"3010"}' }]) // exercises
                .mockReturnValueOnce([{ id: 10, custom_fields: '{"rpe":"7","tempo":"2010"}' }]); // routine_items

            trainingService.deleteFieldConfig('tempo');

            expect(mockStatement.run).toHaveBeenCalled();
        });

        test('should handle exercises with malformed JSON', () => {
            mockStatement.all
                .mockReturnValueOnce([{ id: 1, custom_fields: 'not valid json' }])
                .mockReturnValueOnce([]);

            // Should not throw
            expect(() => trainingService.deleteFieldConfig('rpe')).not.toThrow();
        });
    });

    describe('getDeletedFieldKeys()', () => {
        test('should cache deleted keys', () => {
            mockStatement.all.mockReturnValue([{ field_key: 'tempo' }]);

            // First call should query DB
            const result1 = trainingService.getDeletedFieldKeys();
            expect(result1).toBeInstanceOf(Set);
            expect(result1.has('tempo')).toBe(true);

            // Second call should use cache (prepare called only once)
            const result2 = trainingService.getDeletedFieldKeys();
            expect(result2).toBe(result1); // Same reference = cached
        });

        test('should invalidate cache', () => {
            mockStatement.all.mockReturnValue([{ field_key: 'tempo' }]);

            trainingService.getDeletedFieldKeys();
            trainingService.invalidateDeletedKeysCache();

            mockStatement.all.mockReturnValue([]);
            const result = trainingService.getDeletedFieldKeys();
            expect(result.size).toBe(0);
        });
    });
});

// ============================================================
// TEMPLATES
// ============================================================
describe('TrainingService - Templates', () => {
    describe('getTemplates()', () => {
        test('should return templates with routines', () => {
            mockStatement.all
                .mockReturnValueOnce([{ field_key: 'x' }]) // deleted keys (from getDeletedFieldKeys)
                .mockReturnValueOnce([{ id: 1, name: 'Template A', is_template: 1, days_per_week: 3 }]) // templates
                .mockReturnValueOnce([]); // routines for template

            // Need fresh instance to avoid cache
            trainingService._deletedKeysCache = null;
            const result = trainingService.getTemplates();
            expect(result).toHaveLength(1);
        });

        test('should filter by days_per_week', () => {
            mockStatement.all.mockReturnValue([]);
            trainingService.getTemplates(4);

            const calls = mockDb.prepare.mock.calls;
            const templateQuery = calls.find(c => c[0].includes('is_template'));
            expect(templateQuery[0]).toContain('days_per_week = ?');
        });
    });
});

// ============================================================
// PRIORITIES
// ============================================================
describe('TrainingService - Priorities', () => {
    describe('getTrainingPriorities()', () => {
        test('should return sorted priority list', () => {
            mockStatement.all.mockReturnValue([
                { id: 1, first_name: 'Ana', last_name: 'Lopez', plan_end_date: null },
                { id: 2, first_name: 'Luis', last_name: 'Garcia', plan_end_date: '2020-01-01' }
            ]);

            const result = trainingService.getTrainingPriorities();

            expect(result).toHaveLength(2);
            // Expired should come first, then none
            expect(result[0].status).toBe('expired');
            expect(result[1].status).toBe('none');
        });

        test('should handle empty customer list', () => {
            mockStatement.all.mockReturnValue([]);
            const result = trainingService.getTrainingPriorities();
            expect(result).toEqual([]);
        });
    });
});

// ============================================================
// FILE HISTORY
// ============================================================
describe('TrainingService - File History', () => {
    describe('saveFileHistory()', () => {
        test('should not throw if customerId is null', () => {
            expect(() => trainingService.saveFileHistory(null, 'file.xlsx', 'url'))
                .not.toThrow();
        });

        test('should not throw if fileName is null', () => {
            expect(() => trainingService.saveFileHistory(1, null, 'url'))
                .not.toThrow();
        });

        test('should save with gym_id', () => {
            trainingService.saveFileHistory(1, 'routine.xlsx', 'https://storage.com/file.xlsx');
            expect(mockStatement.run).toHaveBeenCalled();
        });
    });

    describe('updateMesocycleLink()', () => {
        test('should update drive_link on mesocycle', () => {
            trainingService.updateMesocycleLink(1, 'https://drive.google.com/file');
            expect(mockStatement.run).toHaveBeenCalledWith('https://drive.google.com/file', 1);
        });

        test('should clear drive_link when url is null', () => {
            trainingService.updateMesocycleLink(1, null);
            expect(mockStatement.run).toHaveBeenCalledWith(null, 1);
        });
    });
});
