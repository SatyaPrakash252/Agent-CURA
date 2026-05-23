/* ===========================================
   Project Cura – TypeScript Type Definitions
   Matches all backend Pydantic schemas exactly
   =========================================== */

// --- SOAP Note ---
export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// --- Billing Code ---
export interface BillingCode {
  code: string;
  description: string;
  code_type: string; // "ICD-10-CM" or "HCPCS"
}

// --- Clinical Intent ---
export interface ClinicalIntent {
  type: string; // LAB, MEDICINE, FOLLOWUP, REFERRAL
  item: string;
  urgency: string;
}

// --- Safety Flag ---
export interface SafetyFlag {
  level: string; // INFO, WARNING, CRITICAL
  message: string;
  requires_review: boolean;
}

// --- Speaker Segment ---
export interface SpeakerSegment {
  speaker: string; // "Doctor" or "Patient"
  text: string;
  start_time: number;
  end_time: number;
}

// --- Transcript Chunk (received via WebSocket) ---
export interface TranscriptChunk {
  type?: string; // "transcript" | "error" | "status"
  text: string;
  speaker: string;
  timestamp: number;
  is_final: boolean;
  message?: string;
}

// --- Consultation Result (finalized) ---
export interface ConsultationResult {
  session_id: string;
  patient_id: string;
  soap: SOAPNote;
  billing_codes: BillingCode[];
  intents: ClinicalIntent[];
  safety_flags: SafetyFlag[];
  speaker_segments: SpeakerSegment[];
  raw_transcript: string;
  redacted_transcript: string;
  fhir_bundle: Record<string, unknown> | null;
  confidence_score: number;
  created_at: string;
}

// --- Patient ---
export interface PatientCreate {
  patient_id: string;
  name: string;
  age: number | null;
  gender: string;
  contact: string;
  notes: string;
}

export interface PatientResponse {
  patient_id: string;
  name: string;
  age: number | null;
  gender: string;
  contact?: string;
  notes?: string;
  consultation_count: number;
  id?: number;
  created_at: string;
}

// --- Consultation Start ---
export interface ConsultationStartRequest {
  patient_id: string;
  session_id?: string;
}

// --- Consultation Finalize ---
export interface ConsultationFinalizeRequest {
  session_id: string;
  patient_id: string;
  transcript: string;
  speaker_segments?: SpeakerSegment[];
}

// --- Health Check ---
export interface HealthResponse {
  status: string;
  whisper_loaded: boolean;
  groq_configured: boolean;
  supabase_connected: boolean;
  version: string;
}

// --- FHIR Bundle ---
export interface FHIRBundle {
  resourceType: "Bundle";
  type: "collection";
  entry: FHIRBundleEntry[];
}

export interface FHIRBundleEntry {
  resource: {
    resourceType: string;
    id?: string;
    status?: string;
    [key: string]: unknown;
  };
}

// --- WebSocket Message ---
export type WebSocketMessage =
  | { type: "transcript"; data: TranscriptChunk }
  | { type: "error"; message: string }
  | { type: "status"; status: string; message?: string }
  | { type: "control"; action: "pause" | "resume" | "stop" };

// --- App State ---
export interface AppState {
  sessionId: string | null;
  patientId: string | null;
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  isFinalized: boolean;
  transcriptSegments: SpeakerSegment[];
  consultationResult: ConsultationResult | null;
  error: string | null;
}

// --- WebSocket Connection State ---
export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

// --- Recording Permission State ---
export type PermissionState = "prompt" | "granted" | "denied" | "unknown";
