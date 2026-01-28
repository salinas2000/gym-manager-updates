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

        const dbPath = path.join(userDataPath, 'gym_manager.db');
        console.log('Database path:', dbPath);

        this.db = new Database(dbPath, { verbose: console.log });

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
                name TEXT NOT NULL,
                amount REAL NOT NULL
            )
        `);

        // 2. Create Customers Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                -- tariff_id column might be missing in old DBs, handled below
            )
        `);

        // 3. Create Payments Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            console.log('Migrating: Backfilling membership history...');
            const activeCustomers = this.db.prepare('SELECT id, created_at FROM customers WHERE active = 1').all();

            const insertStmt = this.db.prepare('INSERT INTO memberships (customer_id, start_date) VALUES (?, ?)');

            const transaction = this.db.transaction((customers) => {
                for (const c of customers) {
                    insertStmt.run(c.id, c.created_at);
                }
            });

            transaction(activeCustomers);
            console.log(`Backfilled ${activeCustomers.length} active memberships.`);
        }

        // 6. Drop Deprecated Columns (payment_method)
        try {
            const tableInfo = this.db.pragma('table_info(payments)');
            const hasPaymentMethod = tableInfo.some(col => col.name === 'payment_method');
            if (hasPaymentMethod) {
                console.log('Migrating: Dropping deprecated column payment_method from payments...');
                this.db.exec('ALTER TABLE payments DROP COLUMN payment_method');
                console.log('Migration successful: payment_method dropped.');
            }
        } catch (error) {
            console.error('Migration warning: Could not drop payment_method column (requires SQLite 3.35+). Ignoring if older.', error);
        }

        // 7. Schema Updates (Migrations)
        this.safeAddColumn('customers', 'tariff_id', 'INTEGER REFERENCES tariffs(id)');
        this.safeAddColumn('tariffs', 'color_theme', 'TEXT DEFAULT "emerald"');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                muscle_group TEXT,
                video_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mesocycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
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
                mesocycle_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                day_group TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (mesocycle_id) REFERENCES mesocycles (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS routine_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                customer_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                public_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
            );
        `);

        this.safeAddColumn('payments', 'tariff_name', 'TEXT');

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
        this.safeAddColumn('routine_items', 'intensity', 'TEXT');

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
            require('../services/seed.service').init();
        } catch (err) {
            console.error('Seeding failed:', err);
        }

        console.log('Database initialized successfully.');


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
    }

    safeAddColumn(tableName, columnName, columnDef) {
        try {
            const tableInfo = this.db.pragma(`table_info(${tableName})`);
            const hasColumn = tableInfo.some(col => col.name === columnName);

            if (!hasColumn) {
                console.log(`Migrating: Adding ${columnName} to ${tableName}...`);
                this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
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
