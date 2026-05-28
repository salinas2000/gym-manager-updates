-- ============================================================
-- Migration: Auth & RLS for Mobile Client App
-- Date: 2026-05-26
-- Purpose: Enable gym members to access their own data via
--          the mobile app using Supabase Auth + Row Level Security.
-- ============================================================

-- ─── 1. MOBILE CLIENT LINKS TABLE ──────────────────────────────────────────────
-- Links a Supabase Auth user (gym member) to their cloud_customers record.
-- Created by the desktop app when the gym owner invites a client.

CREATE TABLE IF NOT EXISTS mobile_client_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    gym_id TEXT NOT NULL,
    customer_local_id BIGINT NOT NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    linked_at TIMESTAMPTZ,
    UNIQUE(auth_user_id),
    UNIQUE(gym_id, customer_local_id)
);

ALTER TABLE mobile_client_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only read their own link
CREATE POLICY "Users read own link"
    ON mobile_client_links FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- Service Role (desktop app) has full access for creating/managing links
DROP POLICY IF EXISTS "Service Role Full Access" ON mobile_client_links;
CREATE POLICY "Service Role Full Access"
    ON mobile_client_links
    TO service_role
    USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mobile_client_links_auth_user
    ON mobile_client_links(auth_user_id);

-- ─── 2. AUTO-LINK TRIGGER ──────────────────────────────────────────────────────
-- When a user confirms their invitation (signs up via email), automatically
-- link their auth_user_id to the pre-created mobile_client_links record.

CREATE OR REPLACE FUNCTION link_mobile_client()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.raw_user_meta_data->>'gym_id' IS NOT NULL THEN
        UPDATE mobile_client_links
        SET auth_user_id = NEW.id, linked_at = NOW()
        WHERE gym_id = NEW.raw_user_meta_data->>'gym_id'
          AND customer_local_id = (NEW.raw_user_meta_data->>'customer_local_id')::BIGINT
          AND auth_user_id IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION link_mobile_client();


-- ─── 3. RLS POLICIES FOR AUTHENTICATED MOBILE CLIENTS ─────────────────────────
-- Pattern A: "Own data" — tables with customer_id column.
--            Client sees only rows matching their linked customer.
-- Pattern B: "Gym data" — shared reference tables (tariffs, exercises).
--            Client sees all rows from their gym.
-- Pattern C: "Own via mesocycle" — routines/items linked through mesocycle ownership.

-- ── PATTERN A: Own Data (customer_id filtered) ──

-- cloud_payments
DROP POLICY IF EXISTS "Client reads own payments" ON cloud_payments;
CREATE POLICY "Client reads own payments"
    ON cloud_payments FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_payments.gym_id
              AND mcl.customer_local_id = cloud_payments.customer_id
        )
    );

-- cloud_memberships
DROP POLICY IF EXISTS "Client reads own memberships" ON cloud_memberships;
CREATE POLICY "Client reads own memberships"
    ON cloud_memberships FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_memberships.gym_id
              AND mcl.customer_local_id = cloud_memberships.customer_id
        )
    );

-- cloud_mesocycles
DROP POLICY IF EXISTS "Client reads own mesocycles" ON cloud_mesocycles;
CREATE POLICY "Client reads own mesocycles"
    ON cloud_mesocycles FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_mesocycles.gym_id
              AND mcl.customer_local_id = cloud_mesocycles.customer_id
        )
    );

-- cloud_file_history
DROP POLICY IF EXISTS "Client reads own files" ON cloud_file_history;
CREATE POLICY "Client reads own files"
    ON cloud_file_history FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_file_history.gym_id
              AND mcl.customer_local_id = cloud_file_history.customer_id
        )
    );

-- cloud_customers (client reads only their own profile)
DROP POLICY IF EXISTS "Client reads own profile" ON cloud_customers;
CREATE POLICY "Client reads own profile"
    ON cloud_customers FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_customers.gym_id
              AND mcl.customer_local_id = cloud_customers.local_id
        )
    );


-- ── PATTERN B: Gym-wide Data (shared reference tables) ──

-- cloud_tariffs
DROP POLICY IF EXISTS "Client reads gym tariffs" ON cloud_tariffs;
CREATE POLICY "Client reads gym tariffs"
    ON cloud_tariffs FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_tariffs.gym_id
        )
    );

-- cloud_exercise_categories
DROP POLICY IF EXISTS "Client reads gym exercise categories" ON cloud_exercise_categories;
CREATE POLICY "Client reads gym exercise categories"
    ON cloud_exercise_categories FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_exercise_categories.gym_id
        )
    );

-- cloud_exercise_subcategories
DROP POLICY IF EXISTS "Client reads gym exercise subcategories" ON cloud_exercise_subcategories;
CREATE POLICY "Client reads gym exercise subcategories"
    ON cloud_exercise_subcategories FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_exercise_subcategories.gym_id
        )
    );

-- cloud_exercises
DROP POLICY IF EXISTS "Client reads gym exercises" ON cloud_exercises;
CREATE POLICY "Client reads gym exercises"
    ON cloud_exercises FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM mobile_client_links mcl
            WHERE mcl.auth_user_id = auth.uid()
              AND mcl.gym_id = cloud_exercises.gym_id
        )
    );


-- ── PATTERN C: Own via Mesocycle (routines → mesocycle → customer) ──

-- cloud_routines
DROP POLICY IF EXISTS "Client reads own routines" ON cloud_routines;
CREATE POLICY "Client reads own routines"
    ON cloud_routines FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM cloud_mesocycles cm
            JOIN mobile_client_links mcl ON mcl.auth_user_id = auth.uid()
                AND mcl.gym_id = cm.gym_id
                AND mcl.customer_local_id = cm.customer_id
            WHERE cm.gym_id = cloud_routines.gym_id
              AND cm.local_id = cloud_routines.mesocycle_id
        )
    );

-- cloud_routine_items
DROP POLICY IF EXISTS "Client reads own routine items" ON cloud_routine_items;
CREATE POLICY "Client reads own routine items"
    ON cloud_routine_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM cloud_routines cr
            JOIN cloud_mesocycles cm ON cm.gym_id = cr.gym_id AND cm.local_id = cr.mesocycle_id
            JOIN mobile_client_links mcl ON mcl.auth_user_id = auth.uid()
                AND mcl.gym_id = cm.gym_id
                AND mcl.customer_local_id = cm.customer_id
            WHERE cr.gym_id = cloud_routine_items.gym_id
              AND cr.local_id = cloud_routine_items.routine_id
        )
    );


-- ─── 4. HELPER VIEW FOR MOBILE APP ────────────────────────────────────────────
-- Simplifies the most common mobile query: "show me my profile + membership + tariff"

CREATE OR REPLACE VIEW mobile_my_profile AS
SELECT
    c.local_id AS customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.active,
    c.height_cm,
    c.weight_kg,
    c.birth_date,
    c.medical_info,
    c.gym_id,
    t.name AS tariff_name,
    t.amount AS tariff_amount,
    t.billing_months,
    t.color_theme,
    m.start_date AS membership_start,
    m.end_date AS membership_end
FROM cloud_customers c
JOIN mobile_client_links mcl
    ON mcl.gym_id = c.gym_id
    AND mcl.customer_local_id = c.local_id
LEFT JOIN cloud_tariffs t
    ON t.gym_id = c.gym_id
    AND t.local_id = c.tariff_id
LEFT JOIN LATERAL (
    SELECT start_date, end_date
    FROM cloud_memberships
    WHERE gym_id = c.gym_id AND customer_id = c.local_id
    ORDER BY start_date DESC
    LIMIT 1
) m ON true
WHERE mcl.auth_user_id = auth.uid();

-- RLS for the view (views inherit from base tables, but we add explicit security)
-- No additional policy needed: the view's WHERE clause filters by auth.uid(),
-- and the underlying tables have their own RLS policies.
