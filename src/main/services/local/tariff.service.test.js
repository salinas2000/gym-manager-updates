/**
 * Tests for Tariff Service
 */

const tariffService = require('./tariff.service');

jest.mock('../../db/database');
jest.mock('./license.service');

describe('Tariff Service', () => {
  let mockDb;
  let mockStatement;

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
      transaction: jest.fn((fn) => fn),
      close: jest.fn()
    };

    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);

    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({ gym_id: 'TEST_GYM' }));

    jest.clearAllMocks();
  });

  describe('getAll()', () => {
    test('should return all tariffs', () => {
      const mockTariffs = [
        { id: 1, name: 'Basic', amount: 30, color_theme: 'emerald' },
        { id: 2, name: 'Premium', amount: 50, color_theme: 'blue' }
      ];
      mockStatement.all.mockReturnValue(mockTariffs);

      const result = tariffService.getAll();

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM tariffs');
      expect(result).toEqual(mockTariffs);
    });

    test('should return empty array if no tariffs', () => {
      mockStatement.all.mockReturnValue([]);
      const result = tariffService.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('create()', () => {
    test('should create tariff with valid data', () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 5 });

      const result = tariffService.create({ name: 'Gold', amount: 45 });

      expect(result).toEqual({
        id: 5,
        name: 'Gold',
        amount: 45,
        color_theme: 'emerald'
      });
    });

    test('should use provided color_theme', () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 6 });

      const result = tariffService.create({ name: 'Silver', amount: 35, color_theme: 'blue' });

      expect(result.color_theme).toBe('blue');
    });

    test('should reject missing name', () => {
      expect(() => tariffService.create({ amount: 30 })).toThrow();
    });

    test('should reject negative amount', () => {
      expect(() => tariffService.create({ name: 'Bad', amount: -10 })).toThrow();
    });

    test('should reject zero amount', () => {
      expect(() => tariffService.create({ name: 'Free', amount: 0 })).toThrow();
    });

    test('should reject missing amount', () => {
      expect(() => tariffService.create({ name: 'NoPrice' })).toThrow();
    });
  });

  describe('delete()', () => {
    test('should nullify customers tariff_id before deleting', () => {
      const prepareCalls = [];
      mockDb.prepare.mockImplementation((sql) => {
        prepareCalls.push(sql);
        return mockStatement;
      });

      tariffService.delete(3);

      expect(prepareCalls[0]).toMatch(/UPDATE customers SET tariff_id = NULL/);
      expect(prepareCalls[1]).toMatch(/DELETE FROM tariffs WHERE id/);
    });

    test('should return true if tariff was deleted', () => {
      mockStatement.run.mockReturnValue({ changes: 1 });
      expect(tariffService.delete(1)).toBe(true);
    });

    test('should return false if tariff not found', () => {
      mockStatement.run.mockReturnValueOnce({ changes: 0 }); // customers update
      mockStatement.run.mockReturnValueOnce({ changes: 0 }); // tariff delete
      expect(tariffService.delete(999)).toBe(false);
    });
  });

  describe('update()', () => {
    test('should update tariff name', () => {
      const result = tariffService.update(1, { name: 'Updated' });
      expect(result).toEqual({ id: 1, name: 'Updated' });
    });

    test('should update tariff amount', () => {
      const result = tariffService.update(1, { amount: 55 });
      expect(result).toEqual({ id: 1, amount: 55 });
    });

    test('should update multiple fields', () => {
      const result = tariffService.update(1, { name: 'Premium+', amount: 75, color_theme: 'gold' });
      expect(result.name).toBe('Premium+');
      expect(result.amount).toBe(75);
      expect(result.color_theme).toBe('gold');
    });

    test('should reset sync status on update', () => {
      let executedSql = '';
      mockDb.prepare.mockImplementation((sql) => {
        executedSql = sql;
        return mockStatement;
      });

      tariffService.update(1, { name: 'Test' });
      expect(executedSql).toContain('synced = 0');
    });

    test('should still update sync fields for empty data', () => {
      let executedSql = '';
      mockDb.prepare.mockImplementation((sql) => {
        executedSql = sql;
        return mockStatement;
      });

      const result = tariffService.update(1, {});
      // Even with no user fields, synced and updated_at are always set
      expect(executedSql).toContain('synced = 0');
    });
  });
});
