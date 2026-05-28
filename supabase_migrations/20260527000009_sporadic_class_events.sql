-- Sporadic (one-off) class events — specific date + time, not recurring
CREATE TABLE IF NOT EXISTS gym_class_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gym_id TEXT NOT NULL,
    class_id BIGINT NOT NULL,  -- FK to cloud_gym_classes.local_id
    event_date DATE NOT NULL,
    start_time TEXT NOT NULL,   -- "HH:MM"
    end_time TEXT NOT NULL,     -- "HH:MM"
    max_capacity_override INTEGER,  -- NULL = use class default
    instructor_override TEXT,       -- NULL = use class default
    notes TEXT,
    cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gym_id, class_id, event_date, start_time)
);

CREATE INDEX idx_class_events_date ON gym_class_events(gym_id, event_date);

ALTER TABLE gym_class_events ENABLE ROW LEVEL SECURITY;

-- RLS: clients can read events from their gym
CREATE POLICY "Client reads gym events" ON gym_class_events
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM mobile_client_links mcl WHERE mcl.auth_user_id = auth.uid() AND mcl.gym_id = gym_class_events.gym_id));

-- Service role full access
CREATE POLICY "Service Role Full Access" ON gym_class_events TO service_role USING (true) WITH CHECK (true);

-- Extend gym_class_bookings to also support event_id (for sporadic events)
ALTER TABLE gym_class_bookings ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES gym_class_events(id);

-- New RPC for booking sporadic events
CREATE OR REPLACE FUNCTION book_event(
    p_gym_id TEXT,
    p_event_id UUID,
    p_customer_local_id BIGINT,
    p_booking_date DATE
) RETURNS JSON AS $$
DECLARE
    v_max_capacity INTEGER;
    v_current_count INTEGER;
    v_existing UUID;
    v_event RECORD;
BEGIN
    -- Get event info
    SELECT e.*, gc.max_capacity as class_max_capacity
    INTO v_event
    FROM gym_class_events e
    JOIN cloud_gym_classes gc ON gc.gym_id = e.gym_id AND gc.local_id = e.class_id
    WHERE e.id = p_event_id AND e.gym_id = p_gym_id AND e.cancelled = FALSE;

    IF v_event IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Evento no encontrado o cancelado');
    END IF;

    -- Use override capacity or class default
    v_max_capacity := COALESCE(v_event.max_capacity_override, v_event.class_max_capacity);

    -- Check if already booked
    SELECT id INTO v_existing
    FROM gym_class_bookings
    WHERE gym_id = p_gym_id AND event_id = p_event_id
      AND customer_local_id = p_customer_local_id AND status = 'confirmed';

    IF v_existing IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Ya estas apuntado a este evento');
    END IF;

    -- Count current confirmed bookings
    SELECT COUNT(*) INTO v_current_count
    FROM gym_class_bookings
    WHERE gym_id = p_gym_id AND event_id = p_event_id AND status = 'confirmed';

    IF v_current_count >= v_max_capacity THEN
        RETURN json_build_object('success', false, 'error', 'Evento completo');
    END IF;

    -- Insert booking
    INSERT INTO gym_class_bookings (gym_id, event_id, customer_local_id, booking_date, status, booked_at)
    VALUES (p_gym_id, p_event_id, p_customer_local_id, p_booking_date, 'confirmed', NOW());

    RETURN json_build_object('success', true, 'spots_left', v_max_capacity - v_current_count - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
