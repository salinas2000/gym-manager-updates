/**
 * Settings Service Tests
 * Covers: getAll, get, set, updateSettings, setActivation
 */

const settingsService = require('./settings.service');

jest.mock('../../db/database');

describe('SettingsService', () => {
    let mockDb;
    let mockStatement;

    beforeEach(() => {
        mockStatement = {
            run: jest.fn().mockReturnValue({ changes: 1 }),
            get: jest.fn(),
            all: jest.fn().mockReturnValue([])
        };

        mockDb = {
            prepare: jest.fn().mockReturnValue(mockStatement),
            transaction: jest.fn((fn) => (...args) => fn(...args))
        };

        const dbManager = require('../../db/database');
        dbManager.getInstance = jest.fn(() => mockDb);

        jest.clearAllMocks();
        // Re-assign after clearAllMocks
        dbManager.getInstance = jest.fn(() => mockDb);
    });

    describe('getAll()', () => {
        test('should return all settings as key-value object', () => {
            mockStatement.all.mockReturnValue([
                { key: 'gym_name', value: 'Mi Gym' },
                { key: 'theme', value: 'dark' }
            ]);

            const result = settingsService.getAll();
            expect(result).toEqual({ gym_name: 'Mi Gym', theme: 'dark' });
        });

        test('should return empty object if no settings', () => {
            mockStatement.all.mockReturnValue([]);
            const result = settingsService.getAll();
            expect(result).toEqual({});
        });
    });

    describe('get()', () => {
        test('should return value for existing key', () => {
            mockStatement.get.mockReturnValue({ value: 'Mi Gym' });
            const result = settingsService.get('gym_name');
            expect(result).toBe('Mi Gym');
        });

        test('should return default value for missing key', () => {
            mockStatement.get.mockReturnValue(undefined);
            const result = settingsService.get('nonexistent', 'default');
            expect(result).toBe('default');
        });

        test('should return null as default when not specified', () => {
            mockStatement.get.mockReturnValue(undefined);
            const result = settingsService.get('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('set()', () => {
        test('should upsert setting', () => {
            const result = settingsService.set('gym_name', 'Nuevo Gym');
            expect(result).toEqual({ key: 'gym_name', value: 'Nuevo Gym' });
            expect(mockStatement.run).toHaveBeenCalledWith('gym_name', 'Nuevo Gym');
        });
    });

    describe('updateSettings()', () => {
        test('should bulk update multiple settings', () => {
            mockStatement.all.mockReturnValue([
                { key: 'a', value: '1' },
                { key: 'b', value: '2' }
            ]);

            const result = settingsService.updateSettings({ a: '1', b: '2' });
            expect(result).toEqual({ a: '1', b: '2' });
            expect(mockStatement.run.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        test('should handle empty settings object', () => {
            mockStatement.all.mockReturnValue([]);
            const result = settingsService.updateSettings({});
            expect(result).toEqual({});
        });
    });

    describe('setActivation()', () => {
        test('should activate with valid key', () => {
            const result = settingsService.setActivation('VALID-KEY-12345');
            expect(result).toBe(true);
        });

        test('should reject empty key', () => {
            expect(() => settingsService.setActivation('')).toThrow('Licencia inválida');
        });

        test('should reject null key', () => {
            expect(() => settingsService.setActivation(null)).toThrow('Licencia inválida');
        });

        test('should reject short key', () => {
            expect(() => settingsService.setActivation('ABC')).toThrow('Licencia inválida');
        });
    });
});
