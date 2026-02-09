/**
 * Tests for Payment Service
 * Financial operations - critical accuracy required
 */

const paymentService = require('./payment.service');

jest.mock('../../db/database');
jest.mock('./license.service');

describe('Payment Service', () => {
  let mockDb;

  beforeEach(() => {
    // Service is a singleton, use it directly
    mockDb = global.testUtils.createMockDb();

    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);

    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({
      gym_id: 'TEST_GYM_123'
    }));

    jest.clearAllMocks();
  });

  describe('create()', () => {
    test('should create payment with valid data', () => {
      const paymentData = {
        customer_id: 1,
        amount: 50,
        payment_date: '2026-01-01'
      };

      mockDb.prepare().run.mockReturnValue({ lastInsertRowid: 1 });

      const result = paymentService.create(paymentData);

      expect(result).toHaveProperty('id', 1);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should create payment without date (use current)', () => {
      const paymentData = {
        customer_id: 1,
        amount: 50
      };

      mockDb.prepare().run.mockReturnValue({ lastInsertRowid: 1 });

      const result = paymentService.create(paymentData);

      expect(result).toBeDefined();
    });

    test('should reject negative amount', () => {
      const paymentData = {
        customer_id: 1,
        amount: -50
      };

      expect(() => paymentService.create(paymentData)).toThrow();
    });

    test('should reject zero amount', () => {
      const paymentData = {
        customer_id: 1,
        amount: 0
      };

      expect(() => paymentService.create(paymentData)).toThrow();
    });

    test('should reject missing customer_id', () => {
      const paymentData = {
        amount: 50
      };

      expect(() => paymentService.create(paymentData)).toThrow();
    });
  });

  describe('getByCustomer()', () => {
    test('should return payments for specific customer', () => {
      const mockPayments = [
        { id: 1, customer_id: 1, amount: 50 },
        { id: 2, customer_id: 1, amount: 60 }
      ];

      mockDb.prepare().all.mockReturnValue(mockPayments);

      const result = paymentService.getByCustomer(1);

      expect(result).toEqual(mockPayments);
      expect(result).toHaveLength(2);
    });

    test('should return empty array if no payments', () => {
      mockDb.prepare().all.mockReturnValue([]);

      const result = paymentService.getByCustomer(999);

      expect(result).toEqual([]);
    });
  });

  describe('delete()', () => {
    test('should delete payment by id', () => {
      mockDb.prepare().run.mockReturnValue({ changes: 1 });

      const result = paymentService.delete(1);

      expect(result).toBe(true);
    });

    test('should return false if payment not found', () => {
      mockDb.prepare().run.mockReturnValue({ changes: 0 });

      const result = paymentService.delete(999);

      expect(result).toBe(false);
    });
  });
});
