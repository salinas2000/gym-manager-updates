const dbManager = require('../../db/database');
const licenseService = require('./license.service');
const z = require('zod');

// Validation Schemas
const productSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    purchase_price: z.number().min(0).default(0),
    sale_price: z.number().min(0).default(0),
    stock: z.number().int().default(0),
    min_stock: z.number().int().min(0).default(0),
    category: z.string().optional().nullable(),
});

const orderSchema = z.object({
    product_id: z.coerce.number().int().positive("ID de producto inválido"),
    customer_id: z.coerce.number().int().positive().nullable().optional(),
    type: z.enum(['purchase', 'sale', 'adjustment']),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser mayor a 0"),
    unit_cost: z.coerce.number().min(0).default(0),
    auto_purchase_cost: z.coerce.number().min(0).optional(),
    notes: z.string().optional().nullable(),
});

class InventoryService {
    constructor() {
        this.db = null;
    }

    getDb() {
        if (!this.db) {
            this.db = dbManager.getInstance();
        }
        return this.db;
    }

    getGymId() {
        const lic = licenseService.getLicenseData();
        return lic ? lic.gym_id : 'LOCAL_DEV';
    }

    // --- PRODUCTS ---
    async getProducts() {
        const gymId = this.getGymId();
        return this.getDb().prepare(`
            SELECT * FROM products 
            WHERE gym_id = ? 
            ORDER BY name ASC
        `).all(gymId);
    }

    async createProduct(data) {
        const validation = productSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const { name, description, sku, purchase_price, sale_price, stock, min_stock, category } = validation.data;

        const info = this.getDb().prepare(`
            INSERT INTO products (
                gym_id, name, description, sku, purchase_price, 
                sale_price, stock, min_stock, category, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
            gymId, name, description, sku, purchase_price,
            sale_price, stock, min_stock, category
        );

        return { id: info.lastInsertRowid, ...validation.data };
    }

    async updateProduct(id, data) {
        const validation = productSchema.partial().safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const validatedData = validation.data;

        const fields = [];
        const values = [];

        Object.keys(validatedData).forEach(key => {
            if (validatedData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(validatedData[key]);
            }
        });

        if (fields.length === 0) return { id, ...data };

        fields.push('updated_at = CURRENT_TIMESTAMP');
        fields.push('synced = 0');
        values.push(id, gymId);

        this.getDb().prepare(`
            UPDATE products SET ${fields.join(', ')}
            WHERE id = ? AND gym_id = ?
        `).run(...values);

        return { id, ...validatedData };
    }

    async deleteProduct(id) {
        const gymId = this.getGymId();
        this.getDb().prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)')
            .run(gymId, 'products', id);

        this.getDb().prepare('DELETE FROM products WHERE id = ? AND gym_id = ?')
            .run(id, gymId);

        return true;
    }

    // --- ORDERS / STOCK MANAGEMENT ---
    async getOrders() {
        const gymId = this.getGymId();
        return this.getDb().prepare(`
            SELECT 
                o.*, 
                p.name as product_name,
                c.first_name || ' ' || c.last_name as customer_name
            FROM inventory_orders o
            JOIN products p ON o.product_id = p.id
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.gym_id = ? 
            ORDER BY o.created_at DESC
        `).all(gymId);
    }

    async createOrder(data) {
        const validation = orderSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const { product_id, customer_id, type, quantity, unit_cost, notes, auto_purchase_cost } = validation.data;
        const total_cost = (unit_cost || 0) * quantity;

        const db = this.getDb();
        const transaction = db.transaction(() => {
            const product = db.prepare('SELECT stock, purchase_price, name FROM products WHERE id = ? AND gym_id = ?')
                .get(product_id, gymId);

            if (!product) throw new Error('Producto no encontrado');

            // 2. Handle Auto-Purchase on Sale Deficit
            if (type === 'sale' && product.stock < quantity) {
                const deficit = quantity - product.stock;
                // Use provided custom cost OR fallback to product stored price
                const autoPurchaseCost = (auto_purchase_cost !== undefined && auto_purchase_cost !== null) ? auto_purchase_cost : (product.purchase_price || 0);
                const autoPurchaseTotal = deficit * autoPurchaseCost;

                db.prepare(`
                    INSERT INTO inventory_orders (
                        gym_id, product_id, type, quantity, 
                        unit_cost, total_cost, notes, synced
                    ) VALUES (?, ?, 'purchase', ?, ?, ?, ?, 0)
                `).run(
                    gymId, product_id, deficit, autoPurchaseCost,
                    autoPurchaseTotal, `Compra automática: Ajuste por déficit de venta (${deficit} ud) @ ${autoPurchaseCost}€/ud`
                );

                db.prepare(`
                    UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP, synced = 0
                    WHERE id = ? AND gym_id = ?
                `).run(quantity, product_id, gymId);

                console.log(`[Inventory] Auto-purchase created for ${deficit} units of product ${product.name} (ID: ${product_id})`);
            }

            // 3. Create the actual order
            const info = db.prepare(`
                INSERT INTO inventory_orders (
                    gym_id, product_id, customer_id, type, quantity, 
                    unit_cost, total_cost, notes, synced
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `).run(gymId, product_id, customer_id || null, type, quantity, unit_cost, total_cost, notes);

            // 4. Update product stock for the current order
            let stockChange = Math.abs(quantity);
            if (type === 'sale') stockChange = -Math.abs(quantity);
            if (type === 'adjustment') stockChange = quantity;

            db.prepare(`
                UPDATE products 
                SET stock = stock + ?, 
                    updated_at = CURRENT_TIMESTAMP,
                    synced = 0
                WHERE id = ? AND gym_id = ?
            `).run(stockChange, product_id, gymId);

            return info.lastInsertRowid;
        });

        const orderId = transaction();
        return { id: orderId, ...validation.data, total_cost };
    }

    // --- CATEGORIES ---
    async getCategories() {
        const gymId = this.getGymId();
        return this.getDb().prepare(`
            SELECT * FROM product_categories 
            WHERE gym_id = ? 
            ORDER BY name ASC
        `).all(gymId);
    }

    async createCategory(data) {
        const schema = z.object({
            name: z.string().min(1, "El nombre de la categoría es obligatorio"),
            description: z.string().optional().nullable(),
        });

        const validation = schema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const { name, description } = validation.data;

        const info = this.getDb().prepare(`
            INSERT INTO product_categories (gym_id, name, description, synced)
            VALUES (?, ?, ?, 0)
        `).run(gymId, name, description);

        return { id: info.lastInsertRowid, ...validation.data };
    }

    async updateCategory(id, data) {
        const schema = z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional().nullable(),
        });

        const validation = schema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const gymId = this.getGymId();
        const { name, description } = validation.data;

        const fields = [];
        const values = [];
        if (name) { fields.push('name = ?'); values.push(name); }
        if (description !== undefined) { fields.push('description = ?'); values.push(description); }

        if (fields.length === 0) return { id, ...data };

        fields.push('updated_at = CURRENT_TIMESTAMP');
        fields.push('synced = 0');
        values.push(id, gymId);

        this.getDb().prepare(`
            UPDATE product_categories SET ${fields.join(', ')}
            WHERE id = ? AND gym_id = ?
        `).run(...values);

        return { id, ...validation.data };
    }

    async deleteCategory(id) {
        const gymId = this.getGymId();
        this.getDb().prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)')
            .run(gymId, 'product_categories', id);

        this.getDb().prepare('DELETE FROM product_categories WHERE id = ? AND gym_id = ?')
            .run(id, gymId);
        return true;
    }

    async deleteOrder(id) {
        const gymId = this.getGymId();
        const db = this.getDb();

        const transaction = db.transaction(() => {
            const order = db.prepare('SELECT * FROM inventory_orders WHERE id = ? AND gym_id = ?')
                .get(id, gymId);

            if (!order) throw new Error('Pedido no encontrado');

            let adjustment = 0;
            if (order.type === 'purchase') adjustment = -Math.abs(order.quantity);
            if (order.type === 'sale') adjustment = Math.abs(order.quantity);
            if (order.type === 'adjustment') adjustment = -order.quantity;

            db.prepare(`
                UPDATE products 
                SET stock = stock + ?, 
                    updated_at = CURRENT_TIMESTAMP,
                    synced = 0
                WHERE id = ? AND gym_id = ?
            `).run(adjustment, order.product_id, gymId);

            db.prepare('INSERT INTO sync_deleted_log (gym_id, table_name, local_id) VALUES (?, ?, ?)')
                .run(gymId, 'inventory_orders', id);

            db.prepare('DELETE FROM inventory_orders WHERE id = ? AND gym_id = ?')
                .run(id, gymId);

            return true;
        });

        return transaction();
    }
}

module.exports = new InventoryService();
