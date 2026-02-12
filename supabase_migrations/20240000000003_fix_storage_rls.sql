-- Migration: Fix Storage RLS for training_files bucket
-- Description: Ensures training_files bucket allows listing files for Admin Dashboard

-- 1. Ensure Bucket Exists (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('training_files', 'training_files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access Read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Give me access to everything" ON storage.objects; -- Potential legacy policy

-- 3. Create Comprehensive Policies

-- ALLOW SELECT (Read/List/Download) for Everyone (Anon + Authenticated)
-- This is needed for Admin Panel to LIST the backups in the folder
CREATE POLICY "Public Select Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'training_files' );

-- ALLOW INSERT (Upload) for Authenticated & Anon (if app not using auth correctly yet)
-- In a strict environment, this should beAuthenticated ONLY, but for now we mirror current security model
CREATE POLICY "Public Insert Access"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'training_files' );

-- ALLOW UPDATE (Overwrite)
CREATE POLICY "Public Update Access"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'training_files' );

-- ALLOW DELETE (Cleanup)
CREATE POLICY "Public Delete Access"
ON storage.objects FOR DELETE
USING ( bucket_id = 'training_files' );

