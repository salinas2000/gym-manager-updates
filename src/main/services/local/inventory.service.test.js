/**
 * Tests for Inventory Service
 */

const inventoryService = require('./inventory.service');

jest.mock('../../db/database');
jest.mock('./license.service');

describe('Inventory Service', () => {
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

    const licenseService = require('./license.service');
    licenseService.getLicenseData = jest.fn(() => ({ gym_id: 'TEST_GYM' }));

    // Reset singleton's cached db
    inventoryService.db = null;

    jest.clearAllMocks();
  });

  describe('getProducts()', () => {
    test('should return all products for gym', async () => {
      const mockProducts = [
        { id: 1, name: 'Protein Shake', stock: 10 },
        { id: 2, name: 'Energy Bar', stock: 25 }
      ];
      mockStatement.all.mockReturnValue(mockProducts);

      const result = await inventoryService.getProducts();
      expect(result).toEqual(mockProducts);
    });

    test('should return empty array if no products', async () => {
      mockStatement.all.mockReturnValue([]);
      const result = await inventoryService.getProducts();
      expect(result).toEqual([]);
    });
  });

  describe('createProduct()', () => {
    test('should create product with valid data', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 5 });

      const result = await inventoryService.createProduct({
        name: 'New Product',
        purchase_price: 5,
        sale_price: 10,
        stock: 20,
        min_stock: 5
      });

      expect(result.id).toBe(5);
      expect(result.name).toBe('New Product');
    });

    test('should reject missing name', async () => {
      await expect(inventoryService.createProduct({
        purchase_price: 5, sale_price: 10
      })).rejects.toThrow();
    });

    test('should reject empty name', async () => {
      await expect(inventoryService.createProduct({
        name: '', purchase_price: 5, sale_price: 10
      })).rejects.toThrow();
    });

    test('should default stock and min_stock to 0', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 6 });

      const result = await inventoryService.createProduct({ name: 'Simple' });
      expect(result.stock).toBe(0);
      expect(result.min_stock).toBe(0);
    });

    test('should default prices to 0', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 7 });

      const result = await inventoryService.createProduct({ name: 'FreeItem' });
      expect(result.purchase_price).toBe(0);
      expect(result.sale_price).toBe(0);
    });
  });

  describe('updateProduct()', () => {
    test('should update product fields', async () => {
      const result = await inventoryService.updateProduct(1, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    test('should return early for empty update', async () => {
      const result = await inventoryService.updateProduct(1, {});
      expect(result.id).toBe(1);
    });

    test('should set synced = 0 on update', async () => {
      let executedSql = '';
      mockDb.prepare.mockImplementation((sql) => {
        executedSql = sql;
        return mockStatement;
      });

      await inventoryService.updateProduct(1, { name: 'Test' });
      expect(executedSql).toContain('synced = 0');
    });
  });

  describe('deleteProduct()', () => {
    test('should log deletion and remove product', async () => {
      const prepareCalls = [];
      mockDb.prepare.mockImplementation((sql) => {
        prepareCalls.push(sql);
        return mockStatement;
      });

      const result = await inventoryService.deleteProduct(1);
      expect(result).toBe(true);

      // Should log to sync_deleted_log first, then delete
      expect(prepareCalls[0]).toContain('sync_deleted_log');
      expect(prepareCalls[1]).toContain('DELETE FROM products');
    });
  });

  describe('getOrders()', () => {
    test('should return orders with product and customer names', async () => {
      const mockOrders = [
        { id: 1, product_name: 'Protein', customer_name: 'John Doe', type: 'sale' }
      ];
      mockStatement.all.mockReturnValue(mockOrders);

      const result = await inventoryService.getOrders();
      expect(result).toEqual(mockOrders);
    });
  });

  describe('createOrder()', () => {
    test('should create purchase order and update stock', async () => {
      mockStatement.get.mockReturnValue({ stock: 10, purchase_price: 5, name: 'Test' });
      mockStatement.run.mockReturnValue({ lastInsertRowid: 10 });

      const result = await inventoryService.createOrder({
        product_id: 1,
        type: 'purchase',
        quantity: 5,
        unit_cost: 5
      });

      expect(result.id).toBe(10);
      expect(result.total_cost).toBe(25);
    });

    test('should create sale order', async () => {
      mockStatement.get.mockReturnValue({ stock: 20, purchase_price: 5, name: 'Test' });
      mockStatement.run.mockReturnValue({ lastInsertRowid: 11 });

      const result = await inventoryService.createOrder({
        product_id: 1,
        type: 'sale',
        quantity: 3,
        unit_cost: 10
      });

      expect(result.total_cost).toBe(30);
    });

    test('should auto-purchase when sale exceeds stock', async () => {
      mockStatement.get.mockReturnValue({ stock: 2, purchase_price: 5, name: 'LowStock' });
      mockStatement.run.mockReturnValue({ lastInsertRowid: 12 });

      const prepareCalls = [];
      mockDb.prepare.mockImplementation((sql) => {
        prepareCalls.push(sql);
        return mockStatement;
      });

      await inventoryService.createOrder({
        product_id: 1,
        type: 'sale',
        quantity: 5,
        unit_cost: 10
      });

      // Should have auto-purchase INSERT
      const autoPurchase = prepareCalls.find(s =>
        s.includes('INSERT INTO inventory_orders') && s.includes("'purchase'")
      );
      expect(autoPurchase).toBeDefined();
    });

    test('should reject invalid product_id', async () => {
      await expect(inventoryService.createOrder({
        product_id: -1, type: 'sale', quantity: 1
      })).rejects.toThrow();
    });

    test('should reject zero quantity', async () => {
      await expect(inventoryService.createOrder({
        product_id: 1, type: 'sale', quantity: 0
      })).rejects.toThrow();
    });

    test('should reject invalid order type', async () => {
      await expect(inventoryService.createOrder({
        product_id: 1, type: 'invalid', quantity: 1
      })).rejects.toThrow();
    });

    test('should throw if product not found', async () => {
      mockStatement.get.mockReturnValue(undefined);

      await expect(inventoryService.createOrder({
        product_id: 999, type: 'purchase', quantity: 1, unit_cost: 5
      })).rejects.toThrow('Producto no encontrado');
    });
  });

  describe('deleteOrder()', () => {
    test('should reverse stock on purchase deletion', async () => {
      mockStatement.get.mockReturnValue({
        id: 1, product_id: 2, type: 'purchase', quantity: 10
      });

      const runCalls = [];
      mockStatement.run.mockImplementation((...args) => {
        runCalls.push(args);
        return { changes: 1 };
      });

      await inventoryService.deleteOrder(1);

      // Stock adjustment for purchase reversal should be negative
      const stockUpdateArgs = runCalls.find(args => args[0] === -10);
      expect(stockUpdateArgs).toBeDefined();
    });

    test('should reverse stock on sale deletion', async () => {
      mockStatement.get.mockReturnValue({
        id: 1, product_id: 2, type: 'sale', quantity: 5
      });

      const runCalls = [];
      mockStatement.run.mockImplementation((...args) => {
        runCalls.push(args);
        return { changes: 1 };
      });

      await inventoryService.deleteOrder(1);

      // Stock adjustment for sale reversal should be positive
      const stockUpdateArgs = runCalls.find(args => args[0] === 5);
      expect(stockUpdateArgs).toBeDefined();
    });

    test('should throw if order not found', async () => {
      mockStatement.get.mockReturnValue(undefined);

      await expect(inventoryService.deleteOrder(999)).rejects.toThrow('Pedido no encontrado');
    });
  });

  describe('Categories', () => {
    test('getCategories should return all categories', async () => {
      const mockCats = [{ id: 1, name: 'Suplementos' }];
      mockStatement.all.mockReturnValue(mockCats);

      const result = await inventoryService.getCategories();
      expect(result).toEqual(mockCats);
    });

    test('createCategory should create with valid data', async () => {
      mockStatement.run.mockReturnValue({ lastInsertRowid: 3 });

      const result = await inventoryService.createCategory({ name: 'Bebidas' });
      expect(result.id).toBe(3);
      expect(result.name).toBe('Bebidas');
    });

    test('createCategory should reject empty name', async () => {
      await expect(inventoryService.createCategory({ name: '' })).rejects.toThrow();
    });

    test('updateCategory should update name', async () => {
      const result = await inventoryService.updateCategory(1, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    test('deleteCategory should log and delete', async () => {
      const result = await inventoryService.deleteCategory(1);
      expect(result).toBe(true);
    });
  });
});
