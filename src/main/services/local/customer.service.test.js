/**
 * Tests for Customer Service
 * Core business logic testing
 */

const customerService = require('./customer.service');

// Mock dependencies
jest.mock('../../db/database');
jest.mock('./license.service');

describe('Customer Service', () => {
  let mockDb;

  beforeEach(() => {
    // Service is a singleton, use it directly

    // Create mock database
    mockDb = global.testUtils.createMockDb();

    // Mock dbManager
    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);

    // Mock license service
    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({
      gym_id: 'TEST_GYM_123'
    }));

    jest.clearAllMocks();
  });

  describe('getAll()', () => {
    test('should return all customers with tariff info', () => {
      const mockCustomers = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.com',
          tariff_name: 'Premium',
          tariff_amount: 50,
          latest_end_date: null
        },
        {
          id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@test.com',
          tariff_name: 'Basic',
          tariff_amount: 30,
          latest_end_date: null
        }
      ];

      mockDb.prepare().all.mockReturnValue(mockCustomers);

      const result = customerService.getAll();

      expect(result).toEqual(mockCustomers);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should handle empty customer list', () => {
      mockDb.prepare().all.mockReturnValue([]);

      const result = customerService.getAll();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getById()', () => {
    test('should return customer by id', () => {
      const mockCustomer = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com'
      };

      mockDb.prepare().get.mockReturnValue(mockCustomer);

      const result = customerService.getById(1);

      expect(result).toEqual(mockCustomer);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should return undefined for non-existent customer', () => {
      mockDb.prepare().get.mockReturnValue(undefined);

      const result = customerService.getById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('create()', () => {
    test('should create customer with valid data', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com',
        phone: '123456789',
        tariff_id: 1
      };

      mockDb.prepare().run.mockReturnValue({ lastInsertRowid: 1 });
      mockDb.transaction.mockImplementation((fn) => fn);

      const result = customerService.create(customerData);

      expect(result).toHaveProperty('id', 1);
      // prepare called for customer INSERT, membership INSERT
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should create customer without optional fields', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com'
      };

      mockDb.prepare().run.mockReturnValue({ lastInsertRowid: 1 });
      mockDb.transaction.mockImplementation((fn) => fn);

      const result = customerService.create(customerData);

      expect(result).toHaveProperty('id');
    });

    test('should reject invalid email', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'invalid-email'
      };

      expect(() => customerService.create(customerData)).toThrow();
    });

    test('should reject missing first_name', () => {
      const customerData = {
        last_name: 'Doe',
        email: 'john@test.com'
      };

      // Zod returns "Required" by default
      expect(() => customerService.create(customerData)).toThrow();
    });

    test('should reject missing last_name', () => {
      const customerData = {
        first_name: 'John',
        email: 'john@test.com'
      };

      // Zod returns "Required" by default
      expect(() => customerService.create(customerData)).toThrow();
    });

    test('should reject missing email', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe'
      };

      expect(() => customerService.create(customerData)).toThrow();
    });

    test('should handle duplicate email error', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'existing@test.com'
      };

      mockDb.prepare().run.mockImplementation(() => {
        const error = new Error('UNIQUE constraint failed');
        throw error;
      });
      mockDb.transaction.mockImplementation((fn) => fn);

      expect(() => customerService.create(customerData)).toThrow('Ya existe un cliente con ese email');
    });
  });

  describe('update()', () => {
    test('should update customer with valid data', () => {
      const updateData = {
        first_name: 'John Updated',
        email: 'john.updated@test.com'
      };

      const updatedCustomer = { id: 1, ...updateData };
      mockDb.prepare().run.mockReturnValue({ changes: 1 });
      mockDb.prepare().get.mockReturnValue(updatedCustomer);

      const result = customerService.update(1, updateData);

      expect(result).toHaveProperty('id', 1);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should update only provided fields', () => {
      const updateData = {
        first_name: 'John Updated'
      };

      const updatedCustomer = { id: 1, first_name: 'John Updated' };
      mockDb.prepare().run.mockReturnValue({ changes: 1 });
      mockDb.prepare().get.mockReturnValue(updatedCustomer);

      const result = customerService.update(1, updateData);

      expect(result).toBeDefined();
    });

    test('should reject invalid email on update', () => {
      const updateData = {
        email: 'invalid-email'
      };

      expect(() => customerService.update(1, updateData)).toThrow();
    });

    test('should handle empty update data', () => {
      const updateData = {};

      const existingCustomer = { id: 1, first_name: 'John', last_name: 'Doe' };
      mockDb.prepare().get.mockReturnValue(existingCustomer);

      const result = customerService.update(1, updateData);

      expect(result).toBeDefined();
    });
  });

  describe('delete()', () => {
    test('should delete customer by id', () => {
      mockDb.prepare().run.mockReturnValue({ changes: 1 });

      const result = customerService.delete(1);

      // Service returns the statement result object
      expect(result).toEqual({ changes: 1 });
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should return 0 changes if customer not found', () => {
      mockDb.prepare().run.mockReturnValue({ changes: 0 });

      const result = customerService.delete(999);

      expect(result).toEqual({ changes: 0 });
    });
  });

  describe('getGymId()', () => {
    test('should return gym_id from license service', () => {
      const result = customerService.getGymId();

      expect(result).toBe('TEST_GYM_123');
    });

    test('should return LOCAL_DEV if license service fails', () => {
      const licenseService = require('./license.service');
      licenseService.getLicenseData.mockImplementation(() => {
        throw new Error('License error');
      });

      const result = customerService.getGymId();

      expect(result).toBe('LOCAL_DEV');
    });

    test('should return LOCAL_DEV if no license data', () => {
      const licenseService = require('./license.service');
      licenseService.getLicenseData.mockReturnValue(null);

      const result = customerService.getGymId();

      expect(result).toBe('LOCAL_DEV');
    });
  });
});
