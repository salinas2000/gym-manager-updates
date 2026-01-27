const { app } = require('electron');
const path = require('path');
const dbManager = require('./src/main/db/database');

async function run() {
    // Simulator userData path
    const userData = app.getPath('userData');
    dbManager.init(userData);

    const db = dbManager.getInstance();
    const c = db.prepare('SELECT * FROM customers WHERE id = 1').get();
    console.log('Customer 1:', c);

    app.quit();
}

app.whenReady().then(run);
