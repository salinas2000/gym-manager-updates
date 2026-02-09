const Database = require('better-sqlite3');
const path = require('path');
const dbPath = 'C:\\Users\\franc\\AppData\\Roaming\\gym-manager-pro\\gym_manager.db';

try {
    const db = new Database(dbPath);
    console.log('--- TABLES ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(tables.map(t => t.name).join(', '));

    console.log('\n--- TARIFF DISTRIBUTION DEBUG ---');
    const activeCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE active = 1").get();
    console.log('Total Active Customers:', activeCount.count);

    const gymIdRes = db.prepare("SELECT DISTINCT gym_id FROM customers").all();
    console.log('Gym IDs in Customers:', gymIdRes.map(r => r.gym_id));

    const distribution = db.prepare(`
        SELECT
            COALESCE(t.name, 'Sin Tarifa') as name,
            COUNT(c.id) as value
        FROM customers c
        LEFT JOIN tariffs t ON c.tariff_id = t.id
        WHERE c.active = 1
        GROUP BY COALESCE(t.id, -1)
    `).all();
    console.log('Distribution (Ignoring gym_id):', JSON.stringify(distribution, null, 2));

    const gymId = gymIdRes.length > 0 ? gymIdRes[0].gym_id : 'LOCAL_DEV';
    const distributionWithGym = db.prepare(`
        SELECT
            COALESCE(t.name, 'Sin Tarifa') as name,
            COUNT(c.id) as value
        FROM customers c
        LEFT JOIN tariffs t ON c.tariff_id = t.id
        WHERE c.active = 1 AND c.gym_id = ?
        GROUP BY COALESCE(t.id, -1)
    `).all(gymId);
    console.log(`Distribution (For Gym ID ${gymId}):`, JSON.stringify(distributionWithGym, null, 2));

    db.close();
} catch (e) {
    console.error('Error:', e);
}
