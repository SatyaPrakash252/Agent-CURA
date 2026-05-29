-- ============================================================================
-- Project Cura — Supabase Clean and Sync Schema Migration
-- ============================================================================
-- Run this SQL script inside your Supabase SQL Editor (https://app.supabase.com)
--
-- This script does two critical tasks:
-- 1. Automatically finds and DROPS any unnecessary, non-MVP tables in your public schema.
-- 2. Cleanly recreates/verifies the exact 6 core tables required by Project Cura.
--
-- After executing this script, simply restart your backend server. The backend's
-- self-healing background worker will automatically scan your local SQLite database
-- and synchronize all of your doctors, patients, and consultations back into Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Clean up unnecessary tables
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    target_tables TEXT[] := ARRAY['users', 'patients', 'consultations', 'audio_recordings', 'audit_log', 'fhir_transmissions'];
BEGIN
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        -- If the table is NOT one of our 6 core Project Cura tables, drop it!
        IF NOT (r.table_name = ANY(target_tables)) THEN
            RAISE NOTICE 'Dropping unnecessary table: %', r.table_name;
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Step 2: Create Core Project Cura Tables (if they don't exist)
-- ----------------------------------------------------------------------------

-- 1. Users table (authentication & roles)
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'doctor',
    expertise TEXT DEFAULT '',
    credentials TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 2. Patients table
CREATE TABLE IF NOT EXISTS public.patients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    age INTEGER,
    gender TEXT DEFAULT 'Unknown',
    contact TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Consultations table (SOAP notes + clinical data)
CREATE TABLE IF NOT EXISTS public.consultations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    patient_id TEXT NOT NULL,
    subjective TEXT DEFAULT '',
    objective TEXT DEFAULT '',
    assessment TEXT DEFAULT '',
    plan TEXT DEFAULT '',
    raw_transcript TEXT DEFAULT '',
    redacted_transcript TEXT DEFAULT '',
    confidence_score REAL DEFAULT 0,
    fhir_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audio recordings metadata
CREATE TABLE IF NOT EXISTS public.audio_recordings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    file_url TEXT DEFAULT '',
    duration_seconds REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit log (compliance tracking)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT DEFAULT '',
    action TEXT DEFAULT '',
    resource_type TEXT DEFAULT '',
    resource_id TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. FHIR transmissions
CREATE TABLE IF NOT EXISTS public.fhir_transmissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT DEFAULT '',
    bundle JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    transmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Step 3: Configure Row Level Security (RLS) & Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_transmissions ENABLE ROW LEVEL SECURITY;

-- Allow full read/write via anon key (Standard Development/MVP access)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for users') THEN
        CREATE POLICY "Allow all for users" ON public.users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for patients') THEN
        CREATE POLICY "Allow all for patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for consultations') THEN
        CREATE POLICY "Allow all for consultations" ON public.consultations FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for audio_recordings') THEN
        CREATE POLICY "Allow all for audio_recordings" ON public.audio_recordings FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for audit_log') THEN
        CREATE POLICY "Allow all for audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for fhir_transmissions') THEN
        CREATE POLICY "Allow all for fhir_transmissions" ON public.fhir_transmissions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Step 4: Create Optimizing Indexes for Rapid Lookup
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON public.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON public.patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_fhir_transmissions_session_id ON public.fhir_transmissions(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_username ON public.audit_log(username);

-- ============================================================================
-- Clean and Sync database schema migration complete!
-- ============================================================================
