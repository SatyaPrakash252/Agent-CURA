/* ===========================================
   Project Cura – Constants & Configuration
   =========================================== */

export const API_BASE_URL = "http://127.0.0.1:8000";
export const WS_BASE_URL = "ws://127.0.0.1:8000";
export const API_V1 = `${API_BASE_URL}/api/v1`;

// Audio configuration
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHUNK_INTERVAL = 200; // milliseconds

// Color palette
export const Colors = {
  bg: "#0a1628",
  surface: "#111d32",
  surfaceHover: "#1a2940",
  border: "#1e3a5f",
  primary: "#00d4ff",
  primaryGlow: "rgba(0, 212, 255, 0.15)",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  doctor: "#00d4ff",
  patient: "#f59e0b",
} as const;

// Status labels
export const StatusLabels = {
  recording: "Recording",
  paused: "Paused",
  stopped: "Stopped",
  processing: "Processing...",
  finalized: "Finalized",
  error: "Error",
  idle: "Idle",
} as const;

// Status icons
export const StatusIcons = {
  recording: "🔴",
  paused: "⏸️",
  stopped: "⏹️",
  processing: "⚙️",
  finalized: "✅",
  error: "❌",
  idle: "⚪",
} as const;

// SOAP Section metadata
export const SOAPSections = [
  {
    key: "subjective" as const,
    label: "Subjective",
    icon: "💬",
    color: "#3b82f6",
    description: "Patient's reported symptoms and concerns",
  },
  {
    key: "objective" as const,
    label: "Objective",
    icon: "🔬",
    color: "#10b981",
    description: "Clinical findings and observations",
  },
  {
    key: "assessment" as const,
    label: "Assessment",
    icon: "📋",
    color: "#f59e0b",
    description: "Clinical assessment and diagnosis",
  },
  {
    key: "plan" as const,
    label: "Plan",
    icon: "📝",
    color: "#00d4ff",
    description: "Treatment plan and next steps",
  },
] as const;

// Navigation items
export const NavItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/consultation", label: "New Consultation", icon: "🎙️" },
  { href: "/patients", label: "Patients", icon: "👥" },
  { href: "/history", label: "History", icon: "📋" },
] as const;
