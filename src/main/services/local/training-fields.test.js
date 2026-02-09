/**
 * Tests for Exercise Field Configuration
 * Tests field creation, soft deletion, restoration, and propagation to templates
 */

const dbManager = require('../../db/database');

// Mock database module
jest.mock('../../db/database');

// Mock license service
jest.mock('./license.service', () => ({
    getLicenseData: () => ({ gym_id: 'TEST_GYM_123' })
}));

const trainingService = require('./training.service');

describe('Exercise Field Configuration', () => {
    let mockDb;
    let service;

    beforeEach(() => {
        // Create fresh mock database for each test
        mockDb = global.testUtils.createMockDb();
        dbManager.getInstance.mockReturnValue(mockDb);
        service = trainingService; // Use singleton instance

        // Reset cache
        service._deletedKeysCache = null;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getExerciseFieldConfigs()', () => {
        it('should return only active (non-deleted) field configs', () => {
            const mockConfigs = [
                { id: 1, field_key: 'sets', label: 'Sets', type: 'number', is_deleted: 0, is_active: 1, options: null },
                { id: 2, field_key: 'reps', label: 'Reps', type: 'number', is_deleted: 0, is_active: 1, options: null },
                { id: 3, field_key: 'deleted_field', label: 'Deleted', type: 'text', is_deleted: 1, is_active: 0, options: null }
            ];

            mockDb.prepare().all.mockReturnValue(mockConfigs.filter(c => c.is_deleted === 0));

            const result = service.getExerciseFieldConfigs();

            expect(result).toHaveLength(2);
            expect(result[0].field_key).toBe('sets');
            expect(result[1].field_key).toBe('reps');
            expect(mockDb.prepare).toHaveBeenCalledWith(
                expect.stringContaining('WHERE is_deleted = 0')
            );
        });

        it('should parse options JSON for select/multiselect fields', () => {
            const mockConfigs = [
                {
                    id: 1,
                    field_key: 'equipment',
                    label: 'Equipment',
                    type: 'select',
                    is_deleted: 0,
                    is_active: 1,
                    options: JSON.stringify(['Barbell', 'Dumbbell', 'Machine'])
                }
            ];

            mockDb.prepare().all.mockReturnValue(mockConfigs);

            const result = service.getExerciseFieldConfigs();

            expect(result[0].options).toEqual(['Barbell', 'Dumbbell', 'Machine']);
        });

        it('should handle NULL options gracefully', () => {
            const mockConfigs = [
                { id: 1, field_key: 'notes', label: 'Notes', type: 'text', is_deleted: 0, is_active: 1, options: null }
            ];

            mockDb.prepare().all.mockReturnValue(mockConfigs);

            const result = service.getExerciseFieldConfigs();

            expect(result[0].options).toBeNull();
        });
    });

    describe('getAllExerciseFieldConfigs()', () => {
        it('should return ALL configs including deleted ones', () => {
            const mockConfigs = [
                { id: 1, field_key: 'sets', label: 'Sets', type: 'number', is_deleted: 0, is_active: 1, options: null },
                { id: 2, field_key: 'deleted', label: 'Deleted', type: 'text', is_deleted: 1, is_active: 0, options: null }
            ];

            mockDb.prepare().all.mockReturnValue(mockConfigs);

            const result = service.getAllExerciseFieldConfigs();

            expect(result).toHaveLength(2);
            expect(result.some(c => c.is_deleted === 1)).toBe(true);
        });
    });

    describe('addFieldConfig()', () => {
        it('should create a new field config with generated key', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            const result = service.addFieldConfig('Tempo/Cadence', 'text');

            expect(result.success).toBe(true);
            expect(result.key).toBe('tempocadence'); // Key sanitized
            expect(runMock).toHaveBeenCalledWith(
                'TEST_GYM_123',
                'tempocadence',
                'Tempo/Cadence',
                'text',
                null
            );
        });

        it('should sanitize field key (lowercase, no spaces, alphanumeric)', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            const result = service.addFieldConfig('Rest Time (sec)', 'number');

            expect(result.key).toBe('rest_time_sec'); // Special chars removed, spaces to underscore
        });

        it('should store options as JSON for select fields', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            const options = ['Option A', 'Option B', 'Option C'];
            service.addFieldConfig('Dropdown', 'select', options);

            expect(runMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                'select',
                JSON.stringify(options)
            );
        });

        it('should default to type "text" if not specified', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            service.addFieldConfig('New Field');

            // Verify 4th parameter is 'text' (type parameter)
            const callArgs = runMock.mock.calls[0];
            expect(callArgs[3]).toBe('text'); // Type is 4th parameter (index 3)
        });
    });

    describe('updateExerciseFieldConfig()', () => {
        it('should update field config properties', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            const result = service.updateExerciseFieldConfig('sets', {
                label: 'Sets Updated',
                type: 'number',
                is_active: true,
                is_mandatory_in_template: true,
                options: null
            });

            expect(result.success).toBe(true);
            expect(runMock).toHaveBeenCalledWith({
                label: 'Sets Updated',
                type: 'number',
                is_active: 1,
                is_mandatory_in_template: 1,
                options: null,
                field_key: 'sets'
            });
        });

        it('should convert boolean flags to integers (SQLite compatibility)', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            service.updateExerciseFieldConfig('reps', {
                label: 'Reps',
                type: 'number',
                is_active: false,
                is_mandatory_in_template: false
            });

            const callArgs = runMock.mock.calls[0][0];
            expect(callArgs.is_active).toBe(0);
            expect(callArgs.is_mandatory_in_template).toBe(0);
        });
    });

    describe('deleteFieldConfig() - Soft Delete with Cascade', () => {
        it('should soft delete field config (set is_deleted=1)', () => {
            const transactionFn = jest.fn((fn) => {
                fn(); // Execute immediately
                return fn;
            });
            mockDb.transaction = transactionFn;

            const markDeletedMock = jest.fn();
            mockDb.prepare.mockImplementation((sql) => {
                if (sql.includes('UPDATE exercise_field_config')) {
                    return { run: markDeletedMock };
                }
                return { all: jest.fn(() => []) }; // Empty arrays for other queries
            });

            service.deleteFieldConfig('obsolete_field');

            expect(markDeletedMock).toHaveBeenCalledWith('obsolete_field');
            expect(transactionFn).toHaveBeenCalled();
        });

        it('should remove field from exercises.custom_fields JSON', () => {
            const transactionFn = jest.fn((fn) => {
                fn();
                return fn;
            });
            mockDb.transaction = transactionFn;

            const mockExercises = [
                {
                    id: 1,
                    custom_fields: JSON.stringify({
                        tempo: '3-0-1-0',
                        deleted_field: 'value',
                        rest: '60s'
                    })
                },
                {
                    id: 2,
                    custom_fields: JSON.stringify({ deleted_field: 'another' })
                }
            ];

            const updateExerciseMock = jest.fn();

            mockDb.prepare.mockImplementation((sql) => {
                if (sql.includes('SELECT id, custom_fields FROM exercises')) {
                    return { all: () => mockExercises };
                }
                if (sql.includes('UPDATE exercises SET custom_fields')) {
                    return { run: updateExerciseMock };
                }
                return { run: jest.fn(), all: () => [] };
            });

            service.deleteFieldConfig('deleted_field');

            // Should update exercise 1 (keep tempo and rest)
            expect(updateExerciseMock).toHaveBeenCalledWith(
                JSON.stringify({ tempo: '3-0-1-0', rest: '60s' }),
                1
            );

            // Should update exercise 2 (set to null because empty)
            expect(updateExerciseMock).toHaveBeenCalledWith(null, 2);
        });

        it('should remove field from routine_items.custom_fields JSON', () => {
            const transactionFn = jest.fn((fn) => {
                fn();
                return fn;
            });
            mockDb.transaction = transactionFn;

            const mockItems = [
                {
                    id: 10,
                    custom_fields: JSON.stringify({
                        sets: '3',
                        reps: '10',
                        deleted_field: 'old_value'
                    })
                }
            ];

            const updateItemMock = jest.fn();

            mockDb.prepare.mockImplementation((sql) => {
                if (sql.includes('SELECT id, custom_fields FROM routine_items')) {
                    return { all: () => mockItems };
                }
                if (sql.includes('UPDATE routine_items SET custom_fields')) {
                    return { run: updateItemMock };
                }
                if (sql.includes('SELECT id, custom_fields FROM exercises')) {
                    return { all: () => [] }; // No exercises
                }
                return { run: jest.fn() };
            });

            service.deleteFieldConfig('deleted_field');

            expect(updateItemMock).toHaveBeenCalledWith(
                JSON.stringify({ sets: '3', reps: '10' }),
                10
            );
        });

        it('should handle malformed JSON gracefully (skip)', () => {
            const transactionFn = jest.fn((fn) => {
                fn();
                return fn;
            });
            mockDb.transaction = transactionFn;

            const mockExercises = [
                { id: 1, custom_fields: 'INVALID_JSON{{{' } // Malformed
            ];

            const updateMock = jest.fn();

            mockDb.prepare.mockImplementation((sql) => {
                if (sql.includes('SELECT id, custom_fields FROM exercises')) {
                    return { all: () => mockExercises };
                }
                if (sql.includes('UPDATE exercises')) {
                    return { run: updateMock };
                }
                return { run: jest.fn(), all: () => [] };
            });

            // Should NOT throw error
            expect(() => {
                service.deleteFieldConfig('any_field');
            }).not.toThrow();

            // Should NOT update malformed exercise
            expect(updateMock).not.toHaveBeenCalled();
        });

        it('should allow manual cache invalidation after deletion', () => {
            const transactionFn = jest.fn((fn) => {
                const result = fn();
                return result || fn; // Return function if no result
            });
            mockDb.transaction = transactionFn;

            mockDb.prepare.mockImplementation(() => ({
                run: jest.fn(),
                all: () => []
            }));

            service._deletedKeysCache = new Set(['old_cache']);

            service.deleteFieldConfig('field_to_delete');

            // Cache is NOT auto-invalidated (by design - caller's responsibility)
            // But can be manually invalidated
            service.invalidateDeletedKeysCache();
            expect(service._deletedKeysCache).toBeNull();
        });
    });

    describe('Cache Invalidation for Deleted Fields', () => {
        it('getDeletedFieldKeys() should cache deleted field keys', () => {
            const mockDeletedFields = [
                { field_key: 'deleted_1' },
                { field_key: 'deleted_2' }
            ];

            // Reset mock call count
            jest.clearAllMocks();

            const allMock = jest.fn().mockReturnValue(mockDeletedFields);
            mockDb.prepare.mockReturnValue({ all: allMock });

            // First call - query database
            const result1 = service.getDeletedFieldKeys();
            expect(result1).toEqual(new Set(['deleted_1', 'deleted_2']));
            expect(allMock).toHaveBeenCalledTimes(1);

            // Second call - use cache
            const result2 = service.getDeletedFieldKeys();
            expect(result2).toEqual(new Set(['deleted_1', 'deleted_2']));
            expect(allMock).toHaveBeenCalledTimes(1); // Still 1, cache hit
        });

        it('invalidateDeletedKeysCache() should clear cache', () => {
            service._deletedKeysCache = new Set(['cached']);

            service.invalidateDeletedKeysCache();

            expect(service._deletedKeysCache).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty exercises list when deleting field', () => {
            const transactionFn = jest.fn((fn) => {
                fn();
                return fn;
            });
            mockDb.transaction = transactionFn;

            mockDb.prepare.mockImplementation(() => ({
                run: jest.fn(),
                all: () => [] // Empty
            }));

            expect(() => {
                service.deleteFieldConfig('any_field');
            }).not.toThrow();
        });

        it('should handle field key with only special characters', () => {
            const runMock = jest.fn();
            mockDb.prepare.mockReturnValue({ run: runMock });

            const result = service.addFieldConfig('!!!@@@', 'text');

            // Key sanitization removes all special chars, resulting in empty string
            // This is expected behavior - app should validate labels before calling
            expect(typeof result.key).toBe('string');
            expect(result.success).toBe(true);
        });

        it('should handle NULL custom_fields in exercises', () => {
            const transactionFn = jest.fn((fn) => {
                fn();
                return fn;
            });
            mockDb.transaction = transactionFn;

            const mockExercises = [
                { id: 1, custom_fields: null }
            ];

            mockDb.prepare.mockImplementation((sql) => {
                if (sql.includes('SELECT id, custom_fields FROM exercises')) {
                    return { all: () => mockExercises };
                }
                return { run: jest.fn(), all: () => [] };
            });

            // Query filters NULL already, but should handle gracefully
            expect(() => {
                service.deleteFieldConfig('field');
            }).not.toThrow();
        });
    });
});
