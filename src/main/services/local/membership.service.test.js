/**
 * Tests for Membership Service
 */

const membershipService = require('./membership.service');

jest.mock('../../db/database');

describe('Membership Service', () => {
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
      transaction: jest.fn((fn) => (...args) => fn(...args)),
      close: jest.fn()
    };

    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);

    jest.clearAllMocks();
  });

  describe('update()', () => {
    test('should update membership dates', () => {
      mockStatement.get.mockReturnValue({ customer_id: 10 });

      const result = membershipService.update(1, {
        start_date: '2026-01-01',
        end_date: '2026-12-31'
      });

      expect(result).toEqual({
        id: 1,
        start_date: '2026-01-01',
        end_date: '2026-12-31'
      });
    });

    test('should convert empty end_date to null', () => {
      mockStatement.get.mockReturnValue({ customer_id: 10 });

      const result = membershipService.update(1, {
        start_date: '2026-01-01',
        end_date: ''
      });

      expect(result.end_date).toBeNull();
    });

    test('should convert null end_date to null', () => {
      mockStatement.get.mockReturnValue({ customer_id: 10 });

      const result = membershipService.update(1, {
        start_date: '2026-01-01',
        end_date: null
      });

      expect(result.end_date).toBeNull();
    });

    test('should recalculate customer status after update', () => {
      mockStatement.get
        .mockReturnValueOnce({ customer_id: 10 }) // membership lookup
        .mockReturnValueOnce({ id: 5 }); // active membership found

      membershipService.update(1, {
        start_date: '2026-01-01',
        end_date: '2026-12-31'
      });

      // Should have called prepare for: UPDATE memberships, SELECT customer_id,
      // SELECT activeMembership, UPDATE customers
      expect(mockDb.prepare).toHaveBeenCalledTimes(4);
    });

    test('should reject missing start_date', () => {
      expect(() => membershipService.update(1, { end_date: '2026-12-31' })).toThrow();
    });

    test('should reject empty start_date', () => {
      expect(() => membershipService.update(1, { start_date: '', end_date: null })).toThrow();
    });
  });

  describe('delete()', () => {
    test('should delete membership and cascade payments with end_date', () => {
      mockStatement.get
        .mockReturnValueOnce({ id: 1, customer_id: 10, start_date: '2026-01-01', end_date: '2026-06-30' }) // membership
        .mockReturnValueOnce(null); // no active membership after delete

      const result = membershipService.delete(1);
      expect(result).toBe(true);
    });

    test('should delete payments from start_date onwards if no end_date', () => {
      const prepareCalls = [];
      mockDb.prepare.mockImplementation((sql) => {
        prepareCalls.push(sql.trim());
        return mockStatement;
      });

      mockStatement.get
        .mockReturnValueOnce({ id: 1, customer_id: 10, start_date: '2026-01-01', end_date: null })
        .mockReturnValueOnce(null);

      membershipService.delete(1);

      const deletePaymentsSql = prepareCalls.find(s => s.includes('DELETE FROM payments'));
      expect(deletePaymentsSql).toBeDefined();
      expect(deletePaymentsSql).not.toContain('AND payment_date <=');
    });

    test('should return false if membership not found', () => {
      mockStatement.get.mockReturnValue(undefined);
      const result = membershipService.delete(999);
      expect(result).toBe(false);
    });
  });

  describe('recalculateCustomerStatus()', () => {
    test('should set customer active if open membership exists', () => {
      mockStatement.get.mockReturnValue({ id: 5 }); // active membership found

      const status = membershipService.recalculateCustomerStatus(10);
      expect(status).toBe(1);
    });

    test('should set customer inactive if no active membership', () => {
      mockStatement.get.mockReturnValue(undefined); // no active membership

      const status = membershipService.recalculateCustomerStatus(10);
      expect(status).toBe(0);
    });

    test('should update customers table with new status', () => {
      mockStatement.get.mockReturnValue(null);

      membershipService.recalculateCustomerStatus(10);

      // Second prepare call should be the UPDATE customers
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    });
  });
});
