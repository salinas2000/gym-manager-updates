const dbManager = require('./src/main/db/database');

// Mock app properties for strict mode
const path = require('path');
const { app } = require('electron');

// We can't easily import database.js because it depends on 'app.getPath'.
// This is a common issue with Electron code in standalone scripts.
// We'll write a minimal script that uses better-sqlite3 directly for debugging.

const Database = require('better-sqlite3');
const fs = require('fs');

const userDataPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'gym-manager-pro')
    : path.join(process.env.HOME, 'Library/Application Support/gym-manager-pro'); // Rough guess for Mac, but user is Windows

const dbPath = path.join(userDataPath, 'gym_manager.db');

if (!fs.existsSync(dbPath)) {
    console.error("DB Not found at:", dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('--- CUSTOMERS ---');
const customers = db.prepare('SELECT * FROM customers').all();
console.table(customers);

console.log('\n--- PAYMENTS ---');
const payments = db.prepare(`
    SELECT p.id, c.first_name, p.amount, p.payment_method, p.payment_date 
    FROM payments p 
    JOIN customers c ON p.customer_id = c.id
`).all();
console.table(payments);
