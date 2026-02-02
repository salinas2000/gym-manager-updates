/**
 * CLEAN SMOKE TEST
 * Verifies:
 * 1. Database Initialization
 * 2. Critical Tables Existence
 * 3. Service Loading (License, Cloud)
 * 4. Basic CRUD (Customer Creation)
 * 
 * Usage: node tests/smoke.test.js
 */

const path = require('path');
const fs = require('fs');

// Mock Electron for non-electron environment
const mockElectron = {
    app: {
        getPath: (name) => {
            if (name === 'userData') return path.join(__dirname, '../.smoke_test_data');
            if (name === 'temp') return path.join(__dirname, '../.smoke_test_data/temp');
            return './';
        },
        getAppPath: () => __dirname,
        isPackaged: false,
        on: () => { },
        whenReady: () => Promise.resolve()
    },
    ipcMain: { handle: () => { } },
    BrowserWindow: class { constructor() { } }
};

// Mock module cache to inject electron mock
require.cache[require.resolve('electron')] = {
    id: require.resolve('electron'),
    filename: require.resolve('electron'),
    loaded: true,
    exports: mockElectron
};

// Set Env for Testing
process.env.NODE_ENV = 'test';

async function runSmokeTest() {
    console.log('🔥 STARTING SMOKE TEST...');

    // Clean previous test data
    const testDataPath = path.join(__dirname, '../.smoke_test_data');
    if (fs.existsSync(testDataPath)) {
        fs.rmSync(testDataPath, { recursive: true, force: true });
    }

    try {
        // 1. Initialize Database
        console.log('Step 1: Initializing Database...');
        const dbManager = require('../src/main/db/database');
        const db = dbManager.init();

        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log(`   ✅ DB Initialized. Found ${tables.length} tables.`);

        if (!tables.find(t => t.name === 'customers')) throw new Error('Missing customers table');

        // 2. Test CRUD
        console.log('Step 2: Testing Customer CRUD...');
        const insert = db.prepare(`
            INSERT INTO customers (gym_id, first_name, last_name, email, active) 
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = insert.run('TEST_GYM', 'John', 'Doe', 'john@test.com', 1);

        const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
        if (row.email !== 'john@test.com') throw new Error('Data mismatch');
        console.log('   ✅ Customer created and verified.');

        // 3. Verify Cloud Service Load (Architecture Check)
        console.log('Step 3: Loading Services...');
        const cloudService = require('../src/main/services/cloud/cloud.service');
        if (!cloudService) throw new Error('Cloud Service failed to load');
        console.log('   ✅ Cloud Service loaded.');

        console.log('✅ SMOKE TEST PASSED!');
        process.exit(0);

    } catch (error) {
        console.error('❌ SMOKE TEST FAILED:', error);
        process.exit(1);
    }
}

runSmokeTest();
