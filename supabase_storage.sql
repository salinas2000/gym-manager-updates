-- 📁 SUPABASE STORAGE CONFIGURATION
-- Run this in the SQL Editor to set up the file bucket.

-- 1. Create Bucket (if not exists via UI, strictly SQL here)
-- Note: Often buckets are created via UI, but this inserts into storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('training_files', 'training_files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Security Policies (RLS)

-- Allow PUBLIC Access to Read files (Download/Share via WhatsApp needs public link)
CREATE POLICY "Public Access Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'training_files' );

-- Allow Authenticated Users (Service Role / App) to Upload
-- Note: For simple setups using Service Key, RLS is bypassed, but good to have.
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'training_files' );

-- Allow Update/Delete for cleanup (Optional)
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'training_files' );
