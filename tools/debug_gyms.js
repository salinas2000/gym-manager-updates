const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'gym-manager-pro', 'gym_manager.db');

console.log('Using DB at:', dbPath);

try {
    const db = new Database(dbPath);

    console.log('\n--- CUSTOMERS DISTRIBUTION BY GYM_ID ---');
    const customers = db.prepare('SELECT gym_id, active, COUNT(*) as count FROM customers GROUP BY gym_id, active').all();
    console.table(customers);

    console.log('\n--- TARIFFS DISTRIBUTION BY GYM_ID ---');
    const tariffs = db.prepare('SELECT gym_id, COUNT(*) as count FROM tariffs GROUP BY gym_id').all();
    console.table(tariffs);

    console.log('\n--- PAYMENTS DISTRIBUTION BY GYM_ID ---');
    const payments = db.prepare('SELECT gym_id, COUNT(*) as count FROM payments GROUP BY gym_id').all();
    console.table(payments);

    db.close();
} catch (e) {
    console.error('Error:', e.message);
}
