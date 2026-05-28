-- ============================================================
-- Migration: Auto-link Google OAuth users by email
-- Date: 2026-05-28
-- Purpose: When a new user signs up (via Google OAuth or otherwise)
--          and their email matches an existing cloud_customers record,
--          auto-create the mobile_client_links row.
--
--          This complements the existing link_mobile_client trigger,
--          which only links users invited by the desktop app (via
--          raw_user_meta_data->>'gym_id').
-- ============================================================

-- ─── Extended trigger function ──────────────────────────────────────────────
-- Replaces the existing link_mobile_client trigger function. Adds a fallback
-- path: if no metadata-based match is found (e.g., self-registration via
-- Google OAuth), try matching the user's email to a cloud_customers.email.

CREATE OR REPLACE FUNCTION link_mobile_client()
RETURNS TRIGGER AS $$
DECLARE
    v_customer RECORD;
    v_linked BOOLEAN := FALSE;
BEGIN
    -- Path 1: Desktop-invited user (existing behavior)
    -- The desktop app pre-creates a mobile_client_links row and sets
    -- gym_id/customer_local_id in the user metadata when sending the invite.
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

    -- Path 2: Self-registered user (Google OAuth, magic link, etc.)
    -- If no metadata-based link succeeded, try matching by email.
    -- Match against cloud_customers (case-insensitive).
    IF NOT v_linked AND NEW.email IS NOT NULL THEN
        SELECT gym_id, local_id
        INTO v_customer
        FROM cloud_customers
        WHERE LOWER(email) = LOWER(NEW.email)
        LIMIT 1;

        IF FOUND THEN
            -- Try to update an existing pending row first
            UPDATE mobile_client_links
            SET auth_user_id = NEW.id, linked_at = NOW()
            WHERE gym_id = v_customer.gym_id
              AND customer_local_id = v_customer.local_id
              AND auth_user_id IS NULL;

            -- If no pending row existed, insert a fresh link
            IF NOT FOUND THEN
                INSERT INTO mobile_client_links (auth_user_id, gym_id, customer_local_id, invited_at, linked_at)
                VALUES (NEW.id, v_customer.gym_id, v_customer.local_id, NOW(), NOW())
                ON CONFLICT (auth_user_id) DO NOTHING;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger is already defined in the original migration; this CREATE OR REPLACE
-- of the function automatically picks up the new behavior. No need to recreate
-- the trigger itself.

-- ─── Helper: Manual relink for users who registered BEFORE this migration ──
-- Can be invoked from the desktop app or run manually in SQL editor to
-- backfill links for existing Google-authenticated users whose emails match
-- cloud_customers entries but who don't yet have a mobile_client_links row.

CREATE OR REPLACE FUNCTION backfill_google_user_links()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO mobile_client_links (auth_user_id, gym_id, customer_local_id, invited_at, linked_at)
    SELECT u.id, c.gym_id, c.local_id, NOW(), NOW()
    FROM auth.users u
    JOIN cloud_customers c ON LOWER(c.email) = LOWER(u.email)
    LEFT JOIN mobile_client_links mcl ON mcl.auth_user_id = u.id
    WHERE mcl.id IS NULL
      AND u.email IS NOT NULL
    ON CONFLICT (auth_user_id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
