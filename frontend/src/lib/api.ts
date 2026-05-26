/* ===========================================
   Project Cura – API Client
   REST API wrapper with error handling
   =========================================== */

import { API_V1 } from "./constants";
import type {
  ConsultationResult,
  ConsultationFinalizeRequest,
  PatientCreate,
  PatientResponse,
  HealthResponse,
  FHIRBundle,
} from "@/types";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const path = endpoint.startsWith("/api") ? endpoint.slice(4) : endpoint;
  const url = `${API_V1}${path}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new ApiError(
        `API Error: ${response.status} - ${errorBody}`,
        response.status
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : "Failed to fetch"}`,
      0
    );
  }
}

// --- Consultation Endpoints ---

export async function startConsultation(
  patientId: string
): Promise<{ session_id: string }> {
  return fetchApi<{ session_id: string }>("/api/consultation/start", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId }),
  });
}

export async function finalizeConsultation(
  request: ConsultationFinalizeRequest
): Promise<ConsultationResult> {
  return fetchApi<ConsultationResult>("/api/consultation/finalize", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getConsultation(
  sessionId: string
): Promise<ConsultationResult> {
  return fetchApi<ConsultationResult>(`/api/consultation/${sessionId}`);
}

export async function getFhirBundle(sessionId: string): Promise<FHIRBundle> {
  return fetchApi<FHIRBundle>(`/api/consultation/${sessionId}/fhir`);
}

// --- Patient Endpoints ---

export async function listPatients(
  search?: string,
  limit?: number
): Promise<PatientResponse[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (limit) params.set("limit", limit.toString());
  const query = params.toString();
  return fetchApi<PatientResponse[]>(
    `/api/patients${query ? `?${query}` : ""}`
  );
}

export async function getPatient(patientId: string): Promise<PatientResponse> {
  return fetchApi<PatientResponse>(`/api/patients/${patientId}`);
}

export async function createPatient(
  patient: PatientCreate
): Promise<PatientResponse> {
  return fetchApi<PatientResponse>("/api/patients", {
    method: "POST",
    body: JSON.stringify(patient),
  });
}

export async function getPatientHistory(
  patientId: string
): Promise<ConsultationResult[]> {
  return fetchApi<ConsultationResult[]>(
    `/api/patients/${patientId}/consultations`
  );
}

// --- System Endpoints ---

export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>("/api/health");
}

// Export the error class for consumers
export { ApiError };
