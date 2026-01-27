-- 🏋️‍♂️ GYM MANAGER PRO - SUPABASE CLOUD SCHEMA
-- Este archivo define la estructura exacta para la base de datos en la nube.
-- Ejecuta este script complero en el SQL Editor de Supabase.

-- 1. CONFIGURACIÓN INICIAL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLAS ESPEJO (Con gym_id para multi-tenancy)

-- TARIFFS
CREATE TABLE IF NOT EXISTS cloud_tariffs (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC,
    color_theme TEXT DEFAULT 'emerald',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS cloud_customers (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    active INTEGER DEFAULT 1,
    tariff_id BIGINT,
    created_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- MEMBERSHIPS
CREATE TABLE IF NOT EXISTS cloud_memberships (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS cloud_payments (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    tariff_name TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- --- TRAINING MODULE TABLES ---

-- EXERCISES
-- EXERCISE CATEGORIES
CREATE TABLE IF NOT EXISTS cloud_exercise_categories (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    is_system INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- EXERCISE SUBCATEGORIES
CREATE TABLE IF NOT EXISTS cloud_exercise_subcategories (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL, -- Reference to local_id of category
    name TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- EXERCISES
CREATE TABLE IF NOT EXISTS cloud_exercises (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    subcategory_id BIGINT,
    video_url TEXT,
    default_sets INTEGER,
    default_reps TEXT,
    is_failure INTEGER DEFAULT 0,
    default_intensity TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- MESOCYCLES (Plans)
CREATE TABLE IF NOT EXISTS cloud_mesocycles (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL, -- FK to cloud_customers
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    active INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- ROUTINES (Days)
CREATE TABLE IF NOT EXISTS cloud_routines (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    mesocycle_id BIGINT NOT NULL, -- FK to cloud_mesocycles
    name TEXT NOT NULL,
    day_group TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- ROUTINE ITEMS (Exercise Instances)
CREATE TABLE IF NOT EXISTS cloud_routine_items (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    routine_id BIGINT NOT NULL, -- FK to cloud_routines
    exercise_id BIGINT NOT NULL, -- FK to cloud_exercises
    series INTEGER,
    reps TEXT,
    rpe TEXT,
    rpe TEXT,
    notes TEXT,
    intensity TEXT,
    order_index INTEGER,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- 3. SEGURIDAD (Row Level Security)
ALTER TABLE cloud_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_exercise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_exercise_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_routine_items ENABLE ROW LEVEL SECURITY;

-- Política Pública (Dev Mode)
CREATE POLICY "Public Access" ON cloud_tariffs FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_customers FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_memberships FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_payments FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_exercise_categories FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_exercise_subcategories FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_exercises FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_mesocycles FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_routines FOR ALL USING (true);
CREATE POLICY "Public Access" ON cloud_routine_items FOR ALL USING (true);

-- 4. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_cloud_customers_gym ON cloud_customers(gym_id);
CREATE INDEX IF NOT EXISTS idx_cloud_mesocycles_customer ON cloud_mesocycles(gym_id, customer_id);
