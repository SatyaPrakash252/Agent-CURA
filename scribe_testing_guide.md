# Project Cura — Single-User Testing & Playbook Guide

Welcome! This guide is designed to help you—an alone developer or tester—validate the entire Project Cura pipeline, including:
1. **Supabase Database Clean & Self-Healing Sync** (validating that doctor, admin, and patient logins are synced perfectly).
2. **Real-time Speaker Diarization** (verifying that the AI successfully distinguishes between you roleplaying as the "Doctor" and the "Patient" in real-time).

---

## 🛠️ Step 1: Clean and Prepare Your Supabase Database

To ensure a perfectly clean database, follow these steps:

1. Open your [Supabase Dashboard](https://app.supabase.com) and navigate to your Project.
2. Open the **SQL Editor** from the left panel.
3. Click **New query**, paste the entire contents of [002_clean_and_sync_schema.sql](file:///d:/Document%20Agent/backend/migrations/002_clean_and_sync_schema.sql), and click **Run**.
4. **Result**: Any legacy/unnecessary tables will be dropped instantly, and the 6 core Project Cura tables (`users`, `patients`, `consultations`, `audio_recordings`, `audit_log`, `fhir_transmissions`) will be cleanly created with proper indexes, primary keys, and RLS policies.

---

## 🚀 Step 2: Start Project Cura Locally

You can run Project Cura either using **Docker Compose** or **Direct Python + Node.js**.

### Option A: Using Docker Compose (Recommended)
Run the following command in the root folder of the project (`d:\Document Agent`):
```bash
docker compose up --build -d
```

### Option B: Running Locally
1. **Backend**:
   ```bash
   cd backend
   # Make sure your virtualenv is active
   python -m uvicorn app.main:app --reload --port 8000
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

---

## 🔄 Step 3: Verify the Self-Healing Sync Worker (SQLite ➔ Supabase)

On startup, Project Cura automatically synchronizes all local developer data from SQLite straight to Supabase.

1. **Verify Startup Logs**:
   Look at your backend terminal logs. You should see:
   ```text
   INFO | app.main | Application startup - pre-initializing database...
   INFO | app.models.database | Supabase connectivity confirmed — using cloud database.
   INFO | app.models.database | Initializing local SQLite to Supabase database sync...
   INFO | app.models.database | Syncing user 'admin' to Supabase...
   INFO | app.models.database | Local SQLite to Supabase database sync complete.
   ```
2. **Confirm in Supabase Dashboard**:
   Go to the **Table Editor** on Supabase. Open the `users` and `patients` tables. You will see that the default administrator (`admin`) and all local patients have been instantly and perfectly synchronized up to your Supabase tables!

---

## 🎙️ Step 4: Real-Time Speaker Diarization Playplay

Since you are testing alone, you will play two roles: the **Doctor** (using your normal speaking voice) and the **Patient** (using a slightly different tone, pitch, or speed, or speaking from a different distance from the microphone).

### The Clinical Roleplay Script

Open the Project Cura Web UI in your browser (usually `http://localhost:3000`), log in, search or create a patient, and click **Start Recording**. Read the following script aloud:

> **[Speak in a firm, professional Doctor tone]**
> *"Hello Mr. Henderson, welcome back to the clinic. I've received your lab results from last week, and I'd like to discuss the next steps in managing your blood pressure. How have you been feeling since we started the lisinopril?"*
>
> *(Wait 1 second)*
>
> **[Speak in a softer, hesitating Patient tone]**
> *"Well, doctor, I've been feeling okay for the most part, but I do get a little bit dizzy in the mornings when I stand up quickly. Is that normal?"*
>
> *(Wait 1 second)*
>
> **[Speak in your normal Doctor tone]**
> *"That morning dizziness can happen when we start new blood pressure medication. I'd like you to monitor your readings twice daily—once in the morning and once in the evening—and record them in your patient portal. We will review those values in two weeks."*

---

## 🔍 Step 5: Verify the Diarization Results

1. **Real-time Web Panel**:
   Watch the live transcription screen as you read the script.
   * Your first paragraph should be automatically labeled as **Doctor**.
   * Your second paragraph should be automatically labeled as **Patient**.
   * Your third paragraph should be labeled as **Doctor**.
2. **Verify Browser Console**:
   Right-click in the browser, choose **Inspect**, and open the **Console** tab.
   * You will see the incoming WebSocket messages containing Direct-from-Deepgram words array payload:
     `{"channel": {"alternatives": [{"transcript": "...", "words": [{"word": "...", "speaker": 0}]}]}}`
   * Confirm that the word-level speaker ID `0` maps dynamically to the **Doctor** label, and non-zero IDs (e.g. `1`) map to the **Patient** label.
3. **Save Consultation**:
   Click **Stop Recording** and **Save**.
4. **Supabase Validation**:
   Go to your Supabase Table Editor ➔ `consultations` table.
   * Open the newly saved row.
   * Verify that the SOAP note (`subjective`, `objective`, `assessment`, `plan`), the `raw_transcript`, and the parsed speaker segments are perfectly populated and synced in the cloud table!

---

## 💡 Troubleshooting Tips

* **Connecting/Disconnecting Loop**: Ensure your local `.env` contains a valid `DEEPGRAM_API_KEY` and a valid network connection.
* **Speaker ID Swap**: If the AI swaps the labels, make sure to wait a brief 1-second pause when changing between roles to give the streaming acoustic model clear voice distinction frames.
