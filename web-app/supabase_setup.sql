-- Supabase Setup for Payroll Master
-- Run this SQL in your Supabase SQL Editor to set up the required tables and buckets

-- ============================================================================
-- 1. Create Storage Buckets
-- ============================================================================
-- Go to Storage in Supabase dashboard and create these buckets:
-- - templates (for template files)
-- - outputs (for processed output files)

-- Or use SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('templates', 'templates', false),
  ('outputs', 'outputs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Create Tables for Metadata
-- ============================================================================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' or 'user'
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template files metadata
CREATE TABLE IF NOT EXISTS template_files (
  id BIGSERIAL PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  size_bytes INTEGER
);

-- Output files metadata
CREATE TABLE IF NOT EXISTS output_files (
  id BIGSERIAL PRIMARY KEY,
  output_type TEXT NOT NULL, -- 'cash', 'payroll', 'weekly'
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  week_of TEXT,
  size_bytes INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3. Set up Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_files ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no authentication required for this simple app)
-- For production, you'd want to add proper auth policies
CREATE POLICY "Allow all users operations" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all template_files operations" ON template_files
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all output_files operations" ON output_files
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. Storage Policies
-- ============================================================================

-- Allow uploads to templates bucket
CREATE POLICY "Allow template uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'templates');

CREATE POLICY "Allow template downloads" ON storage.objects
  FOR SELECT USING (bucket_id = 'templates');

CREATE POLICY "Allow template deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'templates');

CREATE POLICY "Allow template updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'templates');

-- Allow uploads to outputs bucket
CREATE POLICY "Allow output uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'outputs');

CREATE POLICY "Allow output downloads" ON storage.objects
  FOR SELECT USING (bucket_id = 'outputs');

CREATE POLICY "Allow output deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'outputs');

-- ============================================================================
-- Done! Your Supabase is now configured for Payroll Master
-- ============================================================================
--
-- The admin user (gilad/gilad) will be created automatically on first
-- server startup. Other users can sign up and will need admin approval.
-- ============================================================================
