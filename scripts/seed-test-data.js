#!/usr/bin/env node
/**
 * Seed Test Data - Carga datos masivos de prueba en la base de datos real
 *
 * Uso: npx electron scripts/seed-test-data.js
 *      npm run db:seed
 *
 * Genera:
 * - 10 tarifas
 * - 150 clientes (activos e inactivos)
 * - Membresías para cada cliente
 * - ~500 pagos distribuidos en el último año
 * - 10 categorías con subcategorías
 * - 80+ ejercicios
 * - 3 plantillas de entrenamiento
 * - 5 mesociclos asignados a clientes
 * - 15 productos de inventario
 * - 100+ movimientos de inventario
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- Localizar la DB real de la app ---
const APP_NAME = 'gym-manager-pro';
const userDataPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, APP_NAME)
    : path.join(os.homedir(), '.config', APP_NAME);

const dbPath = path.join(userDataPath, 'gym_manager.db');

if (!fs.existsSync(dbPath)) {
    console.error('ERROR: No se encontro la base de datos en:', dbPath);
    console.error('   Inicia la aplicacion al menos una vez antes de ejecutar este script.');
    process.exit(1);
}

// Backup antes de modificar
const backupPath = dbPath.replace('.db', `.backup-${Date.now()}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log('Backup creado en:', backupPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Helpers ---
const GYM_ID = (() => {
    try {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'gym_id'").get();
        return row?.value || 'LOCAL_DEV';
    } catch {
        return 'LOCAL_DEV';
    }
})();

console.log('🏋️ Gym ID:', GYM_ID);

function randomDate(start, end) {
    const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return d.toISOString().split('T')[0];
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = [
    'Carlos', 'María', 'Juan', 'Ana', 'Pedro', 'Laura', 'Miguel', 'Sofía', 'David', 'Elena',
    'Javier', 'Carmen', 'Antonio', 'Isabel', 'Manuel', 'Lucía', 'Francisco', 'Marta', 'Alejandro', 'Paula',
    'Roberto', 'Cristina', 'Fernando', 'Raquel', 'Pablo', 'Natalia', 'Sergio', 'Andrea', 'Diego', 'Sara',
    'Adrián', 'Claudia', 'Álvaro', 'Marina', 'Héctor', 'Patricia', 'Rubén', 'Beatriz', 'Daniel', 'Alicia',
    'Jorge', 'Irene', 'Óscar', 'Eva', 'Raúl', 'Silvia', 'Marcos', 'Nuria', 'Iván', 'Lorena'
];

const LAST_NAMES = [
    'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez',
    'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Moreno', 'Jiménez',
    'Álvarez', 'Romero', 'Muñoz', 'Navarro', 'Domínguez', 'Vázquez', 'Gil', 'Serrano',
    'Blanco', 'Molina', 'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz',
    'Rubio', 'Marín', 'Medina', 'Iglesias', 'Castillo', 'Santos', 'Guerrero'
];

// ==========================================
// 1. TARIFAS
// ==========================================
console.log('\n📋 Creando tarifas...');

const tariffs = [
    { name: 'Básica', amount: 25, color_theme: 'slate' },
    { name: 'Estándar', amount: 35, color_theme: 'blue' },
    { name: 'Premium', amount: 50, color_theme: 'purple' },
    { name: 'VIP', amount: 75, color_theme: 'amber' },
    { name: 'Estudiante', amount: 20, color_theme: 'emerald' },
    { name: 'Familiar', amount: 60, color_theme: 'rose' },
    { name: 'Trimestral', amount: 90, color_theme: 'cyan' },
    { name: 'Semestral', amount: 160, color_theme: 'indigo' },
    { name: 'Anual', amount: 280, color_theme: 'teal' },
    { name: 'Día Suelto', amount: 8, color_theme: 'orange' },
];

const insertTariff = db.prepare(`
    INSERT INTO tariffs (gym_id, name, amount, color_theme, synced)
    VALUES (?, ?, ?, ?, 0)
`);

const tariffIds = [];
const seedTariffs = db.transaction(() => {
    for (const t of tariffs) {
        const info = insertTariff.run(GYM_ID, t.name, t.amount, t.color_theme);
        tariffIds.push(info.lastInsertRowid);
    }
});
seedTariffs();
console.log(`   ✅ ${tariffIds.length} tarifas creadas`);

// ==========================================
// 2. CLIENTES
// ==========================================
console.log('\n👥 Creando clientes...');

const insertCustomer = db.prepare(`
    INSERT INTO customers (gym_id, first_name, last_name, email, phone, tariff_id, active, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
`);

const customerIds = [];
const usedEmails = new Set();

const seedCustomers = db.transaction(() => {
    for (let i = 0; i < 150; i++) {
        const firstName = randomChoice(FIRST_NAMES);
        const lastName = randomChoice(LAST_NAMES);
        let email = `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}${i}@email.com`;

        if (usedEmails.has(email)) {
            email = `${firstName.toLowerCase()}${i}${Date.now() % 1000}@email.com`;
        }
        usedEmails.add(email);

        const phone = `6${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(100, 999)}`;
        const isActive = Math.random() > 0.2 ? 1 : 0; // 80% activos
        const tariffId = randomChoice(tariffIds);
        const createdAt = randomDate(new Date('2024-01-01'), new Date('2026-03-01'));

        const info = insertCustomer.run(GYM_ID, firstName, lastName, email, phone, tariffId, isActive, createdAt);
        customerIds.push({ id: info.lastInsertRowid, active: isActive, tariffId, createdAt });
    }
});
seedCustomers();
console.log(`   ✅ ${customerIds.length} clientes creados (${customerIds.filter(c => c.active).length} activos)`);

// ==========================================
// 3. MEMBRESÍAS
// ==========================================
console.log('\n📅 Creando membresías...');

const insertMembership = db.prepare(`
    INSERT INTO memberships (gym_id, customer_id, start_date, end_date, synced)
    VALUES (?, ?, ?, ?, 0)
`);

let membershipCount = 0;
const seedMemberships = db.transaction(() => {
    for (const customer of customerIds) {
        const createdDate = new Date(customer.createdAt);

        // Primer período desde la fecha de creación
        let periodStart = new Date(createdDate);
        const periodsCount = randomInt(1, 4);

        for (let p = 0; p < periodsCount; p++) {
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + randomInt(1, 6));

            // El último período de un cliente activo no tiene fecha fin
            const isLastPeriod = p === periodsCount - 1;
            const endDate = (isLastPeriod && customer.active) ? null : periodEnd.toISOString().split('T')[0];

            // Solo crear si el período no está en el futuro lejano
            if (periodStart <= new Date()) {
                insertMembership.run(
                    GYM_ID,
                    customer.id,
                    periodStart.toISOString().split('T')[0],
                    endDate
                );
                membershipCount++;
            }

            // Siguiente período empieza donde termina este (o con gap)
            periodStart = new Date(periodEnd);
            periodStart.setDate(periodStart.getDate() + randomInt(0, 30));
        }
    }
});
seedMemberships();
console.log(`   ✅ ${membershipCount} membresías creadas`);

// ==========================================
// 4. PAGOS
// ==========================================
console.log('\n💰 Creando pagos...');

const insertPayment = db.prepare(`
    INSERT INTO payments (gym_id, customer_id, amount, payment_date, tariff_name)
    VALUES (?, ?, ?, ?, ?)
`);

const tariffMap = {};
for (const t of tariffs) {
    const row = db.prepare('SELECT id FROM tariffs WHERE name = ? AND gym_id = ?').get(t.name, GYM_ID);
    if (row) tariffMap[row.id] = t;
}

let paymentCount = 0;
const seedPayments = db.transaction(() => {
    for (const customer of customerIds) {
        const tariff = tariffMap[customer.tariffId];
        if (!tariff) continue;

        const startDate = new Date(customer.createdAt);
        const now = new Date();
        let payDate = new Date(startDate);

        // Generar pagos mensuales desde la fecha de creación
        while (payDate <= now) {
            // Algo de variabilidad: 90% paga, 10% falta
            if (Math.random() > 0.1) {
                const amount = tariff.amount + (Math.random() > 0.9 ? randomInt(-5, 10) : 0);
                insertPayment.run(
                    GYM_ID,
                    customer.id,
                    Math.max(0, amount),
                    payDate.toISOString().split('T')[0],
                    tariff.name
                );
                paymentCount++;
            }
            payDate.setMonth(payDate.getMonth() + 1);
        }
    }
});
seedPayments();
console.log(`   ✅ ${paymentCount} pagos creados`);

// ==========================================
// 5. CATEGORÍAS Y EJERCICIOS
// ==========================================
console.log('\n🏋️ Creando categorías y ejercicios...');

const categoriesData = [
    {
        name: 'Pecho', icon: '💪',
        subcategories: ['Press banca', 'Press inclinado', 'Aperturas', 'Fondos'],
        exercises: [
            { name: 'Press banca con barra', sub: 'Press banca', sets: 4, reps: '8-10' },
            { name: 'Press banca con mancuernas', sub: 'Press banca', sets: 4, reps: '10-12' },
            { name: 'Press inclinado con barra', sub: 'Press inclinado', sets: 4, reps: '8-10' },
            { name: 'Press inclinado con mancuernas', sub: 'Press inclinado', sets: 3, reps: '10-12' },
            { name: 'Aperturas con mancuernas', sub: 'Aperturas', sets: 3, reps: '12-15' },
            { name: 'Aperturas en polea (crossover)', sub: 'Aperturas', sets: 3, reps: '12-15' },
            { name: 'Fondos en paralelas (pecho)', sub: 'Fondos', sets: 3, reps: '8-12' },
            { name: 'Press en máquina', sub: 'Press banca', sets: 3, reps: '10-12' },
        ]
    },
    {
        name: 'Espalda', icon: '🔙',
        subcategories: ['Dominadas', 'Remo', 'Jalón', 'Peso muerto'],
        exercises: [
            { name: 'Dominadas pronas', sub: 'Dominadas', sets: 4, reps: '6-10' },
            { name: 'Dominadas supinas', sub: 'Dominadas', sets: 3, reps: '8-10' },
            { name: 'Remo con barra', sub: 'Remo', sets: 4, reps: '8-10' },
            { name: 'Remo con mancuerna', sub: 'Remo', sets: 3, reps: '10-12' },
            { name: 'Remo en polea baja', sub: 'Remo', sets: 3, reps: '10-12' },
            { name: 'Jalón al pecho', sub: 'Jalón', sets: 4, reps: '10-12' },
            { name: 'Jalón tras nuca', sub: 'Jalón', sets: 3, reps: '10-12' },
            { name: 'Peso muerto convencional', sub: 'Peso muerto', sets: 4, reps: '5-8' },
            { name: 'Peso muerto rumano', sub: 'Peso muerto', sets: 3, reps: '8-10' },
        ]
    },
    {
        name: 'Hombros', icon: '🏋️',
        subcategories: ['Press militar', 'Elevaciones laterales', 'Elevaciones frontales', 'Pájaros'],
        exercises: [
            { name: 'Press militar con barra', sub: 'Press militar', sets: 4, reps: '6-10' },
            { name: 'Press militar con mancuernas', sub: 'Press militar', sets: 3, reps: '8-12' },
            { name: 'Elevaciones laterales con mancuernas', sub: 'Elevaciones laterales', sets: 4, reps: '12-15' },
            { name: 'Elevaciones laterales en polea', sub: 'Elevaciones laterales', sets: 3, reps: '12-15' },
            { name: 'Elevaciones frontales', sub: 'Elevaciones frontales', sets: 3, reps: '12-15' },
            { name: 'Pájaros (deltoides posterior)', sub: 'Pájaros', sets: 3, reps: '12-15' },
            { name: 'Face pull', sub: 'Pájaros', sets: 3, reps: '15-20' },
        ]
    },
    {
        name: 'Bíceps', icon: '💪',
        subcategories: ['Curl barra', 'Curl mancuernas', 'Curl martillo', 'Curl concentrado'],
        exercises: [
            { name: 'Curl con barra recta', sub: 'Curl barra', sets: 3, reps: '8-12' },
            { name: 'Curl con barra Z', sub: 'Curl barra', sets: 3, reps: '10-12' },
            { name: 'Curl alterno con mancuernas', sub: 'Curl mancuernas', sets: 3, reps: '10-12' },
            { name: 'Curl martillo', sub: 'Curl martillo', sets: 3, reps: '10-12' },
            { name: 'Curl concentrado', sub: 'Curl concentrado', sets: 3, reps: '10-12' },
            { name: 'Curl en polea', sub: 'Curl barra', sets: 3, reps: '12-15' },
        ]
    },
    {
        name: 'Tríceps', icon: '💪',
        subcategories: ['Extensiones polea', 'Press francés', 'Fondos', 'Patada de tríceps'],
        exercises: [
            { name: 'Extensiones en polea alta', sub: 'Extensiones polea', sets: 3, reps: '10-15' },
            { name: 'Extensiones en polea con cuerda', sub: 'Extensiones polea', sets: 3, reps: '12-15' },
            { name: 'Press francés con barra Z', sub: 'Press francés', sets: 3, reps: '8-12' },
            { name: 'Press francés con mancuernas', sub: 'Press francés', sets: 3, reps: '10-12' },
            { name: 'Fondos en banco', sub: 'Fondos', sets: 3, reps: '10-15' },
            { name: 'Patada de tríceps', sub: 'Patada de tríceps', sets: 3, reps: '12-15' },
        ]
    },
    {
        name: 'Piernas', icon: '🦵',
        subcategories: ['Sentadilla', 'Prensa', 'Extensiones', 'Curl femoral', 'Zancadas'],
        exercises: [
            { name: 'Sentadilla con barra', sub: 'Sentadilla', sets: 4, reps: '6-10' },
            { name: 'Sentadilla frontal', sub: 'Sentadilla', sets: 3, reps: '8-10' },
            { name: 'Sentadilla búlgara', sub: 'Sentadilla', sets: 3, reps: '10-12' },
            { name: 'Prensa de piernas', sub: 'Prensa', sets: 4, reps: '10-12' },
            { name: 'Extensiones de cuádriceps', sub: 'Extensiones', sets: 3, reps: '12-15' },
            { name: 'Curl femoral tumbado', sub: 'Curl femoral', sets: 3, reps: '10-12' },
            { name: 'Curl femoral sentado', sub: 'Curl femoral', sets: 3, reps: '10-12' },
            { name: 'Zancadas con mancuernas', sub: 'Zancadas', sets: 3, reps: '12 c/l' },
            { name: 'Gemelos en máquina', sub: 'Extensiones', sets: 4, reps: '15-20' },
        ]
    },
    {
        name: 'Glúteos', icon: '🍑',
        subcategories: ['Hip thrust', 'Patada glúteo', 'Puente de glúteos', 'Abducción'],
        exercises: [
            { name: 'Hip thrust con barra', sub: 'Hip thrust', sets: 4, reps: '8-12' },
            { name: 'Hip thrust en máquina', sub: 'Hip thrust', sets: 3, reps: '10-12' },
            { name: 'Patada de glúteo en polea', sub: 'Patada glúteo', sets: 3, reps: '12-15' },
            { name: 'Puente de glúteos', sub: 'Puente de glúteos', sets: 3, reps: '15-20' },
            { name: 'Abducción en máquina', sub: 'Abducción', sets: 3, reps: '15-20' },
        ]
    },
    {
        name: 'Core', icon: '🎯',
        subcategories: ['Plancha', 'Crunch', 'Elevación de piernas', 'Russian twist'],
        exercises: [
            { name: 'Plancha frontal', sub: 'Plancha', sets: 3, reps: '30-60s' },
            { name: 'Plancha lateral', sub: 'Plancha', sets: 3, reps: '30s c/l' },
            { name: 'Crunch abdominal', sub: 'Crunch', sets: 3, reps: '15-20' },
            { name: 'Crunch en polea', sub: 'Crunch', sets: 3, reps: '12-15' },
            { name: 'Elevación de piernas colgado', sub: 'Elevación de piernas', sets: 3, reps: '10-15' },
            { name: 'Russian twist', sub: 'Russian twist', sets: 3, reps: '20' },
            { name: 'Ab wheel', sub: 'Crunch', sets: 3, reps: '10-15' },
        ]
    },
    {
        name: 'Cardio', icon: '❤️',
        subcategories: ['Cinta', 'Bicicleta', 'Elíptica', 'Remo', 'HIIT'],
        exercises: [
            { name: 'Cinta de correr', sub: 'Cinta', sets: 1, reps: '20-30min' },
            { name: 'Bicicleta estática', sub: 'Bicicleta', sets: 1, reps: '20-30min' },
            { name: 'Elíptica', sub: 'Elíptica', sets: 1, reps: '20-30min' },
            { name: 'Remo ergómetro', sub: 'Remo', sets: 1, reps: '15-20min' },
            { name: 'HIIT en bicicleta', sub: 'HIIT', sets: 1, reps: '15-20min' },
        ]
    },
    {
        name: 'Funcional', icon: '⚡',
        subcategories: ['Kettlebell', 'TRX', 'Battle ropes', 'Box jumps'],
        exercises: [
            { name: 'Swing con kettlebell', sub: 'Kettlebell', sets: 4, reps: '15-20' },
            { name: 'Turkish get-up', sub: 'Kettlebell', sets: 3, reps: '5 c/l' },
            { name: 'TRX row', sub: 'TRX', sets: 3, reps: '12-15' },
            { name: 'TRX push-up', sub: 'TRX', sets: 3, reps: '10-15' },
            { name: 'Battle ropes', sub: 'Battle ropes', sets: 4, reps: '30s' },
            { name: 'Box jumps', sub: 'Box jumps', sets: 3, reps: '10-12' },
        ]
    }
];

const insertCat = db.prepare('INSERT OR IGNORE INTO exercise_categories (gym_id, name, icon, is_system) VALUES (?, ?, ?, 1)');
const insertSub = db.prepare('INSERT OR IGNORE INTO exercise_subcategories (gym_id, category_id, name) VALUES (?, ?, ?)');
const getCatId = db.prepare('SELECT id FROM exercise_categories WHERE name = ? AND gym_id = ?');
const getSubId = db.prepare('SELECT id FROM exercise_subcategories WHERE name = ? AND category_id = ?');
const insertExercise = db.prepare(`
    INSERT INTO exercises (gym_id, subcategory_id, name, category, default_sets, default_reps, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

let exerciseCount = 0;
const exerciseIds = [];

const seedExercises = db.transaction(() => {
    for (const cat of categoriesData) {
        insertCat.run(GYM_ID, cat.name, cat.icon);
        const catRow = getCatId.get(cat.name, GYM_ID);
        if (!catRow) continue;

        for (const sub of cat.subcategories) {
            insertSub.run(GYM_ID, catRow.id, sub);
        }

        for (const ex of cat.exercises) {
            const subRow = getSubId.get(ex.sub, catRow.id);
            if (!subRow) continue;

            const info = insertExercise.run(GYM_ID, subRow.id, ex.name, cat.name, ex.sets, ex.reps);
            exerciseIds.push(info.lastInsertRowid);
            exerciseCount++;
        }
    }
});
seedExercises();
console.log(`   ✅ ${categoriesData.length} categorías con subcategorías`);
console.log(`   ✅ ${exerciseCount} ejercicios creados`);

// ==========================================
// 5.5 EXERCISE FIELD CONFIGS (campos personalizados)
// ==========================================
console.log('\n⚙️  Creando campos de ejercicio...');

const fieldConfigs = [
    { key: 'series', label: 'Series', type: 'number', is_active: 1, is_mandatory: 1 },
    { key: 'repeticiones', label: 'Repeticiones', type: 'text', is_active: 1, is_mandatory: 1 },
    { key: 'peso', label: 'Peso (kg)', type: 'text', is_active: 1, is_mandatory: 0 },
    { key: 'descanso', label: 'Descanso (seg)', type: 'text', is_active: 1, is_mandatory: 0 },
    { key: 'rir', label: 'RIR', type: 'number', is_active: 1, is_mandatory: 0 },
    { key: 'tempo', label: 'Tempo', type: 'text', is_active: 1, is_mandatory: 0 },
];

const insertFieldConfig = db.prepare(`
    INSERT OR IGNORE INTO exercise_field_config (gym_id, field_key, label, type, is_active, is_mandatory_in_template, options, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
`);

const seedFieldConfigs = db.transaction(() => {
    for (const fc of fieldConfigs) {
        insertFieldConfig.run(GYM_ID, fc.key, fc.label, fc.type, fc.is_active, fc.is_mandatory);
    }
});
seedFieldConfigs();
console.log(`   ✅ ${fieldConfigs.length} campos configurados`);

// Update exercises with custom_fields values
const updateExFields = db.prepare('UPDATE exercises SET custom_fields = ? WHERE id = ?');
const seedExerciseFields = db.transaction(() => {
    for (const exId of exerciseIds) {
        const ex = db.prepare('SELECT default_sets, default_reps FROM exercises WHERE id = ?').get(exId);
        if (!ex) continue;

        const fields = {
            series: ex.default_sets || randomInt(3, 5),
            repeticiones: ex.default_reps || `${randomInt(8, 15)}`,
            peso: `${randomInt(10, 80)}`,
            descanso: `${randomChoice([60, 90, 120, 150, 180])}`,
            rir: randomInt(1, 4),
        };
        updateExFields.run(JSON.stringify(fields), exId);
    }
});
seedExerciseFields();
console.log(`   ✅ ${exerciseIds.length} ejercicios actualizados con campos`);

// ==========================================
// 6. PLANTILLAS DE ENTRENAMIENTO
// ==========================================
console.log('\n📝 Creando plantillas de entrenamiento...');

const templates = [
    {
        name: 'Push/Pull/Legs (PPL)',
        days: 6,
        routines: [
            { name: 'Push A', day: 'Lunes', exercises: ['Press banca con barra', 'Press inclinado con mancuernas', 'Press militar con mancuernas', 'Elevaciones laterales con mancuernas', 'Extensiones en polea alta'] },
            { name: 'Pull A', day: 'Martes', exercises: ['Dominadas pronas', 'Remo con barra', 'Jalón al pecho', 'Curl con barra recta', 'Face pull'] },
            { name: 'Legs A', day: 'Miércoles', exercises: ['Sentadilla con barra', 'Prensa de piernas', 'Curl femoral tumbado', 'Extensiones de cuádriceps', 'Gemelos en máquina'] },
            { name: 'Push B', day: 'Jueves', exercises: ['Press banca con mancuernas', 'Aperturas en polea (crossover)', 'Press militar con barra', 'Elevaciones laterales en polea', 'Extensiones en polea con cuerda'] },
            { name: 'Pull B', day: 'Viernes', exercises: ['Jalón al pecho', 'Remo con mancuerna', 'Remo en polea baja', 'Curl alterno con mancuernas', 'Curl martillo'] },
            { name: 'Legs B', day: 'Sábado', exercises: ['Sentadilla frontal', 'Hip thrust con barra', 'Zancadas con mancuernas', 'Curl femoral sentado', 'Abducción en máquina'] },
        ]
    },
    {
        name: 'Upper/Lower (4 días)',
        days: 4,
        routines: [
            { name: 'Upper A', day: 'Lunes', exercises: ['Press banca con barra', 'Remo con barra', 'Press militar con mancuernas', 'Curl con barra recta', 'Extensiones en polea alta'] },
            { name: 'Lower A', day: 'Martes', exercises: ['Sentadilla con barra', 'Peso muerto rumano', 'Prensa de piernas', 'Gemelos en máquina', 'Plancha frontal'] },
            { name: 'Upper B', day: 'Jueves', exercises: ['Press inclinado con mancuernas', 'Dominadas pronas', 'Elevaciones laterales con mancuernas', 'Curl martillo', 'Press francés con barra Z'] },
            { name: 'Lower B', day: 'Viernes', exercises: ['Peso muerto convencional', 'Hip thrust con barra', 'Sentadilla búlgara', 'Curl femoral tumbado', 'Ab wheel'] },
        ]
    },
    {
        name: 'Full Body (3 días)',
        days: 3,
        routines: [
            { name: 'Full Body A', day: 'Lunes', exercises: ['Sentadilla con barra', 'Press banca con barra', 'Remo con barra', 'Press militar con mancuernas', 'Plancha frontal'] },
            { name: 'Full Body B', day: 'Miércoles', exercises: ['Peso muerto convencional', 'Press inclinado con mancuernas', 'Jalón al pecho', 'Hip thrust con barra', 'Crunch en polea'] },
            { name: 'Full Body C', day: 'Viernes', exercises: ['Prensa de piernas', 'Press banca con mancuernas', 'Dominadas pronas', 'Elevaciones laterales con mancuernas', 'Elevación de piernas colgado'] },
        ]
    }
];

const insertMeso = db.prepare(`
    INSERT INTO mesocycles (gym_id, customer_id, name, start_date, end_date, active, is_template, days_per_week, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
`);
const insertRoutine = db.prepare(`
    INSERT INTO routines (gym_id, mesocycle_id, name, day_group)
    VALUES (?, ?, ?, ?)
`);
const insertItem = db.prepare(`
    INSERT INTO routine_items (gym_id, routine_id, exercise_id, series, reps, order_index, custom_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const getExerciseByName = db.prepare('SELECT id, default_sets, default_reps, custom_fields FROM exercises WHERE name = ? AND gym_id = ?');

let templateCount = 0;
const seedTemplates = db.transaction(() => {
    for (const tmpl of templates) {
        const mesoInfo = insertMeso.run(GYM_ID, null, tmpl.name, null, null, 0, 1, tmpl.days);
        const mesoId = mesoInfo.lastInsertRowid;

        for (const routine of tmpl.routines) {
            const routineInfo = insertRoutine.run(GYM_ID, mesoId, routine.name, routine.day);
            const routineId = routineInfo.lastInsertRowid;

            routine.exercises.forEach((exName, idx) => {
                const ex = getExerciseByName.get(exName, GYM_ID);
                if (ex) {
                    insertItem.run(GYM_ID, routineId, ex.id, ex.default_sets, ex.default_reps, idx, ex.custom_fields || '{}');
                }
            });
        }
        templateCount++;
    }
});
seedTemplates();
console.log(`   ✅ ${templateCount} plantillas creadas`);

// ==========================================
// 7. MESOCICLOS ASIGNADOS A CLIENTES
// ==========================================
console.log('\n🎯 Asignando mesociclos a clientes...');

const activeCustomers = customerIds.filter(c => c.active);
let mesoAssignCount = 0;

const mesoNames = ['Hipertrofia', 'Fuerza', 'Definición', 'Volumen', 'Mantenimiento', 'Pretemporada'];

const seedMesocycles = db.transaction(() => {
    const selectedCustomers = activeCustomers.slice(0, 30);

    for (const customer of selectedCustomers) {
        // Cada cliente tiene entre 2 y 5 mesociclos encadenados
        const numMesos = randomInt(2, 5);
        let mesoStart = new Date('2025-06-01');
        mesoStart.setDate(mesoStart.getDate() + randomInt(0, 60));

        for (let m = 0; m < numMesos; m++) {
            const tmpl = randomChoice(templates);
            const durationWeeks = randomInt(3, 6);
            const mesoEnd = new Date(mesoStart);
            mesoEnd.setDate(mesoStart.getDate() + (durationWeeks * 7));

            const pad = n => String(n).padStart(2, '0');
            const startStr = `${mesoStart.getFullYear()}-${pad(mesoStart.getMonth() + 1)}-${pad(mesoStart.getDate())}`;
            const endStr = `${mesoEnd.getFullYear()}-${pad(mesoEnd.getMonth() + 1)}-${pad(mesoEnd.getDate())}`;

            // Solo el último mesociclo está activo
            const isActive = (m === numMesos - 1) ? 1 : 0;
            const label = randomChoice(mesoNames);

            const mesoInfo = insertMeso.run(
                GYM_ID, customer.id,
                `${label} - Fase ${m + 1}`,
                startStr, endStr,
                isActive, 0, tmpl.days
            );
            const mesoId = mesoInfo.lastInsertRowid;

            for (const routine of tmpl.routines) {
                const routineInfo = insertRoutine.run(GYM_ID, mesoId, routine.name, routine.day);
                const routineId = routineInfo.lastInsertRowid;

                routine.exercises.forEach((exName, idx) => {
                    const ex = getExerciseByName.get(exName, GYM_ID);
                    if (ex) {
                        const sets = ex.default_sets + randomInt(-1, 1);
                        insertItem.run(GYM_ID, routineId, ex.id, Math.max(1, sets), ex.default_reps, idx, ex.custom_fields || '{}');
                    }
                });
            }
            mesoAssignCount++;

            // Siguiente mesociclo empieza al día siguiente de terminar este
            mesoStart = new Date(mesoEnd);
            mesoStart.setDate(mesoStart.getDate() + randomInt(1, 7));
        }
    }
});
seedMesocycles();
console.log(`   ✅ ${mesoAssignCount} mesociclos asignados a ${Math.min(30, activeCustomers.length)} clientes (2-5 por cliente)`);

// ==========================================
// 8. PRODUCTOS DE INVENTARIO
// ==========================================
console.log('\n📦 Creando productos de inventario...');

const productCategories = [
    { name: 'Suplementos', description: 'Proteínas, creatina, etc.' },
    { name: 'Bebidas', description: 'Agua, isotónicas, etc.' },
    { name: 'Accesorios', description: 'Guantes, cinturones, etc.' },
    { name: 'Ropa', description: 'Camisetas, pantalones, etc.' },
];

const insertProdCat = db.prepare('INSERT INTO product_categories (gym_id, name, description, synced) VALUES (?, ?, ?, 0)');
const seedProdCats = db.transaction(() => {
    for (const cat of productCategories) {
        insertProdCat.run(GYM_ID, cat.name, cat.description);
    }
});
seedProdCats();

const products = [
    { name: 'Whey Protein 1kg', purchase_price: 25, sale_price: 38, stock: 30, min_stock: 5, category: 'Suplementos' },
    { name: 'Creatina Monohidrato 300g', purchase_price: 12, sale_price: 22, stock: 25, min_stock: 5, category: 'Suplementos' },
    { name: 'BCAA 300g', purchase_price: 15, sale_price: 25, stock: 15, min_stock: 3, category: 'Suplementos' },
    { name: 'Pre-Workout 250g', purchase_price: 18, sale_price: 30, stock: 12, min_stock: 3, category: 'Suplementos' },
    { name: 'Barrita Proteica (unidad)', purchase_price: 1.2, sale_price: 2.5, stock: 100, min_stock: 20, category: 'Suplementos' },
    { name: 'Agua mineral 500ml', purchase_price: 0.3, sale_price: 1, stock: 200, min_stock: 50, category: 'Bebidas' },
    { name: 'Bebida isotónica 500ml', purchase_price: 0.8, sale_price: 2, stock: 80, min_stock: 20, category: 'Bebidas' },
    { name: 'Batido proteico RTD', purchase_price: 2, sale_price: 3.5, stock: 40, min_stock: 10, category: 'Bebidas' },
    { name: 'Guantes de entrenamiento', purchase_price: 8, sale_price: 15, stock: 20, min_stock: 5, category: 'Accesorios' },
    { name: 'Cinturón de levantamiento', purchase_price: 15, sale_price: 28, stock: 10, min_stock: 3, category: 'Accesorios' },
    { name: 'Muñequeras (par)', purchase_price: 5, sale_price: 10, stock: 15, min_stock: 5, category: 'Accesorios' },
    { name: 'Shaker 700ml', purchase_price: 3, sale_price: 7, stock: 30, min_stock: 10, category: 'Accesorios' },
    { name: 'Camiseta Gym Logo', purchase_price: 8, sale_price: 18, stock: 25, min_stock: 5, category: 'Ropa' },
    { name: 'Pantalón corto', purchase_price: 10, sale_price: 20, stock: 15, min_stock: 5, category: 'Ropa' },
    { name: 'Toalla microfibra', purchase_price: 4, sale_price: 8, stock: 20, min_stock: 5, category: 'Accesorios' },
];

const insertProduct = db.prepare(`
    INSERT INTO products (gym_id, name, purchase_price, sale_price, stock, min_stock, category, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);

const productIds = [];
const seedProducts = db.transaction(() => {
    for (const p of products) {
        const info = insertProduct.run(GYM_ID, p.name, p.purchase_price, p.sale_price, p.stock, p.min_stock, p.category);
        productIds.push({ id: info.lastInsertRowid, ...p });
    }
});
seedProducts();
console.log(`   ✅ ${productIds.length} productos creados`);

// ==========================================
// 9. MOVIMIENTOS DE INVENTARIO
// ==========================================
console.log('\n📊 Creando movimientos de inventario...');

const insertOrder = db.prepare(`
    INSERT INTO inventory_orders (gym_id, product_id, customer_id, type, quantity, unit_cost, total_cost, notes, synced, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
`);

let orderCount = 0;
const seedOrders = db.transaction(() => {
    // Compras iniciales de stock
    for (const prod of productIds) {
        const qty = prod.stock;
        const date = randomDate(new Date('2025-06-01'), new Date('2025-12-31'));
        insertOrder.run(GYM_ID, prod.id, null, 'purchase', qty, prod.purchase_price, qty * prod.purchase_price, 'Stock inicial', date);
        orderCount++;
    }

    // Ventas distribuidas en el último año
    for (let i = 0; i < 150; i++) {
        const prod = randomChoice(productIds);
        const customer = randomChoice(activeCustomers);
        const qty = randomInt(1, 3);
        const date = randomDate(new Date('2025-07-01'), new Date('2026-03-20'));

        insertOrder.run(
            GYM_ID, prod.id, customer.id, 'sale', qty,
            prod.sale_price, qty * prod.sale_price,
            null, date
        );
        orderCount++;
    }

    // Algunas compras de reposición
    for (let i = 0; i < 20; i++) {
        const prod = randomChoice(productIds);
        const qty = randomInt(10, 50);
        const date = randomDate(new Date('2026-01-01'), new Date('2026-03-15'));

        insertOrder.run(
            GYM_ID, prod.id, null, 'purchase', qty,
            prod.purchase_price, qty * prod.purchase_price,
            'Reposición de stock', date
        );
        orderCount++;
    }
});
seedOrders();
console.log(`   ✅ ${orderCount} movimientos de inventario creados`);

// ==========================================
// RESUMEN FINAL
// ==========================================
db.close();

console.log('\n' + '='.repeat(50));
console.log('✅ SEED COMPLETADO');
console.log('='.repeat(50));
console.log(`   Tarifas:      ${tariffIds.length}`);
console.log(`   Clientes:     ${customerIds.length} (${customerIds.filter(c => c.active).length} activos)`);
console.log(`   Membresías:   ${membershipCount}`);
console.log(`   Pagos:        ${paymentCount}`);
console.log(`   Categorías:   ${categoriesData.length}`);
console.log(`   Ejercicios:   ${exerciseCount}`);
console.log(`   Plantillas:   ${templateCount}`);
console.log(`   Mesociclos:   ${mesoAssignCount} (2-5 por cliente)`);
console.log(`   Productos:    ${productIds.length}`);
console.log(`   Movimientos:  ${orderCount}`);
console.log(`\n💾 Backup guardado en:\n   ${backupPath}`);
console.log('\nReinicia la aplicacion para ver los datos.');
process.exit(0);
