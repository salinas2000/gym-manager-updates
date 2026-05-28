-- ============================================================
-- Migration: Multi-gym support
-- Date: 2026-05-28
-- Purpose: Allow a single auth user to be linked to multiple gyms
--          (e.g., same email registered as client in 2 different gyms).
-- ============================================================

-- 1. Drop the UNIQUE(auth_user_id) constraint that limited 1 user = 1 gym
ALTER TABLE mobile_client_links
    DROP CONSTRAINT IF EXISTS mobile_client_links_auth_user_id_key;

-- Some Supabase installs name the constraint differently — drop the generic name too
ALTER TABLE mobile_client_links
    DROP CONSTRAINT IF EXISTS mobile_client_links_auth_user_id_unique;

-- 2. Add composite UNIQUE(auth_user_id, gym_id) to prevent duplicate links
--    for the same (user, gym) pair while allowing multiple gyms per user.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'mobile_client_links_auth_user_gym_unique'
    ) THEN
        ALTER TABLE mobile_client_links
            ADD CONSTRAINT mobile_client_links_auth_user_gym_unique
            UNIQUE(auth_user_id, gym_id);
    END IF;
END $$;

-- 3. Update trigger: link to ALL matching gyms (not just the first one)
CREATE OR REPLACE FUNCTION link_mobile_client()
RETURNS TRIGGER AS $$
DECLARE
    v_customer RECORD;
    v_linked BOOLEAN := FALSE;
BEGIN
    BEGIN
        -- Path 1: Desktop-invited user (metadata-based link)
        IF NEW.raw_user_meta_data->>'gym_id' IS NOT NULL THEN
            UPDATE mobile_client_links
            SET auth_user_id = NEW.id, linked_at = NOW()
            WHERE gym_id = NEW.raw_user_meta_data->>'gym_id'
              AND customer_local_id = (NEW.raw_user_meta_data->>'customer_local_id')::BIGINT
              AND auth_user_id IS NULL;

            IF FOUND THEN
                v_linked := TRUE;
            END IF;
        END IF;

        -- Path 2: Self-registered (Google OAuth) - link to ALL gyms where email matches
        IF NOT v_linked AND NEW.email IS NOT NULL THEN
            FOR v_customer IN
                SELECT gym_id, local_id FROM public.cloud_customers
                WHERE LOWER(email) = LOWER(NEW.email)
            LOOP
                -- Try to update an existing pending row first
                UPDATE mobile_client_links
                SET auth_user_id = NEW.id, linked_at = NOW()
                WHERE gym_id = v_customer.gym_id
                  AND customer_local_id = v_customer.local_id
                  AND auth_user_id IS NULL;

                -- If no pending row existed, create a fresh link
                IF NOT FOUND THEN
                    INSERT INTO mobile_client_links (auth_user_id, gym_id, customer_local_id, invited_at, linked_at)
                    VALUES (NEW.id, v_customer.gym_id, v_customer.local_id, NOW(), NOW())
                    ON CONFLICT (auth_user_id, gym_id) DO NOTHING;
                END IF;
            END LOOP;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'link_mobile_client trigger failed for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. Replace check_client_access() to return ALL gyms the user has access to.
--    Backwards compatible: still returns top-level gym_id/customer_local_id
--    from the first gym, but adds a `gyms` array with everything.
CREATE OR REPLACE FUNCTION check_client_access()
RETURNS JSON AS $$
DECLARE
    v_gyms JSON;
    v_count INT;
    v_first RECORD;
BEGIN
    -- Aggregate all linked gyms
    SELECT json_agg(
        json_build_object(
            'gym_id', mcl.gym_id,
            'customer_local_id', mcl.customer_local_id,
            'customer_name', TRIM(BOTH FROM COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')),
            'active', COALESCE(c.active, 0) = 1
        )
        ORDER BY mcl.linked_at DESC
    ), COUNT(*)
    INTO v_gyms, v_count
    FROM mobile_client_links mcl
    LEFT JOIN public.cloud_customers c
        ON c.gym_id = mcl.gym_id AND c.local_id = mcl.customer_local_id
    WHERE mcl.auth_user_id = auth.uid()
      AND mcl.linked_at IS NOT NULL;

    IF v_count = 0 THEN
        RETURN json_build_object(
            'authorized', false,
            'gyms', '[]'::json,
            'reason', 'no_link'
        );
    END IF;

    -- Pick first gym for backwards-compatible top-level fields
    SELECT
        (v_gyms->0->>'gym_id') AS gym_id,
        ((v_gyms->0->>'customer_local_id')::BIGINT) AS customer_local_id,
        (v_gyms->0->>'customer_name') AS customer_name
    INTO v_first;

    RETURN json_build_object(
        'authorized', true,
        'gym_id', v_first.gym_id,
        'customer_local_id', v_first.customer_local_id,
        'customer_name', v_first.customer_name,
        'gyms', v_gyms
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 5. Update mobile_my_profile view to support an optional gym filter.
--    We can't add a parameter to a view, so we keep the existing behavior
--    (returns first matching link) and let the client filter by gym_id
--    explicitly via cloud_customers query.

-- (No change needed to the view itself — clients should query cloud_customers
--  directly with .eq('gym_id', activeGymId) for multi-gym scenarios.)
