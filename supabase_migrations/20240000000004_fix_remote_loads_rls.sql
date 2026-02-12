-- Migration: Fix RLS for cloud_remote_loads to allow Realtime Signaling
-- Fully idempotent: safe to run multiple times.

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS cloud_remote_loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    error TEXT,
    app_version TEXT
);

-- 2. Enable Realtime (Graceful)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cloud_remote_loads;
EXCEPTION
    WHEN duplicate_object OR sqlstate '42710' THEN
        RAISE NOTICE 'Already in publication';
END $$;

-- 3. RLS
ALTER TABLE cloud_remote_loads ENABLE ROW LEVEL SECURITY;

-- DROP ALL existing policies first (idempotent)
DROP POLICY IF EXISTS "Service Role Full Access" ON cloud_remote_loads;
DROP POLICY IF EXISTS "Public Read Access" ON cloud_remote_loads;
DROP POLICY IF EXISTS "Public Insert Access" ON cloud_remote_loads;
DROP POLICY IF EXISTS "Public Update Access" ON cloud_remote_loads;
DROP POLICY IF EXISTS "Public Delete Access" ON cloud_remote_loads;

-- CREATE fresh policies
CREATE POLICY "Public Read Access"   ON cloud_remote_loads FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON cloud_remote_loads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON cloud_remote_loads FOR UPDATE USING (true);
CREATE POLICY "Public Delete Access" ON cloud_remote_loads FOR DELETE USING (true);
