const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_NAME = 'test_gym_data.db';
const dbPath = path.join(process.cwd(), DB_NAME);

console.log('--- Generando base de datos de prueba ---');
console.log('Ruta:', dbPath);

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Schema Implementation
db.exec(`
    CREATE TABLE tariffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        color_theme TEXT DEFAULT "emerald"
    );

    CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        active INTEGER DEFAULT 1,
        tariff_id INTEGER REFERENCES tariffs(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE exercise_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT NOT NULL,
        is_system INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE exercise_subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES exercise_categories (id) ON DELETE CASCADE,
        UNIQUE(category_id, name)
    );

    CREATE TABLE exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subcategory_id INTEGER,
        name TEXT NOT NULL,
        video_url TEXT,
        notes TEXT,
        default_sets INTEGER DEFAULT 4,
        default_reps TEXT,
        is_failure INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subcategory_id) REFERENCES exercise_subcategories (id) ON DELETE CASCADE
    );

    CREATE TABLE memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    );

    CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        tariff_name TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    );

    CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// 1. Seed Tariffs
const insertTariff = db.prepare('INSERT INTO tariffs (name, amount, color_theme) VALUES (?, ?, ?)');
insertTariff.run('Básico', 30, 'blue');
insertTariff.run('Premium', 50, 'emerald');
insertTariff.run('VIP Platinum', 90, 'indigo');

// 2. Seed Categories & Subcategories
const insertCat = db.prepare('INSERT INTO exercise_categories (name, icon, is_system) VALUES (?, ?, 1)');
const insertSub = db.prepare('INSERT INTO exercise_subcategories (category_id, name) VALUES (?, ?)');

const categories = [
    { name: 'Musculación', icon: 'Dumbbell', subs: ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Abdomen', 'Glúteo'] },
    { name: 'Cardio', icon: 'Heart', subs: ['Running', 'Cycling', 'HIIT'] },
    { name: 'Funcional', icon: 'Activity', subs: ['Cross Training', 'Core', 'Stretching'] }
];

for (const cat of categories) {
    const res = insertCat.run(cat.name, cat.icon);
    const catId = res.lastInsertRowid;
    for (const sub of cat.subs) {
        insertSub.run(catId, sub);
    }
}

// 3. Seed Random Customers
const names = ['Juan', 'Maria', 'Pedro', 'Lucia', 'Carlos', 'Ana', 'Diego', 'Elena', 'Felipe', 'Sonia', 'Roberto', 'Laura', 'Gabriel', 'Marta', 'Ignacio', 'Isabel'];
const lastNames = ['Garcia', 'Rodriguez', 'Lopez', 'Martinez', 'Perez', 'Sanchez', 'Gonzalez', 'Gomez', 'Fernandez', 'Moreno', 'Jimenez', 'Alvarez', 'Ruiz'];

const insertCustomer = db.prepare('INSERT INTO customers (first_name, last_name, email, phone, active, tariff_id) VALUES (?, ?, ?, ?, ?, ?)');
const insertMembership = db.prepare('INSERT INTO memberships (customer_id, start_date) VALUES (?, ?)');

for (let i = 0; i < 20; i++) {
    const fn = names[Math.floor(Math.random() * names.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${Math.floor(Math.random() * 99)}@example.com`;
    const phone = `6${Math.floor(Math.random() * 89999999 + 10000000)}`;
    const active = Math.random() > 0.2 ? 1 : 0;
    const tariffId = Math.floor(Math.random() * 3) + 1;

    const res = insertCustomer.run(fn, ln, email, phone, active, tariffId);
    insertMembership.run(res.lastInsertRowid, new Date().toISOString());
}

// 4. Seed Random Exercises
const subIds = db.prepare('SELECT id, name FROM exercise_subcategories').all();
const insertExercise = db.prepare('INSERT INTO exercises (subcategory_id, name, default_sets, default_reps, is_failure) VALUES (?, ?, ?, ?, ?)');

const exerciseNames = {
    'Pecho': ['Press Banca', 'Press Inclinado Manuernas', 'Aperturas', 'Flexiones', 'Cruces Polea'],
    'Espalda': ['Dominadas', 'Remo con Barra', 'Jalón al Pecho', 'Remo Gironda', 'Peso Muerto'],
    'Hombro': ['Press Militar', 'Elevaciones Laterales', 'Pájaros', 'Facepull'],
    'Bíceps': ['Curl Barra', 'Curl Martillo', 'Curl Concentrado', 'Curl Predicador'],
    'Tríceps': ['Extensión Polea', 'Press Francés', 'Fondos', 'Extensión tras nuca'],
    'Pierna': ['Sentadilla', 'Prensa', 'Extensión Cuádriceps', 'Curl Femoral', 'Zancadas'],
    'Abdomen': ['Crunch', 'Plancha', 'Elevación de Piernas'],
    'Glúteo': ['Hip Thrust', 'Patada Glúteo', 'Abductores']
};

for (const sub of subIds) {
    const list = exerciseNames[sub.name] || [`Ejercicio ${sub.name} 1`, `Ejercicio ${sub.name} 2`];
    for (const exName of list) {
        insertExercise.run(
            sub.id,
            exName,
            Math.floor(Math.random() * 3) + 3,
            '10-12',
            Math.random() > 0.8 ? 1 : 0
        );
    }
}

db.close();
console.log('--- Base de Datos generada con éxito: test_gym_data.db ---');
