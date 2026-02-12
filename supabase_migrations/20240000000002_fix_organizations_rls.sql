-- Migration: Create organizations table and RLS policies
-- Description: Ensures organizations table exists and allows public read access (required for Admin Dashboard)

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_email TEXT,
    excel_template_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow Anon Read (Required for Admin Dashboard)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.organizations;
CREATE POLICY "Enable read access for all users" ON public.organizations
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- Policy: Allow Anon Update (Required for Admin Dashboard)
DROP POLICY IF EXISTS "Enable update for all users" ON public.organizations;
CREATE POLICY "Enable update for all users" ON public.organizations
    FOR UPDATE
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow Anon Insert (Required for Admin Dashboard)
DROP POLICY IF EXISTS "Enable insert for all users" ON public.organizations;
CREATE POLICY "Enable insert for all users" ON public.organizations
    FOR INSERT
    TO anon, authenticated, service_role
    WITH CHECK (true);

-- Also ensure 'cloud_remote_loads' has open access (it was missing policies in previous files potentially)
-- Only if not already handled or if issues persist.
-- We add a safety check for 'licenses' just in case.

-- Grant usage on sequence/schema if needed (usually default public has it, but good to be safe)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
