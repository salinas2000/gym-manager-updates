const { app } = require('electron');
const path = require('path');

// Simulate electron app for getting user data path
const userDataPath = 'C:\\Users\\franc\\AppData\\Roaming\\gym-manager-pro';

// Set up database path
const dbPath = path.join(userDataPath, 'gym_manager.db');
console.log('🔍 Database Path:', dbPath);

const Database = require('better-sqlite3');
const db = new Database(dbPath);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 ANALYTICS DEBUG REPORT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. Check License Data
console.log('1️⃣  LICENSE SERVICE CHECK');
try {
    const Store = require('electron-store');
    const { machineIdSync } = require('node-machine-id');
    const hwId = machineIdSync();
    const store = new Store({
        name: 'license_data',
        encryptionKey: `gym-manager-pro-${hwId}`,
        clearInvalidConfig: true
    });
    const licenseData = store.get('license');
    if (licenseData) {
        console.log('   ✅ License found');
        console.log('   📝 Gym ID from License:', licenseData.gym_id);
        console.log('   🏢 Gym Name:', licenseData.gym_name);
    } else {
        console.log('   ⚠️  No license found - will use gym_id: LOCAL_DEV');
    }
} catch (e) {
    console.log('   ❌ Error reading license:', e.message);
}

console.log('\n2️⃣  DATABASE GYM_IDs');
const gymIds = db.prepare('SELECT DISTINCT gym_id FROM customers').all();
console.log('   📋 Gym IDs in database:', gymIds.map(r => r.gym_id).join(', '));

console.log('\n3️⃣  ACTIVE CUSTOMERS');
const totalActive = db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1').get();
console.log('   👥 Total Active (all gyms):', totalActive.count);

gymIds.forEach(({ gym_id }) => {
    const count = db.prepare('SELECT COUNT(*) as count FROM customers WHERE active = 1 AND gym_id = ?').get(gym_id);
    console.log(`   👥 Active for gym_id="${gym_id}":`, count.count);
});

console.log('\n4️⃣  TARIFF DISTRIBUTION');
console.log('   📊 Distribution (ALL gyms):');
const distAll = db.prepare(`
    SELECT
        COALESCE(t.name, 'Sin Tarifa') as name,
        COUNT(c.id) as value
    FROM customers c
    LEFT JOIN tariffs t ON c.tariff_id = t.id
    WHERE c.active = 1
    GROUP BY COALESCE(t.id, -1)
`).all();
distAll.forEach(d => {
    console.log(`      ${d.name}: ${d.value}`);
});

gymIds.forEach(({ gym_id }) => {
    console.log(`\n   📊 Distribution for gym_id="${gym_id}":`);
    const dist = db.prepare(`
        SELECT
            COALESCE(t.name, 'Sin Tarifa') as name,
            COUNT(c.id) as value
        FROM customers c
        LEFT JOIN tariffs t ON c.tariff_id = t.id
        WHERE c.active = 1 AND c.gym_id = ?
        GROUP BY COALESCE(t.id, -1)
    `).all(gym_id);

    if (dist.length === 0) {
        console.log('      ⚠️  No data found');
    } else {
        dist.forEach(d => {
            console.log(`      ${d.name}: ${d.value}`);
        });
    }
});

console.log('\n5️⃣  REVENUE DATA');
const totalRevenue = db.prepare('SELECT COUNT(*) as count, SUM(amount) as total FROM payments').get();
console.log('   💰 Total Payments (all gyms):', totalRevenue.count, 'transactions,', totalRevenue.total, 'EUR');

gymIds.forEach(({ gym_id }) => {
    const revenue = db.prepare('SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE gym_id = ?').get(gym_id);
    console.log(`   💰 Payments for gym_id="${gym_id}":`, revenue.count, 'transactions,', revenue.total || 0, 'EUR');
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 DIAGNOSIS:');

try {
    const Store = require('electron-store');
    const { machineIdSync } = require('node-machine-id');
    const hwId = machineIdSync();
    const store = new Store({
        name: 'license_data',
        encryptionKey: `gym-manager-pro-${hwId}`,
        clearInvalidConfig: true
    });
    const licenseData = store.get('license');
    const expectedGymId = licenseData ? licenseData.gym_id : 'LOCAL_DEV';

    console.log(`Analytics service is looking for gym_id: "${expectedGymId}"`);

    const hasData = gymIds.some(g => g.gym_id === expectedGymId);
    if (!hasData) {
        console.log('❌ PROBLEM: No data exists for this gym_id!');
        console.log('\n💡 SOLUTIONS:');
        console.log('   1. Activate a license that matches one of these gym_ids:', gymIds.map(r => r.gym_id).join(', '));
        console.log('   2. Update existing data to match your license gym_id');
        console.log('   3. Remove gym_id filter from analytics queries (for development)');
    } else {
        console.log('✅ Data exists for this gym_id');
    }
} catch (e) {
    console.log('⚠️  Could not determine expected gym_id');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

db.close();
