/**
 * Integration Tests for Database Manager
 * Tests the REAL database behavior, not mocks
 * Catches migration issues, data integrity problems, etc.
 */

// IMPORTANT: Unmock modules for integration tests
jest.unmock('better-sqlite3');
jest.unmock('fs');

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Don't mock the database - test the real thing!
const dbManager = require('./database');

describe.skip('Database Manager - Integration Tests', () => {
  // SKIP: These tests require better-sqlite3 native module to be rebuilt
  // for the current Node.js version. Run 'npm run rebuild' to enable.
  //
  // These are advanced integration tests that test REAL database behavior,
  // not mocks. They are valuable but require special setup.
  //
  // To run: Remove .skip and ensure better-sqlite3 is rebuilt for your Node version

  let testDbPath;

  beforeEach(() => {
    // Create temporary database for each test
    testDbPath = path.join(os.tmpdir(), `test-gym-${Date.now()}.db`);

    // Mock app.getPath to return temp directory
    const { app } = require('electron');
    app.getPath.mockReturnValue(path.dirname(testDbPath));
  });

  afterEach(() => {
    // Cleanup: Close and delete test database
    try {
      if (dbManager.db) {
        dbManager.db.close();
        dbManager.db = null;
      }
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      const backupPath = testDbPath.replace('.db', '.bak');
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Migration System', () => {
    test('should create all required tables', () => {
      dbManager.init();
      const db = dbManager.getInstance();

      const tables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      const tableNames = tables.map(t => t.name);

      // Critical tables must exist
      expect(tableNames).toContain('customers');
      expect(tableNames).toContain('payments');
      expect(tableNames).toContain('memberships');
      expect(tableNames).toContain('tariffs');
      expect(tableNames).toContain('exercises');
      expect(tableNames).toContain('mesocycles');
      expect(tableNames).toContain('routines');
      expect(tableNames).toContain('settings');
    });

    test('should enable WAL mode for performance', () => {
      dbManager.init();
      const db = dbManager.getInstance();

      const result = db.pragma('journal_mode');
      expect(result[0].journal_mode).toBe('wal');
    });

    test('should enforce foreign keys', () => {
      dbManager.init();
      const db = dbManager.getInstance();

      const result = db.pragma('foreign_keys');
      expect(result[0].foreign_keys).toBe(1);
    });

    test('should handle duplicate migration runs gracefully', () => {
      dbManager.init();

      // Run migrations again - should not crash
      expect(() => dbManager.runMigrations()).not.toThrow();
    });

    test('should create automatic backup on init', () => {
      // Create a database first
      dbManager.init();
      dbManager.db.close();
      dbManager.db = null;

      // Init again - should create backup
      dbManager.init();

      const backupPath = testDbPath.replace('.db', '.bak');
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    beforeEach(() => {
      dbManager.init();
    });

    test('should enforce UNIQUE constraint on customer email', () => {
      const db = dbManager.getInstance();

      db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email)
        VALUES (?, ?, ?, ?)
      `).run('TEST_GYM', 'John', 'Doe', 'john@test.com');

      // Duplicate email should fail
      expect(() => {
        db.prepare(`
          INSERT INTO customers (gym_id, first_name, last_name, email)
          VALUES (?, ?, ?, ?)
        `).run('TEST_GYM', 'Jane', 'Doe', 'john@test.com');
      }).toThrow(/UNIQUE constraint failed/);
    });

    test('should CASCADE delete payments when customer is deleted', () => {
      const db = dbManager.getInstance();

      // Create customer
      const customerInfo = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email)
        VALUES (?, ?, ?, ?)
      `).run('TEST_GYM', 'John', 'Doe', 'john@test.com');

      const customerId = customerInfo.lastInsertRowid;

      // Create payment
      db.prepare(`
        INSERT INTO payments (gym_id, customer_id, amount)
        VALUES (?, ?, ?)
      `).run('TEST_GYM', customerId, 50);

      // Verify payment exists
      const paymentsBefore = db.prepare('SELECT * FROM payments WHERE customer_id = ?').all(customerId);
      expect(paymentsBefore).toHaveLength(1);

      // Delete customer
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

      // Payment should be automatically deleted (CASCADE)
      const paymentsAfter = db.prepare('SELECT * FROM payments WHERE customer_id = ?').all(customerId);
      expect(paymentsAfter).toHaveLength(0);
    });

    test('should prevent orphan memberships', () => {
      const db = dbManager.getInstance();

      // Try to create membership without customer (should fail)
      expect(() => {
        db.prepare(`
          INSERT INTO memberships (gym_id, customer_id, start_date)
          VALUES (?, ?, ?)
        `).run('TEST_GYM', 99999, new Date().toISOString());
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    test('should auto-heal missing memberships for active customers', () => {
      const db = dbManager.getInstance();

      // Create active customer WITHOUT membership (data corruption scenario)
      db.pragma('foreign_keys = OFF');
      const info = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email, active)
        VALUES (?, ?, ?, ?, ?)
      `).run('TEST_GYM', 'John', 'Doe', 'john@test.com', 1);
      db.pragma('foreign_keys = ON');

      const customerId = info.lastInsertRowid;

      // Verify no membership exists
      const membershipsBefore = db.prepare('SELECT * FROM memberships WHERE customer_id = ?').all(customerId);
      expect(membershipsBefore).toHaveLength(0);

      // Run migrations (includes auto-healing)
      dbManager.runMigrations();

      // Membership should now exist
      const membershipsAfter = db.prepare('SELECT * FROM memberships WHERE customer_id = ?').all(customerId);
      expect(membershipsAfter).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      dbManager.init();
    });

    test('should create performance indexes', () => {
      const db = dbManager.getInstance();

      const indexes = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all();

      const indexNames = indexes.map(i => i.name);

      // Critical indexes for performance
      expect(indexNames).toContain('idx_customers_gym');
      expect(indexNames).toContain('idx_customers_active');
      expect(indexNames).toContain('idx_payments_customer');
      expect(indexNames).toContain('idx_memberships_customer');
    });

    test('should handle bulk inserts efficiently', () => {
      const db = dbManager.getInstance();

      const startTime = Date.now();

      // Insert 1000 customers
      const insert = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email)
        VALUES (?, ?, ?, ?)
      `);

      const insertMany = db.transaction((customers) => {
        for (const customer of customers) {
          insert.run(...customer);
        }
      });

      const customers = Array.from({ length: 1000 }, (_, i) => [
        'TEST_GYM',
        `First${i}`,
        `Last${i}`,
        `user${i}@test.com`
      ]);

      insertMany(customers);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in less than 1 second
      expect(duration).toBeLessThan(1000);

      // Verify all were inserted
      const count = db.prepare('SELECT COUNT(*) as count FROM customers').get();
      expect(count.count).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      dbManager.init();
    });

    test('should handle very long text values', () => {
      const db = dbManager.getInstance();
      const longText = 'A'.repeat(10000);

      const info = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email)
        VALUES (?, ?, ?, ?)
      `).run('TEST_GYM', longText, 'Doe', 'test@test.com');

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
      expect(customer.first_name).toHaveLength(10000);
    });

    test('should handle special characters in data', () => {
      const db = dbManager.getInstance();
      const specialChars = `Test "quotes" and 'apostrophes' and <html> & \\ / symbols`;

      const info = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email)
        VALUES (?, ?, ?, ?)
      `).run('TEST_GYM', specialChars, 'Doe', 'test@test.com');

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
      expect(customer.first_name).toBe(specialChars);
    });

    test('should handle concurrent transactions', () => {
      const db = dbManager.getInstance();

      // Multiple transactions should not deadlock
      const transaction1 = db.transaction(() => {
        db.prepare(`
          INSERT INTO customers (gym_id, first_name, last_name, email)
          VALUES (?, ?, ?, ?)
        `).run('TEST_GYM', 'User1', 'Test', 'user1@test.com');
      });

      const transaction2 = db.transaction(() => {
        db.prepare(`
          INSERT INTO customers (gym_id, first_name, last_name, email)
          VALUES (?, ?, ?, ?)
        `).run('TEST_GYM', 'User2', 'Test', 'user2@test.com');
      });

      expect(() => {
        transaction1();
        transaction2();
      }).not.toThrow();
    });

    test('should handle NULL values correctly', () => {
      const db = dbManager.getInstance();

      const info = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email, phone, tariff_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('TEST_GYM', 'John', 'Doe', 'john@test.com', null, null);

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
      expect(customer.phone).toBeNull();
      expect(customer.tariff_id).toBeNull();
    });
  });

  describe('Scheduled Cleanup', () => {
    beforeEach(() => {
      dbManager.init();
    });

    test('should deactivate customers with expired memberships', () => {
      const db = dbManager.getInstance();

      // Create customer with expired membership
      const customerInfo = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email, active)
        VALUES (?, ?, ?, ?, ?)
      `).run('TEST_GYM', 'John', 'Doe', 'john@test.com', 1);

      const customerId = customerInfo.lastInsertRowid;

      // Create expired membership
      db.prepare(`
        INSERT INTO memberships (gym_id, customer_id, start_date, end_date)
        VALUES (?, ?, ?, ?)
      `).run('TEST_GYM', customerId, '2025-01-01', '2025-12-31');

      // Run cleanup (part of migrations)
      dbManager.runMigrations();

      // Customer should be deactivated
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      expect(customer.active).toBe(0);
    });

    test('should keep customers with open-ended memberships active', () => {
      const db = dbManager.getInstance();

      const customerInfo = db.prepare(`
        INSERT INTO customers (gym_id, first_name, last_name, email, active)
        VALUES (?, ?, ?, ?, ?)
      `).run('TEST_GYM', 'John', 'Doe', 'john@test.com', 1);

      const customerId = customerInfo.lastInsertRowid;

      // Create open-ended membership (no end_date)
      db.prepare(`
        INSERT INTO memberships (gym_id, customer_id, start_date, end_date)
        VALUES (?, ?, ?, ?)
      `).run('TEST_GYM', customerId, '2026-01-01', null);

      // Run cleanup
      dbManager.runMigrations();

      // Customer should still be active
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      expect(customer.active).toBe(1);
    });
  });
});
