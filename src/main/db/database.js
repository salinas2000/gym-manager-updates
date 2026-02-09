const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class DBManager {
    constructor() {
        this.db = null;
    }

    init() {
        if (this.db) return this.db;

        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }

        const databasePath = path.join(userDataPath, 'gym_manager.db');
        const backupPath = path.join(userDataPath, 'gym_manager.bak');

        // 1. Automatic Local Backup before opening
        try {
            if (fs.existsSync(databasePath)) {
                fs.copyFileSync(databasePath, backupPath);
                console.log('[LOCAL_DB] Auto-backup created at:', backupPath);
            }
        } catch (e) {
            console.warn('[LOCAL_DB] Failed to create auto-backup:', e);
        }

        console.log('[LOCAL_DB] Database initialization at:', databasePath);

        this.db = new Database(databasePath, {
            verbose: (msg) => console.log(`[LOCAL_DB] SQL: ${msg}`)
        });

        // Performance & Integrity
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        this.runMigrations();

        return this.db;
    }

    runMigrations() {
        // 1. Create Tariffs Table (Must exist before customers reference it)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tariffs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                synced INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Create Customers Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                tariff_id INTEGER,
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tariff_id) REFERENCES tariffs (id)
            )
        `);

        // 3. Create Payments Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                customer_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            )
        `);

        // 4. Create Memberships Table (History)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS memberships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                customer_id INTEGER NOT NULL,
                start_date DATETIME NOT NULL,
                end_date DATETIME,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            )
        `);

        // 5. Backfill Memberships (Migration)
        // If memberships is empty but we have active customers, we create an initial record for them.
        const membershipCount = this.db.prepare('SELECT COUNT(*) as count FROM memberships').get().count;
        if (membershipCount === 0) {
            console.log('[LOCAL_DB] Migrating: Backfilling membership history...');
            const activeCustomers = this.db.prepare('SELECT id, created_at FROM customers WHERE active = 1').all();

            const insertStmt = this.db.prepare('INSERT INTO memberships (customer_id, start_date) VALUES (?, ?)');

            const transaction = this.db.transaction((customers) => {
                for (const c of customers) {
                    insertStmt.run(c.id, c.created_at);
                }
            });

            transaction(activeCustomers);
            console.log(`[LOCAL_DB] Backfilled ${activeCustomers.length} active memberships.`);
        }

        // 6. Drop Deprecated Columns (payment_method)
        try {
            const tableInfo = this.db.pragma('table_info(payments)');
            const hasColumn = tableInfo.some(col => col.name === 'payment_method');
            if (hasColumn) {
                console.log('Migrating: Dropping deprecated column payment_method from payments...');
                this.db.exec('ALTER TABLE payments DROP COLUMN payment_method');
                console.log('Migration successful: payment_method dropped.');
            }
        } catch (error) {
            console.error('Migration warning: Could not drop payment_method column:', error);
        }

        // Standard sync tracking columns will be added at the end of runMigrations
        // after all tables are guaranteed to exist.

        // FORCE FIX for updated_at column on critical tables 
        // (Sometimes safeAddColumn fails on older schemas or locking issues)
        ['customers', 'memberships'].forEach(table => {
            try {
                this.db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
                console.log(`[LOCAL_DB] Force-fixed: Added updated_at to ${table}`);
            } catch (e) {
                // Ignore "duplicate column name" error, report others
                if (!e.message.includes('duplicate column name')) {
                    console.warn(`[LOCAL_DB] Force-fix updated_at for ${table} info:`, e.message);
                }
            }
            try {
                this.db.exec(`ALTER TABLE ${table} ADD COLUMN synced INTEGER DEFAULT 0`);
            } catch (e) {
                if (!e.message.includes('duplicate column name')) console.warn(e.message);
            }
        });

        // 8. Schema Updates (Migrations)
        this.safeAddColumn('customers', 'tariff_id', 'INTEGER REFERENCES tariffs(id)');
        this.safeAddColumn('tariffs', 'color_theme', 'TEXT DEFAULT "emerald"');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                name TEXT NOT NULL,
                muscle_group TEXT,
                video_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mesocycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                customer_id INTEGER,
                name TEXT NOT NULL,
                start_date DATETIME,
                end_date DATETIME,
                active INTEGER DEFAULT 1,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS routines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                mesocycle_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                day_group TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (mesocycle_id) REFERENCES mesocycles (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS routine_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                routine_id INTEGER NOT NULL,
                exercise_id INTEGER NOT NULL,
                series INTEGER,
                reps TEXT,
                rpe TEXT,
                notes TEXT,
                order_index INTEGER DEFAULT 0,
                FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE,
                FOREIGN KEY (exercise_id) REFERENCES exercises (id)
            );

            CREATE TABLE IF NOT EXISTS file_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                customer_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                public_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            );

            -- INVENTORY MODULE
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                sku TEXT,
                purchase_price REAL DEFAULT 0,
                sale_price REAL DEFAULT 0,
                stock INTEGER DEFAULT 0,
                min_stock INTEGER DEFAULT 0,
                category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS inventory_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                product_id INTEGER NOT NULL,
                customer_id INTEGER, -- Optional: link sale to a user
                type TEXT NOT NULL, -- 'purchase' (buy), 'adjustment' (correction), 'sale' (automatic if sold)
                quantity INTEGER NOT NULL,
                unit_cost REAL,
                total_cost REAL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0,
                FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS product_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0
            );
        `);

        this.safeAddColumn('payments', 'tariff_name', 'TEXT');
        this.safeAddColumn('inventory_orders', 'customer_id', 'INTEGER REFERENCES customers(id)');

        // 9. Auto-Healing: Fix Missing Memberships
        // Ensure every active customer has an open membership record OR a future scheduled one.
        try {
            // We want customers who are active but have NO membership that is either open (null end_date) or in future.
            const activeCustomersWithoutMembership = this.db.prepare(`
                SELECT c.id, c.created_at 
                FROM customers c
                WHERE c.active = 1 
                AND NOT EXISTS (
                    SELECT 1 FROM memberships m 
                    WHERE m.customer_id = c.id 
                    AND (m.end_date IS NULL OR m.end_date > datetime('now'))
                )
            `).all();

            if (activeCustomersWithoutMembership.length > 0) {
                console.log(`Auto-Healing: Found ${activeCustomersWithoutMembership.length} active customers with missing membership records. Fixing...`);
                const insertStmt = this.db.prepare('INSERT INTO memberships (customer_id, start_date) VALUES (?, ?)');
                const transaction = this.db.transaction((customers) => {
                    for (const c of customers) {
                        insertStmt.run(c.id, c.created_at);
                    }
                });
                transaction(activeCustomersWithoutMembership);
                console.log('Auto-Healing: Fix complete.');
            }
        } catch (error) {
            console.error('Auto-Healing failed:', error);
        }

        // 11. Training Module Updates (Gym Pro)
        this.safeAddColumn('exercises', 'category', 'TEXT DEFAULT "gym"');
        this.safeAddColumn('exercises', 'equipment', 'TEXT');
        this.safeAddColumn('mesocycles', 'is_template', 'INTEGER DEFAULT 0'); // For reusing plans

        // 12. Fix Template Schema: Allow NULL customer_id
        // Templates are global or system-owned, so customer_id should be nullable.
        try {
            const tableInfo = this.db.pragma('table_info(mesocycles)');
            const customerIdCol = tableInfo.find(c => c.name === 'customer_id');

            // If customer_id is NOTNULL (1), we need to migrate
            if (customerIdCol && customerIdCol.notnull === 1) {
                console.log('Migrating: Making mesocycles.customer_id nullable...');

                this.db.transaction(() => {
                    // 1. Create new table
                    this.db.exec(`
                        CREATE TABLE mesocycles_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            customer_id INTEGER, -- Nullable now
                            name TEXT NOT NULL,
                            start_date DATETIME,
                            end_date DATETIME,
                            active INTEGER DEFAULT 1,
                            notes TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            is_template INTEGER DEFAULT 0,
                            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
                        )
                    `);

                    // 2. Copy data
                    this.db.exec(`
                        INSERT INTO mesocycles_new (id, customer_id, name, start_date, end_date, active, notes, created_at, is_template)
                        SELECT id, customer_id, name, start_date, end_date, active, notes, created_at, is_template FROM mesocycles
                    `);

                    // 3. Drop old and rename
                    this.db.exec('DROP TABLE mesocycles');
                    this.db.exec('ALTER TABLE mesocycles_new RENAME TO mesocycles');
                })();

                console.log('Migration successful: mesocycles.customer_id is now nullable.');
            }
        } catch (error) {
            console.error('Migration 12 failed:', error);
        }

        // 13. Training Module v2: Hierarchical Categories
        try {
            console.log('Migrating: Implementing Hierarchical Categories...');

            // 1. Create Categories Table
            this.db.exec(`
            CREATE TABLE IF NOT EXISTS exercise_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gym_id TEXT,
                    name TEXT UNIQUE NOT NULL,
                    icon TEXT NOT NULL,
                    is_system INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 2. Create Subcategories Table
            this.db.exec(`
            CREATE TABLE IF NOT EXISTS exercise_subcategories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gym_id TEXT,
                    category_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES exercise_categories (id) ON DELETE CASCADE,
                    UNIQUE(category_id, name)
                )
            `);

            // 3. Update Exercises Schema (Add subcategory_id, drop legacy text cols)
            // We need to check if we already migrated to avoid errors or data loss on re-runs
            const exTable = this.db.pragma('table_info(exercises)');
            const hasSubCat = exTable.some(c => c.name === 'subcategory_id');

            if (!hasSubCat) {
                console.log('Migrating: Updating exercises table schema...');

                // key fix: Disable foreign keys to allow dropping referenced table
                this.db.pragma('foreign_keys = OFF');

                try {
                    this.db.transaction(() => {
                        // Create new table
                        this.db.exec(`
                            CREATE TABLE exercises_new (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                subcategory_id INTEGER, -- Nullable initially to allow seeding/migration
                                name TEXT NOT NULL,
                                video_url TEXT,
                                notes TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (subcategory_id) REFERENCES exercise_subcategories (id) ON DELETE SET NULL
                            )
                        `);

                        // Copy data
                        this.db.exec(`
                            INSERT INTO exercises_new (id, name, video_url, created_at)
                            SELECT id, name, video_url, created_at FROM exercises
                        `);

                        // Replace table
                        this.db.exec('DROP TABLE exercises');
                        this.db.exec('ALTER TABLE exercises_new RENAME TO exercises');
                    })();
                } finally {
                    // Always re-enable foreign keys
                    this.db.pragma('foreign_keys = ON');
                }

                console.log('Migration successful: exercises table updated.');
            }

        } catch (error) {
            console.error('Migration 13 (Categories) failed:', error);
        }

        // 14. Fix: Enforce ON DELETE CASCADE for Exercises
        // User requested that deleting a category/subcategory deletes all exercises.
        try {
            // We can roughly check if we need this by checking table definition, but parsing SQL is hard.
            // We'll use a pragmatic approach: assume we need it if we are in this version.
            // But we don't want to run it every boot.
            // We can check if a "migration_lock" table exists or just check if the FK is correct?
            // SQLite doesn't expose FK action in pragma foreign_key_list perfectly easily in all versions, but `PRAGMA foreign_key_list(exercises)` returns `on_delete`.

            const fks = this.db.pragma('foreign_key_list(exercises)');
            const subCatFk = fks.find(fk => fk.table === 'exercise_subcategories');

            if (subCatFk && subCatFk.on_delete !== 'CASCADE') {
                console.log('Migrating: Updating exercises FK to ON DELETE CASCADE...');
                this.db.pragma('foreign_keys = OFF');
                this.db.transaction(() => {
                    this.db.exec(`
                        CREATE TABLE exercises_cascading (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            subcategory_id INTEGER,
                            name TEXT NOT NULL,
                            video_url TEXT,
                            notes TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (subcategory_id) REFERENCES exercise_subcategories (id) ON DELETE CASCADE
                        )
                     `);

                    this.db.exec(`
                        INSERT INTO exercises_cascading (id, subcategory_id, name, video_url, notes, created_at)
                        SELECT id, subcategory_id, name, video_url, notes, created_at FROM exercises
                     `);

                    this.db.exec('DROP TABLE exercises');
                    this.db.exec('ALTER TABLE exercises_cascading RENAME TO exercises');
                })();
                this.db.pragma('foreign_keys = ON');
                console.log('Migration successful: Exercises now CASCADE delete.');
            }
        } catch (error) {
            console.error('Migration 14 (Cascade) failed:', error);
        }

        // 15. Add days_per_week to mesocycles for template filtering
        this.safeAddColumn('mesocycles', 'days_per_week', 'INTEGER DEFAULT 0');

        // 16. Add Default Reps & Failure Configuration to Exercises
        this.safeAddColumn('exercises', 'default_sets', 'INTEGER DEFAULT 4');
        this.safeAddColumn('exercises', 'default_reps', 'TEXT');
        this.safeAddColumn('exercises', 'is_failure', 'INTEGER DEFAULT 0');

        // 17. Add drive_link to persist Google Drive URL
        this.safeAddColumn('mesocycles', 'drive_link', 'TEXT');

        // 18. Add Intensity Fields (Baja, Media, Alta, Máxima)
        this.safeAddColumn('exercises', 'default_intensity', 'TEXT');
        // 20. Migration: Massive gym_id addition
        const tables = [
            'tariffs', 'customers', 'payments', 'memberships', 'exercises',
            'mesocycles', 'routines', 'routine_items', 'file_history',
            'exercise_categories', 'exercise_subcategories',
            'products', 'inventory_orders', 'product_categories'
        ];
        tables.forEach(t => this.safeAddColumn(t, 'gym_id', 'TEXT'));

        // Populación masiva de gym_id para registros huérfanos o de desarrollo
        try {
            const licenseService = require('../services/local/license.service');
            const licData = licenseService.getLicenseData();
            const currentGymId = licData ? licData.gym_id : 'LOCAL_DEV';

            if (currentGymId) {
                this.db.transaction(() => {
                    tables.forEach(t => {
                        // Reclaim ANY record that doesn't belong to the current gym IF AND ONLY IF 
                        // those records were marked as LOCAL_DEV or were NULL.
                        // Or if we have a currentGymId and the table ONLY has orphans?
                        const info = this.db.prepare(`
                            UPDATE ${t} 
                            SET gym_id = ? 
                            WHERE gym_id IS NULL OR gym_id = '' OR gym_id = 'LOCAL_DEV'
                        `).run(currentGymId);

                        if (info.changes > 0) {
                            console.log(`[LOCAL_DB] Reclaimed ${info.changes} records for table ${t} -> ${currentGymId}`);
                        }
                    });
                })();
            }
        } catch (e) {
            console.error('Migration Warning: Could not populate gym_id:', e.message);
        }

        // 19. Settings Table (Gym Config)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Initializing Seeding...');
        try {
            require('../services/local/seed.service').init();

            // Seed default exercise fields if empty
            // Seed default exercise fields disabled by user request
            /*
            const fieldCount = this.db.prepare('SELECT count(*) as count FROM exercise_field_config').get().count;
            if (fieldCount === 0) {
                console.log('[LOCAL_DB] Seeding default exercise fields...');
                const gymId = this.getGymId();
                const insertField = this.db.prepare(`
                    INSERT INTO exercise_field_config (gym_id, field_key, label, type, is_active, is_mandatory_in_template) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                const defaults = [
                    [gymId, 'peso', 'Peso', 'text', 1, 1],
                    [gymId, 'descanso', 'Descanso', 'text', 1, 1],
                    [gymId, 'rpe', 'RPE', 'text', 1, 1],
                    [gymId, 'tempo', 'Tempo', 'text', 1, 0]
                ];

                const transaction = this.db.transaction((data) => {
                    for (const f of data) insertField.run(...f);
                });
                transaction(defaults);
            }
            */
        } catch (err) {
            console.error('Seeding failed:', err);
        }

        console.log('Database initialized successfully.');

        // 15. Standardize Sync Status tracking
        try {
            const tablesToMirror = [
                'customers', 'payments', 'memberships', 'tariffs',
                'exercises', 'exercise_categories', 'exercise_subcategories',
                'mesocycles', 'routines', 'routine_items'
            ];

            tablesToMirror.forEach(table => {
                this.safeAddColumn(table, 'synced', 'INTEGER DEFAULT 0');
                this.safeAddColumn(table, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
            });
        } catch (e) {
            console.error('Migration for sync status failed:', e);
        }

        this.verifyIntegrity();


        // 10. Daily Cleanup: Finalize Scheduled Cancellations
        // If a membership ended yesterday (or before) but the customer is still marked active, deactivate them now.
        try {
            console.log('Maintenance: Checking for scheduled cancellations...');
            const result = this.db.prepare(`
                UPDATE customers 
                SET active = 0
                WHERE active = 1 AND id IN (
                    SELECT customer_id FROM memberships
                    WHERE end_date < datetime('now') AND end_date IS NOT NULL
                    GROUP BY customer_id
                    HAVING MAX(start_date) < datetime('now') -- Ensure we are looking at the latest valid period
                )
            `).run();
            // Note: The subquery logic can be complex if multiple memberships exist. 
            // Simplified: If the *current* relevant membership (end_date IS NOT NULL) has expired.
            // A safer query:
            // "Update customers to active=0 WHERE active=1 AND NOT EXISTS (any open membership OR any future membership)"

            const cleanupInfo = this.db.prepare(`
                UPDATE customers 
                SET active = 0 
                WHERE active = 1 
                AND NOT EXISTS (
                    SELECT 1 FROM memberships 
                    WHERE customer_id = customers.id 
                    AND (end_date IS NULL OR end_date > datetime('now'))
                )
            `).run();

            if (cleanupInfo.changes > 0) {
                console.log(`Maintenance: Deactivated ${cleanupInfo.changes} customers with expired memberships.`);
            }
        } catch (error) {
            console.error('Maintenance cleanup failed:', error);
        }

        // 16. Deletion Log for Cloud Sync
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_deleted_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT NOT NULL,
                table_name TEXT NOT NULL,
                local_id INTEGER NOT NULL,
                deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 20. Exercise Field Configuration
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS exercise_field_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                gym_id TEXT,
                field_key TEXT UNIQUE NOT NULL,
                label TEXT NOT NULL,
                type TEXT DEFAULT 'text', -- text, number, select
                is_active INTEGER DEFAULT 1,
                is_mandatory_in_template INTEGER DEFAULT 0,
                options TEXT, -- JSON array of strings for 'select' type
                is_deleted INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed default field configs disabled by user request
        /*
        const seedFields = [
            { key: 'series', label: 'Series', type: 'number', mandatory: 1 },
            { key: 'reps', label: 'Reps', type: 'text', mandatory: 1 },
            { key: 'fallo', label: 'Fallo', type: 'text', mandatory: 0 },
            { key: 'intensidad', label: 'Intensidad', type: 'text', mandatory: 0 }
        ];

        const checkField = this.db.prepare('SELECT id FROM exercise_field_config WHERE field_key = ?');
        const insertField = this.db.prepare(`
            INSERT INTO exercise_field_config (gym_id, field_key, label, type, is_active, is_mandatory_in_template)
            VALUES (?, ?, ?, ?, 1, ?)
        `);

        seedFields.forEach(f => {
            const exists = checkField.get(f.key);
            if (!exists) {
                insertField.run('LOCAL_DEV', f.key, f.label, f.type, f.mandatory);
            }
        });
        */

        this.safeAddColumn('exercises', 'custom_fields', 'TEXT'); // JSON storage
        this.safeAddColumn('routine_items', 'custom_fields', 'TEXT'); // JSON storage

        // 20b. Ensure exercise_field_config has is_deleted column (for DBs created before this column existed)
        this.safeAddColumn('exercise_field_config', 'is_deleted', 'INTEGER DEFAULT 0');

        // 21. Performance Indexes for Production
        this.safeCreateIndex('idx_customers_gym', 'customers', 'gym_id');
        this.safeCreateIndex('idx_customers_active', 'customers', 'active');
        this.safeCreateIndex('idx_payments_customer', 'payments', 'customer_id');
        this.safeCreateIndex('idx_payments_date', 'payments', 'payment_date');
        this.safeCreateIndex('idx_memberships_customer', 'memberships', 'customer_id');
        this.safeCreateIndex('idx_memberships_end', 'memberships', 'end_date');
        this.safeCreateIndex('idx_exercises_subcategory', 'exercises', 'subcategory_id');
        this.safeCreateIndex('idx_routine_items_routine', 'routine_items', 'routine_id');
        this.safeCreateIndex('idx_routine_items_exercise', 'routine_items', 'exercise_id');
        this.safeCreateIndex('idx_mesocycles_customer', 'mesocycles', 'customer_id');
        this.safeCreateIndex('idx_mesocycles_template', 'mesocycles', 'is_template');
        this.safeCreateIndex('idx_routines_mesocycle', 'routines', 'mesocycle_id');
        this.safeCreateIndex('idx_field_config_deleted', 'exercise_field_config', 'is_deleted');

        this.verifySystemSettings();
    }

    verifySystemSettings() {
        console.log('[LOCAL_DB] Checking system settings...');
        try {
            const licenseService = require('../services/local/license.service');
            const licData = licenseService.getLicenseData();

            if (licData && licData.gym_id) {
                const settingsService = require('../services/local/settings.service');
                const currentId = settingsService.get('gym_id');

                if (currentId !== licData.gym_id) {
                    console.log('[LOCAL_DB] Syncing gym_id setting with license...');
                    settingsService.set('gym_id', licData.gym_id);
                }
            }
        } catch (e) {
            console.warn('[LOCAL_DB] verifySystemSettings failed:', e.message);
        }
    }

    verifyIntegrity() {
        console.log('[LOCAL_DB] Running Integrity Verification...');
        try {
            const licenseService = require('../services/local/license.service');
            const lic = licenseService.getLicenseData();
            const currentGymId = lic ? lic.gym_id : null;

            const tables = ['customers', 'payments', 'memberships', 'routines', 'mesocycles'];
            let issuesFound = 0;
            let fixedCount = 0;

            tables.forEach(table => {
                try {
                    // Check if table exists
                    const exists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
                    if (!exists) return;

                    // DEBUG: Check distribution
                    if (table === 'customers') {
                        const total = this.db.prepare('SELECT count(*) as count FROM customers').get().count;
                        const match = currentGymId ? this.db.prepare('SELECT count(*) as count FROM customers WHERE gym_id = ?').get(currentGymId).count : 0;
                        const dev = this.db.prepare('SELECT count(*) as count FROM customers WHERE gym_id = "LOCAL_DEV"').get().count;
                        const orphans = this.db.prepare('SELECT count(*) as count FROM customers WHERE gym_id IS NULL OR gym_id = ""').get().count;
                        console.log(`[LOCAL_DB] Data Visibility Check [${table}]: Total: ${total} | Matches active [${currentGymId}]: ${match} | LOCAL_DEV: ${dev} | Orphans: ${orphans}`);
                    }

                    // 1. Check for Orphans (Missing gym_id)
                    const orphans = this.db.prepare(`SELECT count(*) as count FROM ${table} WHERE gym_id IS NULL OR gym_id = ''`).get();

                    if (orphans.count > 0) {
                        console.warn(`[LOCAL_DB] ⚠️ Found ${orphans.count} orphan records in ${table}`);
                        issuesFound += orphans.count;

                        // Auto-Fix if we have a valid Gym ID
                        if (currentGymId) {
                            console.log(`[LOCAL_DB] 🔧 Auto-Fixing orphans in ${table} -> ${currentGymId}...`);
                            const info = this.db.prepare(`UPDATE ${table} SET gym_id = ? WHERE gym_id IS NULL OR gym_id = ''`).run(currentGymId);
                            fixedCount += info.changes;
                        }
                    }
                } catch (e) {
                    console.warn(`[LOCAL_DB] Integrity check skipped for ${table}: ${e.message}`);
                }
            });

            if (issuesFound === 0) {
                console.log('[LOCAL_DB] Integrity: ✅ OK');
            } else {
                if (fixedCount > 0) {
                    console.log(`[LOCAL_DB] Integrity: 🛡️ FIXED ${fixedCount} issues automatically (Reclaimed orphans).`);
                } else {
                    console.warn(`[LOCAL_DB] Integrity: ❌ WARNING (${issuesFound} records have a different GYM_ID than active license)`);
                }
            }
        } catch (error) {
            console.error('[LOCAL_DB] Integrity check failed:', error);
        }
    }

    safeCreateIndex(indexName, tableName, columns) {
        try {
            const cols = Array.isArray(columns) ? columns.join(', ') : columns;
            this.db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${cols})`);
        } catch (error) {
            console.warn(`[LOCAL_DB] Index ${indexName} creation skipped:`, error.message);
        }
    }

    safeAddColumn(tableName, columnName, columnDef) {
        try {
            const tableInfo = this.db.pragma(`table_info(${tableName})`);
            const hasColumn = tableInfo.some(col => col.name === columnName);

            if (!hasColumn) {
                console.log(`Migrating: Adding ${columnName} to ${tableName}...`);
                try {
                    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
                } catch (addError) {
                    // Ignore error if column default is dynamic (e.g. CURRENT_TIMESTAMP) in some older sqlite versions
                    // But better-sqlite3 usually handles this. If fails, it might be due to non-constant default.
                    // Strategy B: If it fails, try adding without default, then defaulting.
                    if (addError.message.includes('non-constant default')) {
                        // Sqlite limitation: Cannot ADD COLUMN with non-constant default value (like CURRENT_TIMESTAMP)
                        // Workaround: Add column null, then update it.
                        // OR: Add as NULL, then create TRIGGER (too complex).
                        // SIMPLEST: No default, then Update.
                        this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} DATETIME`);
                        this.db.exec(`UPDATE ${tableName} SET ${columnName} = datetime('now') WHERE ${columnName} IS NULL`);
                    } else {
                        throw addError;
                    }
                }
                console.log('Migration successful.');
            }
        } catch (error) {
            console.error(`Migration failed for ${tableName}.${columnName}:`, error);
        }
    }

    getInstance() {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('Database connection closed.');
        }
    }
}

module.exports = new DBManager();
