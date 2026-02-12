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
    notes TEXT,
    default_sets INTEGER,
    default_reps TEXT,
    is_failure INTEGER DEFAULT 0,
    default_intensity TEXT,
    custom_fields JSONB,
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
    is_template INTEGER DEFAULT 0,
    days_per_week INTEGER DEFAULT 0,
    notes TEXT,
    drive_link TEXT,
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
    notes TEXT,
    intensity TEXT,
    order_index INTEGER,
    custom_fields JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- FILE HISTORY
CREATE TABLE IF NOT EXISTS cloud_file_history (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    file_name TEXT NOT NULL,
    public_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- INVENTORY MODULE
-- PRODUCTS
CREATE TABLE IF NOT EXISTS cloud_products (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    purchase_price NUMERIC,
    sale_price NUMERIC,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    category TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- INVENTORY ORDERS
CREATE TABLE IF NOT EXISTS cloud_inventory_orders (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    customer_id BIGINT, -- Added for parity
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS cloud_product_categories (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
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
ALTER TABLE cloud_file_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_remote_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_inventory_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_product_categories ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- 1. Permitive Policy for Service Role (Backend Access)
-- We ensure idempotency by dropping before creating.

-- TARIFFS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_tariffs;
CREATE POLICY "Service Role Full Access" ON cloud_tariffs TO service_role USING (true) WITH CHECK (true);

-- CUSTOMERS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_customers;
CREATE POLICY "Service Role Full Access" ON cloud_customers TO service_role USING (true) WITH CHECK (true);

-- MEMBERSHIPS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_memberships;
CREATE POLICY "Service Role Full Access" ON cloud_memberships TO service_role USING (true) WITH CHECK (true);

-- PAYMENTS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_payments;
CREATE POLICY "Service Role Full Access" ON cloud_payments TO service_role USING (true) WITH CHECK (true);

-- EXERCISE CATEGORIES
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_exercise_categories;
CREATE POLICY "Service Role Full Access" ON cloud_exercise_categories TO service_role USING (true) WITH CHECK (true);

-- EXERCISE SUBCATEGORIES
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_exercise_subcategories;
CREATE POLICY "Service Role Full Access" ON cloud_exercise_subcategories TO service_role USING (true) WITH CHECK (true);

-- EXERCISES
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_exercises;
CREATE POLICY "Service Role Full Access" ON cloud_exercises TO service_role USING (true) WITH CHECK (true);

-- MESOCYCLES
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_mesocycles;
CREATE POLICY "Service Role Full Access" ON cloud_mesocycles TO service_role USING (true) WITH CHECK (true);

-- ROUTINES
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_routines;
CREATE POLICY "Service Role Full Access" ON cloud_routines TO service_role USING (true) WITH CHECK (true);

-- ROUTINE ITEMS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_routine_items;
CREATE POLICY "Service Role Full Access" ON cloud_routine_items TO service_role USING (true) WITH CHECK (true);

-- FILE HISTORY
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_file_history;
CREATE POLICY "Service Role Full Access" ON cloud_file_history TO service_role USING (true) WITH CHECK (true);

-- REMOTE LOADS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_remote_loads;
CREATE POLICY "Service Role Full Access" ON cloud_remote_loads TO service_role USING (true) WITH CHECK (true);

-- PRODUCTS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_products;
CREATE POLICY "Service Role Full Access" ON cloud_products TO service_role USING (true) WITH CHECK (true);

-- INVENTORY ORDERS
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_inventory_orders;
CREATE POLICY "Service Role Full Access" ON cloud_inventory_orders TO service_role USING (true) WITH CHECK (true);

-- 2. Restrictive Policy for Anon/Public (Prevent accidental leaks)
-- We explicitly DROP the old "Public Access" if it exists.
DROP POLICY IF EXISTS "Public Access" ON cloud_tariffs;
DROP POLICY IF EXISTS "Public Access" ON cloud_customers;
DROP POLICY IF EXISTS "Public Access" ON cloud_memberships;
DROP POLICY IF EXISTS "Public Access" ON cloud_payments;
DROP POLICY IF EXISTS "Public Access" ON cloud_exercise_categories;
DROP POLICY IF EXISTS "Public Access" ON cloud_exercise_subcategories;
DROP POLICY IF EXISTS "Public Access" ON cloud_exercises;
DROP POLICY IF EXISTS "Public Access" ON cloud_mesocycles;
DROP POLICY IF EXISTS "Public Access" ON cloud_routines;
DROP POLICY IF EXISTS "Public Access" ON cloud_routine_items;
DROP POLICY IF EXISTS "Public Access" ON cloud_file_history;
DROP POLICY IF EXISTS "Public Access" ON cloud_remote_loads;

-- REMOTE LOADS TRACKING
CREATE TABLE IF NOT EXISTS cloud_remote_loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    error TEXT,
    app_version TEXT
);

-- ENABLE REALTIME (Safe Version)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cloud_remote_loads;
EXCEPTION
    WHEN duplicate_object OR sqlstate '42710' THEN
        RAISE NOTICE 'Table cloud_remote_loads is already in publication supabase_realtime';
END $$;
