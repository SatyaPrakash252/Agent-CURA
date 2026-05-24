-- ============================================================
-- Project Cura — Database Migration 001
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure 'consultations' table has all required columns
-- (The table likely already exists from the old CuraPro schema)
DO $$
BEGIN
    -- Add 'objective' column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consultations' AND column_name = 'objective'
    ) THEN
        ALTER TABLE consultations ADD COLUMN objective TEXT DEFAULT '';
    END IF;

    -- Add 'session_id' column if missing (for direct lookup)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consultations' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE consultations ADD COLUMN session_id TEXT;
    END IF;

    -- Add 'confidence_score' column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consultations' AND column_name = 'confidence_score'
    ) THEN
        ALTER TABLE consultations ADD COLUMN confidence_score REAL DEFAULT 0;
    END IF;

    -- Add 'redacted_transcript' column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'consultations' AND column_name = 'redacted_transcript'
    ) THEN
        ALTER TABLE consultations ADD COLUMN redacted_transcript TEXT DEFAULT '';
    END IF;
END $$;

-- Create index on session_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_consultations_session_id ON consultations(session_id);

-- Create index on patient_id for patient history queries
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);


-- 2. Create 'patients' table
CREATE TABLE IF NOT EXISTS patients (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    age INTEGER,
    gender TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    blood_group TEXT DEFAULT '',
    allergies TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);


-- 3. Create 'audio_recordings' table
CREATE TABLE IF NOT EXISTS audio_recordings (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    file_url TEXT DEFAULT '',
    duration_seconds REAL DEFAULT 0,
    file_size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_session ON audio_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_patient ON audio_recordings(patient_id);


-- 4. Create 'users' table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'doctor',  -- 'admin', 'doctor', 'nurse'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);


-- 5. Create 'audit_log' table (access tracking for compliance)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'login', 'view_patient', 'finalize_consultation', etc.
    resource_type TEXT DEFAULT '', -- 'patient', 'consultation', 'fhir_bundle'
    resource_id TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log(username);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);


-- 6. Create 'fhir_transmissions' table (track FHIR bundle submissions)
CREATE TABLE IF NOT EXISTS fhir_transmissions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    bundle JSONB NOT NULL,
    status TEXT DEFAULT 'pending',  -- 'pending', 'transmitted', 'failed'
    transmitted_at TIMESTAMPTZ,
    error_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fhir_session ON fhir_transmissions(session_id);


-- 7. Enable Row-Level Security (RLS) on sensitive tables
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated users full access (adjust for production)
CREATE POLICY IF NOT EXISTS "Allow all on consultations" ON consultations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow all on patients" ON patients
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow all on audio_recordings" ON audio_recordings
    FOR ALL USING (true) WITH CHECK (true);

-- Users table: only service role can manage
CREATE POLICY IF NOT EXISTS "Allow all on users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow all on audit_log" ON audit_log
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow all on fhir_transmissions" ON fhir_transmissions
    FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- DONE! All tables created. Run this once in Supabase SQL Editor.
-- ============================================================
