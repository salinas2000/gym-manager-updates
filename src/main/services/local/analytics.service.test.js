/**
 * Tests for Analytics Service
 */

const analyticsService = require('./analytics.service');

jest.mock('../../db/database');
jest.mock('./license.service');

describe('Analytics Service', () => {
  let mockDb;
  let mockStatement;

  beforeEach(() => {
    mockStatement = {
      run: jest.fn().mockReturnValue({ changes: 1 }),
      get: jest.fn().mockReturnValue({ count: 0, total: 0, value: 0 }),
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

  describe('validateDateRange()', () => {
    test('should return parsed dates for valid range', () => {
      const result = analyticsService.validateDateRange('2026-01-01', '2026-12-31');
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });

    test('should throw for missing start date', () => {
      expect(() => analyticsService.validateDateRange(null, '2026-12-31')).toThrow('Start and end dates are required');
    });

    test('should throw for missing end date', () => {
      expect(() => analyticsService.validateDateRange('2026-01-01', null)).toThrow('Start and end dates are required');
    });

    test('should throw for invalid date format', () => {
      expect(() => analyticsService.validateDateRange('not-a-date', '2026-12-31')).toThrow('Invalid date format');
    });

    test('should throw when start > end', () => {
      expect(() => analyticsService.validateDateRange('2026-12-31', '2026-01-01')).toThrow('Start date must be before or equal to end date');
    });

    test('should accept same start and end date', () => {
      const result = analyticsService.validateDateRange('2026-06-15', '2026-06-15');
      expect(result.start.getTime()).toBe(result.end.getTime());
    });
  });

  describe('validateYear()', () => {
    test('should return valid year as number', () => {
      expect(analyticsService.validateYear(2026)).toBe(2026);
    });

    test('should convert string year to number', () => {
      expect(analyticsService.validateYear('2025')).toBe(2025);
    });

    test('should reject year below 2000', () => {
      expect(() => analyticsService.validateYear(1999)).toThrow('Invalid year');
    });

    test('should reject year above 2100', () => {
      expect(() => analyticsService.validateYear(2101)).toThrow('Invalid year');
    });

    test('should reject non-numeric year', () => {
      expect(() => analyticsService.validateYear('abc')).toThrow('Invalid year');
    });

    test('should accept boundary year 2000', () => {
      expect(analyticsService.validateYear(2000)).toBe(2000);
    });

    test('should accept boundary year 2100', () => {
      expect(analyticsService.validateYear(2100)).toBe(2100);
    });
  });

  describe('getRevenueHistory()', () => {
    test('should return 12 months of revenue data', () => {
      mockStatement.all.mockReturnValue([
        { month: '01', total: 1000 },
        { month: '06', total: 1500 }
      ]);

      const result = analyticsService.getRevenueHistory(2026);

      expect(result).toHaveLength(12);
      expect(result[0]).toEqual({ month: 'Jan', revenue: 1000 });
      expect(result[5]).toEqual({ month: 'Jun', revenue: 1500 });
      expect(result[2]).toEqual({ month: 'Mar', revenue: 0 });
    });

    test('should return zeros for year with no data', () => {
      mockStatement.all.mockReturnValue([]);

      const result = analyticsService.getRevenueHistory(2026);

      expect(result).toHaveLength(12);
      result.forEach(m => expect(m.revenue).toBe(0));
    });
  });

  describe('getActiveMembersHistory()', () => {
    test('should return 12 months of member counts', () => {
      mockStatement.get.mockReturnValue({ count: 15 });

      const result = analyticsService.getActiveMembersHistory(2026);

      expect(result).toHaveLength(12);
      expect(result[0].month).toBe('Jan');
      expect(result[0].members).toBe(15);
    });
  });

  describe('getTariffDistribution()', () => {
    test('should return tariff distribution', () => {
      const mockDist = [
        { name: 'Premium', color_theme: 'blue', value: 20 },
        { name: 'Basic', color_theme: 'emerald', value: 30 }
      ];
      mockStatement.all.mockReturnValue(mockDist);

      const result = analyticsService.getTariffDistribution();
      expect(result).toEqual(mockDist);
    });
  });

  describe('getTotalRevenue()', () => {
    test('should return total revenue for specific year', () => {
      mockStatement.get.mockReturnValue({ total: 50000 });

      const result = analyticsService.getTotalRevenue(2026);
      expect(result).toBe(50000);
    });

    test('should return all-time revenue when no year specified', () => {
      mockStatement.get.mockReturnValue({ total: 120000 });

      const result = analyticsService.getTotalRevenue();
      expect(result).toBe(120000);
    });

    test('should return 0 if no payments exist', () => {
      mockStatement.get.mockReturnValue({ total: null });

      const result = analyticsService.getTotalRevenue();
      expect(result).toBe(0);
    });
  });

  describe('getDebtorCount()', () => {
    test('should return count of debtors', () => {
      mockStatement.get.mockReturnValue({ count: 5 });

      const result = analyticsService.getDebtorCount();
      expect(result).toBe(5);
    });

    test('should return 0 if no debtors', () => {
      mockStatement.get.mockReturnValue({ count: 0 });

      const result = analyticsService.getDebtorCount();
      expect(result).toBe(0);
    });
  });

  describe('getActiveCount()', () => {
    test('should return count of active customers', () => {
      mockStatement.get.mockReturnValue({ count: 42 });

      const result = analyticsService.getActiveCount();
      expect(result).toBe(42);
    });
  });

  describe('getAvailableYears()', () => {
    test('should return years from payment data', () => {
      mockStatement.all.mockReturnValue([
        { year: '2026' }, { year: '2025' }
      ]);

      const result = analyticsService.getAvailableYears();
      expect(result).toContain('2026');
      expect(result).toContain('2025');
    });

    test('should include current year if not in data', () => {
      mockStatement.all.mockReturnValue([{ year: '2024' }]);

      const result = analyticsService.getAvailableYears();
      const currentYear = String(new Date().getFullYear());
      expect(result).toContain(currentYear);
    });

    test('should return current year even with no data', () => {
      mockStatement.all.mockReturnValue([]);

      const result = analyticsService.getAvailableYears();
      const currentYear = String(new Date().getFullYear());
      expect(result).toContain(currentYear);
    });
  });

  describe('getRecentTransactions()', () => {
    test('should return recent transactions with customer info', () => {
      const mockTx = [
        { id: 1, amount: 50, first_name: 'John', last_name: 'Doe' }
      ];
      mockStatement.all.mockReturnValue(mockTx);

      const result = analyticsService.getRecentTransactions(5);
      expect(result).toEqual(mockTx);
    });

    test('should use default limit of 5', () => {
      analyticsService.getRecentTransactions();
      expect(mockStatement.all).toHaveBeenCalledWith(5);
    });

    test('should accept custom limit', () => {
      analyticsService.getRecentTransactions(10);
      expect(mockStatement.all).toHaveBeenCalledWith(10);
    });
  });

  describe('getNewMembersHistory()', () => {
    test('should return 12 months of new member data', () => {
      mockStatement.all.mockReturnValue([
        { month: '03', count: 8 },
        { month: '09', count: 12 }
      ]);

      const result = analyticsService.getNewMembersHistory(2026);

      expect(result).toHaveLength(12);
      expect(result[2]).toEqual({ month: 'Mar', members: 8 });
      expect(result[8]).toEqual({ month: 'Sep', members: 12 });
      expect(result[0]).toEqual({ month: 'Jan', members: 0 });
    });
  });

  describe('getActiveCountForMonth()', () => {
    test('should query with correct date range', () => {
      mockStatement.get.mockReturnValue({ count: 25 });

      const result = analyticsService.getActiveCountForMonth(2026, 0); // January
      expect(result).toBe(25);
      expect(mockStatement.get).toHaveBeenCalledWith('2026-01-31', '2026-01-01');
    });

    test('should handle February correctly', () => {
      mockStatement.get.mockReturnValue({ count: 20 });

      analyticsService.getActiveCountForMonth(2026, 1); // February
      expect(mockStatement.get).toHaveBeenCalledWith('2026-02-28', '2026-02-01');
    });

    test('should handle leap year February', () => {
      mockStatement.get.mockReturnValue({ count: 20 });

      analyticsService.getActiveCountForMonth(2028, 1); // Feb 2028 is leap
      expect(mockStatement.get).toHaveBeenCalledWith('2028-02-29', '2028-02-01');
    });
  });

  describe('getInventoryDashboardData()', () => {
    test('should return complete dashboard data structure', () => {
      mockStatement.all.mockReturnValue([]);
      mockStatement.get.mockReturnValue({ count: 0, value: 0 });

      const result = analyticsService.getInventoryDashboardData(2026);

      expect(result).toHaveProperty('history');
      expect(result).toHaveProperty('topProducts');
      expect(result).toHaveProperty('topCustomers');
      expect(result).toHaveProperty('stockAlerts');
      expect(result).toHaveProperty('totalValue');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('productAverages');
      expect(result.history).toHaveLength(12);
    });

    test('should filter by category when provided', () => {
      const prepareCalls = [];
      mockDb.prepare.mockImplementation((sql) => {
        prepareCalls.push(sql);
        return mockStatement;
      });
      mockStatement.all.mockReturnValue([]);
      mockStatement.get.mockReturnValue({ count: 0, value: 0 });

      analyticsService.getInventoryDashboardData(2026, 'Suplementos');

      const filteredQuery = prepareCalls.find(s => s.includes('p.category = ?'));
      expect(filteredQuery).toBeDefined();
    });

    test('should return 0 totalValue when no products', () => {
      mockStatement.all.mockReturnValue([]);
      mockStatement.get.mockReturnValue({ count: 0, value: null });

      const result = analyticsService.getInventoryDashboardData(2026);
      expect(result.totalValue).toBe(0);
    });
  });
});
