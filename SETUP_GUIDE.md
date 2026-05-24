# 📋 Project Cura — Step-by-Step Setup Guide

Complete guide to setting up Project Cura from scratch on a fresh system.

---

## Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.x | `git --version` |
| Docker (optional) | 24+ | `docker --version` |

---

## Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd "Document Agent"
```

---

## Step 2: Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and fill in your real values:

```env
# Get from https://console.groq.com/keys
GROQ_API_KEY=gsk_your_actual_key_here

# Get from your Supabase project settings > API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# IMPORTANT: Change this in production!
JWT_SECRET_KEY=generate-a-random-64-char-string

# Default admin account (created on first startup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
```

---

## Step 3: Set Up Supabase Database

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open your project → **SQL Editor**
3. Copy the entire contents of `backend/migrations/001_create_tables.sql`
4. Paste it into the SQL Editor
5. Click **Run**

This creates the following tables:
- `consultations` — SOAP notes, transcripts, billing data
- `patients` — Patient demographics
- `audio_recordings` — Audio file metadata
- `users` — Authentication (username/password)
- `audit_log` — Access tracking for compliance
- `fhir_transmissions` — FHIR bundle transmission records

---

## Step 4: Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (macOS/Linux)
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO | Project Cura API v2.0.0 starting up...
INFO | Pre-loading Whisper model...
INFO | Creating default admin user: admin
INFO | Uvicorn running on http://0.0.0.0:8000
```

Verify: Open http://localhost:8000/docs to see the API documentation.

---

## Step 5: Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

---

## Step 6: First Login

1. Open http://localhost:3000
2. You'll see the login screen
3. Use the default credentials:
   - Username: `admin`
   - Password: `admin123`
4. You're in! The dashboard should load with real API data

---

## Step 7: Run Tests

```bash
cd backend
python -m pytest tests/ -v
```

Expected output:
```
tests/test_schemas.py::TestSOAPNote::test_default_values PASSED
tests/test_schemas.py::TestBillingCode::test_required_fields PASSED
tests/test_safety.py::TestPIIRedaction::test_redact_email PASSED
tests/test_safety.py::TestDrugInteractions::test_warfarin_aspirin_interaction PASSED
...
```

---

## Step 8: Docker Deployment (Optional)

```bash
# From the project root
docker-compose up --build

# This starts:
# - Backend on port 8000
# - Frontend on port 3000
```

The backend health check ensures Whisper is loaded before the frontend starts.

---

## Step 9: Git Setup

```bash
# Initialize (if not already a git repo)
git init

# Add all files (secrets are in .gitignore)
git add .

# First commit
git commit -m "Project Cura v2.0.0 — Full production release"

# Add remote
git remote add origin <your-repo-url>

# Push
git push -u origin main
```

**Important:** The `.gitignore` is configured to exclude:
- `.env` (your real secrets)
- `node_modules/`, `.next/`, `__pycache__/`
- `models/` (large Whisper model files)
- `.venv/`

---

## Troubleshooting

### "GROQ_API_KEY missing" error
→ Make sure your `.env` file exists and has a valid Groq key.

### Whisper model download is slow
→ First run downloads ~500MB. Subsequent runs use the cached model in `models/`.

### "patients table not found" error
→ Run the SQL migration script (Step 3) in Supabase.

### Frontend shows "Network error"
→ Make sure the backend is running on port 8000 before starting the frontend.

### Docker build fails
→ Ensure Docker Desktop is running and you have enough disk space (~2GB).

---

## Production Checklist

- [ ] Change `JWT_SECRET_KEY` to a random 64-character string
- [ ] Change `ADMIN_PASSWORD` to a strong password
- [ ] Rotate Groq and Supabase keys if they were ever committed to Git
- [ ] Enable Supabase RLS policies for production
- [ ] Set up HTTPS with a reverse proxy (nginx/Caddy)
- [ ] Configure proper CORS origins for your domain
- [ ] Set up monitoring and error tracking (Sentry, etc.)
- [ ] Enable database backups in Supabase
