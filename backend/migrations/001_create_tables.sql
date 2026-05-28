-- ============================================================
-- Project Cura — Supabase Database Migration
-- ============================================================
-- Run this SQL in the Supabase SQL Editor (https://app.supabase.com)
-- to create all required tables. The backend will then automatically
-- detect these tables and use Supabase instead of local SQLite.
--
-- This is idempotent — safe to run multiple times.
-- ============================================================

-- 1. Users table (authentication & roles)
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS patients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    age INTEGER,
    gender TEXT DEFAULT 'Unknown',
    contact TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Consultations table (stores SOAP notes + clinical data)
CREATE TABLE IF NOT EXISTS consultations (
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
CREATE TABLE IF NOT EXISTS audio_recordings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    file_url TEXT DEFAULT '',
    duration_seconds REAL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit log (compliance tracking)
CREATE TABLE IF NOT EXISTS audit_log (
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
CREATE TABLE IF NOT EXISTS fhir_transmissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT DEFAULT '',
    bundle JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    transmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS) — disable for now so the anon key works
-- Enable RLS policies later when adding proper auth
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fhir_transmissions ENABLE ROW LEVEL SECURITY;

-- Allow full access via anon key (for development/MVP)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for users') THEN
        CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for patients') THEN
        CREATE POLICY "Allow all for patients" ON patients FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for consultations') THEN
        CREATE POLICY "Allow all for consultations" ON consultations FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for audio_recordings') THEN
        CREATE POLICY "Allow all for audio_recordings" ON audio_recordings FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for audit_log') THEN
        CREATE POLICY "Allow all for audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for fhir_transmissions') THEN
        CREATE POLICY "Allow all for fhir_transmissions" ON fhir_transmissions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON audio_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_fhir_transmissions_session_id ON fhir_transmissions(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_username ON audit_log(username);

-- ============================================================
-- Done! Your backend will now detect these tables and use
-- Supabase automatically instead of falling back to SQLite.
-- ============================================================
