-- Migration: Create licenses table and RLS policies
-- Description: Ensures licenses table exists and allows public read access (required for Admin Dashboard as Anon)

CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    license_key TEXT NOT NULL UNIQUE,
    gym_id TEXT NOT NULL,
    organization_id TEXT, -- Legacy support
    gym_name TEXT NOT NULL,
    hardware_id TEXT,
    active BOOLEAN DEFAULT true,
    is_master BOOLEAN DEFAULT false,
    app_version TEXT DEFAULT '1.0.0',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_check_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Policy: Allow Anon Read (Required for Admin Dashboard without Auth)
-- WARNING: This exposes license metadata publicly. Ensure no sensitive data is stored here.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.licenses;
CREATE POLICY "Enable read access for all users" ON public.licenses
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- Policy: Allow Anon Update (Required for Hardware Binding & Version Reporting)
DROP POLICY IF EXISTS "Enable update for all users" ON public.licenses;
CREATE POLICY "Enable update for all users" ON public.licenses
    FOR UPDATE
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow Anon Insert (Required for 'Create License' as Master - technically Master is still Anon in this app currently)
DROP POLICY IF EXISTS "Enable insert for all users" ON public.licenses;
CREATE POLICY "Enable insert for all users" ON public.licenses
    FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);
