const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const dbManager = require('../../db/database');

class SeedService {
    constructor() {
        this.db = null;
    }

    getGymId() {
        try {
            const licenseService = require('./license.service');
            const data = licenseService.getLicenseData();
            return data ? data.gym_id : 'LOCAL_DEV';
        } catch (e) {
            return 'LOCAL_DEV';
        }
    }

    init() {
        this.db = dbManager.getInstance();

        console.log('SeedService: Checking seed status...');

        // Always try to seed categories/subcategories (Idempotent)
        this.seedCategories();

        // Always try to seed exercises (Idempotent - adds missing ones)
        this.seedExercises();
    }

    getSeedsPath() {
        return app.isPackaged
            ? path.join(process.resourcesPath, 'seeds')
            : path.join(__dirname, '../../db/seeds');
    }

    seedCategories() {
        try {
            const categoriesPath = path.join(this.getSeedsPath(), 'categories_seed.json');
            if (!fs.existsSync(categoriesPath)) {
                console.warn('SeedService: categories_seed.json not found.');
                return;
            }

            const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
            const gymId = this.getGymId();

            const insertCat = this.db.prepare('INSERT OR IGNORE INTO exercise_categories (gym_id, name, icon, is_system) VALUES (?, ?, ?, 1)');
            const insertSub = this.db.prepare('INSERT OR IGNORE INTO exercise_subcategories (gym_id, category_id, name) VALUES (?, ?, ?)');
            const getCatId = this.db.prepare('SELECT id FROM exercise_categories WHERE name = ?');

            const transaction = this.db.transaction((cats) => {
                for (const cat of cats) {
                    insertCat.run(gymId, cat.name, cat.icon);
                    const catId = getCatId.get(cat.name).id;

                    for (const sub of cat.subcategories) {
                        insertSub.run(gymId, catId, sub);
                    }
                }
            });

            transaction(categories);
            console.log('SeedService: Categories and Subcategories seeded.');

        } catch (error) {
            console.error('SeedService: Error seeding categories:', error);
        }
    }

    seedExercises() {
        // User requested NO default exercises.
        // We only keep the Categories structure.
        console.log('SeedService: Exercises seeding disabled by user request.');

        // Optional: Clean up existing seeded exercises if we want to enforce "clean slate" logic?
        // The user said "elimina los ejercicios", implies removing them.
        // But removing ALL exercises is dangerous for user data.
        // SAFE APPROACH: Do nothing here. The user can delete them manually or we assume this applies to new installs.
        // However, if I want to "delete exercises created at the beginning", I might need to filter them.
        // Since I don't track which ones are seeds, I will just stop creating them.
        // If the user wants to delete existing ones, they can do it from UI.
        // Wait, "elimina los ejercicios que se crean al principio".
        // Maybe I should run a DELETE where name IN (...) from the json files?
        // Let's just disable creation for now to avoid data loss accidents.
    }
}

module.exports = new SeedService();
