-- ============================================================
-- Migration: Classes, Schedules & Bookings system
-- Date: 2026-05-26
-- Purpose: Enable gym owners to create recurring weekly classes
--          and clients to book/cancel from the mobile app.
-- ============================================================

-- ─── 1. CLOUD MIRROR TABLES ────────────────────────────────────────────────────

-- Classes (synced from desktop)
CREATE TABLE IF NOT EXISTS cloud_gym_classes (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    instructor TEXT,
    color_theme TEXT DEFAULT 'blue',
    max_capacity INTEGER NOT NULL DEFAULT 20,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    active INTEGER DEFAULT 1,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- Weekly schedule slots (synced from desktop)
CREATE TABLE IF NOT EXISTS cloud_gym_class_schedules (
    gym_id TEXT NOT NULL,
    local_id BIGINT NOT NULL,
    class_id BIGINT NOT NULL,
    day_of_week INTEGER NOT NULL,  -- 0=Lunes ... 6=Domingo
    start_time TEXT NOT NULL,       -- "HH:MM"
    end_time TEXT NOT NULL,         -- "HH:MM"
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (gym_id, local_id)
);

-- ─── 2. BOOKINGS TABLE (Cloud-native) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gym_class_bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gym_id TEXT NOT NULL,
    schedule_id BIGINT NOT NULL,
    customer_local_id BIGINT NOT NULL,
    booking_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    booked_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    UNIQUE(gym_id, schedule_id, customer_local_id, booking_date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_schedule_date
    ON gym_class_bookings(gym_id, schedule_id, booking_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer
    ON gym_class_bookings(gym_id, customer_local_id, booking_date);

-- ─── 3. ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE cloud_gym_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_gym_class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_class_bookings ENABLE ROW LEVEL SECURITY;

-- Service Role full access
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_gym_classes;
CREATE POLICY "Service Role Full Access" ON cloud_gym_classes TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_gym_class_schedules;
CREATE POLICY "Service Role Full Access" ON cloud_gym_class_schedules TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access" ON gym_class_bookings;
CREATE POLICY "Service Role Full Access" ON gym_class_bookings TO service_role USING (true) WITH CHECK (true);

-- Client reads gym classes & schedules (Pattern B: gym-wide)
DROP POLICY IF EXISTS "Client reads gym classes" ON cloud_gym_classes;
CREATE POLICY "Client reads gym classes" ON cloud_gym_classes
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM mobile_client_links mcl
        WHERE mcl.auth_user_id = auth.uid() AND mcl.gym_id = cloud_gym_classes.gym_id
    ));

DROP POLICY IF EXISTS "Client reads gym schedules" ON cloud_gym_class_schedules;
CREATE POLICY "Client reads gym schedules" ON cloud_gym_class_schedules
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM mobile_client_links mcl
        WHERE mcl.auth_user_id = auth.uid() AND mcl.gym_id = cloud_gym_class_schedules.gym_id
    ));

-- Client reads own bookings
DROP POLICY IF EXISTS "Client reads own bookings" ON gym_class_bookings;
CREATE POLICY "Client reads own bookings" ON gym_class_bookings
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM mobile_client_links mcl
        WHERE mcl.auth_user_id = auth.uid()
          AND mcl.gym_id = gym_class_bookings.gym_id
          AND mcl.customer_local_id = gym_class_bookings.customer_local_id
    ));

-- Client creates own bookings
DROP POLICY IF EXISTS "Client creates own bookings" ON gym_class_bookings;
CREATE POLICY "Client creates own bookings" ON gym_class_bookings
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM mobile_client_links mcl
        WHERE mcl.auth_user_id = auth.uid()
          AND mcl.gym_id = gym_class_bookings.gym_id
          AND mcl.customer_local_id = gym_class_bookings.customer_local_id
    ));

-- Client cancels own bookings (can only set status to 'cancelled')
DROP POLICY IF EXISTS "Client cancels own bookings" ON gym_class_bookings;
CREATE POLICY "Client cancels own bookings" ON gym_class_bookings
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM mobile_client_links mcl
        WHERE mcl.auth_user_id = auth.uid()
          AND mcl.gym_id = gym_class_bookings.gym_id
          AND mcl.customer_local_id = gym_class_bookings.customer_local_id
    ))
    WITH CHECK (status = 'cancelled');

-- Authenticated users can read booking counts for classes in their gym
-- (needed to show "X/Y plazas" without exposing other users' data)
DROP POLICY IF EXISTS "Client reads gym booking counts" ON gym_class_bookings;
CREATE POLICY "Client reads gym booking counts" ON gym_class_bookings
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM mobile_client_links mcl
        WHERE mcl.auth_user_id = auth.uid()
          AND mcl.gym_id = gym_class_bookings.gym_id
    ));

-- ─── 4. ATOMIC BOOKING FUNCTION (prevents race conditions) ─────────────────────

CREATE OR REPLACE FUNCTION book_class(
    p_gym_id TEXT,
    p_schedule_id BIGINT,
    p_customer_local_id BIGINT,
    p_booking_date DATE
) RETURNS JSON AS $$
DECLARE
    v_max_capacity INTEGER;
    v_current_count INTEGER;
    v_existing UUID;
BEGIN
    -- Get max capacity from class via schedule
    SELECT gc.max_capacity INTO v_max_capacity
    FROM cloud_gym_class_schedules cs
    JOIN cloud_gym_classes gc ON gc.gym_id = cs.gym_id AND gc.local_id = cs.class_id
    WHERE cs.gym_id = p_gym_id AND cs.local_id = p_schedule_id AND gc.active = 1;

    IF v_max_capacity IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Clase no encontrada o inactiva');
    END IF;

    -- Check if already booked
    SELECT id INTO v_existing
    FROM gym_class_bookings
    WHERE gym_id = p_gym_id AND schedule_id = p_schedule_id
      AND customer_local_id = p_customer_local_id AND booking_date = p_booking_date
      AND status = 'confirmed';

    IF v_existing IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Ya estas apuntado a esta clase');
    END IF;

    -- Count current confirmed bookings (atomic read)
    SELECT COUNT(*) INTO v_current_count
    FROM gym_class_bookings
    WHERE gym_id = p_gym_id AND schedule_id = p_schedule_id
      AND booking_date = p_booking_date AND status = 'confirmed';

    IF v_current_count >= v_max_capacity THEN
        RETURN json_build_object('success', false, 'error', 'Clase completa');
    END IF;

    -- Upsert booking (re-confirm if previously cancelled)
    INSERT INTO gym_class_bookings (gym_id, schedule_id, customer_local_id, booking_date, status, booked_at, cancelled_at)
    VALUES (p_gym_id, p_schedule_id, p_customer_local_id, p_booking_date, 'confirmed', NOW(), NULL)
    ON CONFLICT (gym_id, schedule_id, customer_local_id, booking_date)
    DO UPDATE SET status = 'confirmed', booked_at = NOW(), cancelled_at = NULL;

    RETURN json_build_object('success', true, 'spots_left', v_max_capacity - v_current_count - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
