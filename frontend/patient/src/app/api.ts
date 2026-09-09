// ============================================================================
// Docsahab API Client — Shared by all three frontend apps
// ============================================================================
// Talks to the Docsahab backend (Emergency Core + Ambulance Matching +
// Hospital Ranking). This file is copied identically into each app.
//
// Design rules:
//  - Types mirror the backend enums as LITERAL UNIONS, not loose `string`.
//    This is what stops invalid values (e.g. a status that doesn't exist, or
//    a raw UI severity word) from reaching the API at all.
//  - Severity is kept in BACKEND vocabulary (RED/YELLOW/GREEN) everywhere in
//    this module. No hidden translation happens on the wire — each app maps
//    to its own display vocabulary at the point of use via the exported
//    helpers below. Explicit beats implicit.
//  - Lifecycle transitions that a purpose-built endpoint owns (ambulance
//    assignment, hospital accept/reject, hospital notification) are exposed
//    as their own functions. Do NOT drive those through updateStatus().
// ============================================================================

const API_BASE = "http://localhost:3000/api/v1";

// --------------------------------------------------------------------------
// Backend enums (mirror prisma/schema.prisma exactly)
// --------------------------------------------------------------------------

export type EmergencyStatus =
  | "SOS_TRIGGERED"
  | "AMBULANCE_ASSIGNED"
  | "AMBULANCE_EN_ROUTE"
  | "PATIENT_PICKED_UP"
  | "SEVERITY_SELECTED"
  | "HOSPITAL_SEARCHING"
  | "HOSPITAL_ACCEPTANCE_REQUESTED"
  | "HOSPITAL_ACCEPTED"
  | "HOSPITAL_NOTIFIED"
  | "EN_ROUTE_TO_HOSPITAL"
  | "ARRIVED"
  | "CANCELLED";

export type Severity = "RED" | "YELLOW" | "GREEN";

export type HospitalResponseValue = "PENDING" | "ACCEPTED" | "REJECTED";

// --------------------------------------------------------------------------
// Severity display mapping
// --------------------------------------------------------------------------
// The backend is authoritative (RED/YELLOW/GREEN). Each app renders its own
// vocabulary; convert at the edge with these helpers.

/** Ambulance UI speaks red/yellow/green. */
export type AmbulanceSeverity = "red" | "yellow" | "green";
/** Hospital UI speaks critical/high/moderate. */
export type HospitalSeverity = "critical" | "high" | "moderate";

const TO_HOSPITAL_UI: Record<Severity, HospitalSeverity> = {
  RED: "critical",
  YELLOW: "high",
  GREEN: "moderate",
};

export function severityToBackend(value: AmbulanceSeverity): Severity {
  return value.toUpperCase() as Severity;
}

export function severityToHospitalUi(
  value: Severity | null | undefined,
  fallback: HospitalSeverity = "moderate"
): HospitalSeverity {
  if (!value) return fallback;
  return TO_HOSPITAL_UI[value] ?? fallback;
}

export function severityToAmbulanceUi(
  value: Severity | null | undefined
): AmbulanceSeverity | null {
  if (!value) return null;
  return value.toLowerCase() as AmbulanceSeverity;
}

// --------------------------------------------------------------------------
// Entity types (mirror backend response shapes)
// --------------------------------------------------------------------------

export type TimelineEvent = {
  id: string;
  emergencyId: string;
  status: EmergencyStatus;
  label: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
};

export type HospitalCandidate = {
  id: string;
  emergencyId: string;
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  response: HospitalResponseValue;
  respondedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type Ambulance = {
  id: string;
  vehicleNo: string;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
};

export type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  hasICU: boolean;
  hasTraumaCare: boolean;
  hasCardiology: boolean;
  availableBeds: number;
};

export type Emergency = {
  id: string;
  patientId: string;
  status: EmergencyStatus;
  severity: Severity | null;
  emergencyType: string | null;
  patientLatitude: number;
  patientLongitude: number;
  patientAddress: string | null;
  assignedAmbulanceId: string | null;
  assignedHospitalId: string | null;
  etaMinutes: number | null;
  patientName: string | null;
  patientAge: number | null;
  patientSex: string | null;
  patientBloodGroup: string | null;
  patientAllergies: string[];
  patientConditions: string[];
  criticalAlert: string | null;
  createdAt: string;
  updatedAt: string;
  timelineEvents: TimelineEvent[];
  hospitalCandidates: HospitalCandidate[];
  assignedAmbulance?: Ambulance | null;
  assignedHospital?: Hospital | null;
};

/** One pending acceptance request, as returned to a hospital console. */
export type HospitalRequest = {
  candidateId: string;
  requestedAt: string;
  emergencyId: string;
  hospitalId: string;
  rank: number;
  emergencyType: string | null;
  severity: Severity | null;
  patientAge: number | null;
  criticalAlert: string | null;
  estimatedArrivalMinutes: number;
  requiredServices: string[];
  emergency: Emergency;
};

// --------------------------------------------------------------------------
// Fetch wrapper
// --------------------------------------------------------------------------

/** Error carrying the backend's machine-readable code (e.g. NO_AMBULANCE_AVAILABLE). */
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Cannot reach the Docsahab backend on http://localhost:3000",
      0
    );
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      payload?.error?.code ?? "UNKNOWN_ERROR",
      payload?.error?.message ?? `Request failed (${res.status})`,
      res.status
    );
  }
  return payload?.data as T;
}

// --------------------------------------------------------------------------
// Emergency Core (Person 1)
// --------------------------------------------------------------------------

export function createEmergency(input: {
  patientId: string;
  patientLatitude: number;
  patientLongitude: number;
  patientAddress?: string;
  emergencyType?: string;
  patientName?: string;
  patientAge?: number;
  patientSex?: string;
  patientBloodGroup?: string;
  patientAllergies?: string[];
  patientConditions?: string[];
}): Promise<Emergency> {
  return api<Emergency>("POST", "/sos", input);
}

export function getEmergency(id: string): Promise<Emergency> {
  return api<Emergency>("GET", `/emergency/${id}`);
}

/** The emergency currently in progress, or null when the system is idle. */
export function getActiveEmergency(): Promise<Emergency | null> {
  return api<Emergency | null>("GET", "/emergencies/active");
}

/**
 * Generic lifecycle advance. Use ONLY for transitions no dedicated endpoint
 * owns: AMBULANCE_EN_ROUTE, PATIENT_PICKED_UP, SEVERITY_SELECTED,
 * EN_ROUTE_TO_HOSPITAL, ARRIVED, CANCELLED.
 */
export function updateStatus(
  id: string,
  input: {
    status: EmergencyStatus;
    severity?: Severity;
    etaMinutes?: number;
    emergencyType?: string;
    description?: string;
  }
): Promise<Emergency> {
  return api<Emergency>("PATCH", `/emergency/${id}/status`, input);
}

export function getTimeline(id: string): Promise<TimelineEvent[]> {
  return api<TimelineEvent[]>("GET", `/emergency/${id}/timeline`);
}

// --------------------------------------------------------------------------
// Ambulance Matching (Person 2)
// --------------------------------------------------------------------------

/** Finds the nearest available ambulance and assigns it atomically. */
export function assignAmbulance(emergencyId: string): Promise<Emergency> {
  return api<Emergency>("POST", `/emergency/${emergencyId}/assign-ambulance`);
}

export function listAmbulances(available?: boolean): Promise<Ambulance[]> {
  const q = available === undefined ? "" : `?available=${available}`;
  return api<Ambulance[]>("GET", `/ambulances${q}`);
}

// --------------------------------------------------------------------------
// Hospital Ranking & Acceptance (Person 3)
// --------------------------------------------------------------------------

/** Manually run a hospital search round (also runs automatically on EN_ROUTE). */
export function findHospitals(emergencyId: string): Promise<{
  candidates: HospitalCandidate[];
  radiusKm: number;
}> {
  return api("POST", `/emergency/${emergencyId}/find-hospitals`);
}

/** A hospital's ACCEPT/REJECT. Idempotent and transactional on the backend. */
export function respondToHospitalRequest(
  emergencyId: string,
  input: {
    hospitalId: string;
    response: "ACCEPTED" | "REJECTED";
    rejectionReason?: string;
  }
): Promise<{
  emergency: Emergency;
  candidate: HospitalCandidate;
  assignmentChanged: boolean;
  locked: boolean;
  idempotent: boolean;
}> {
  return api("POST", `/emergency/${emergencyId}/hospital-response`, input);
}

/** Notifies the assigned hospital and advances to HOSPITAL_NOTIFIED. */
export function notifyHospital(emergencyId: string): Promise<Emergency> {
  return api<Emergency>("POST", `/emergency/${emergencyId}/notify-hospital`);
}

/** A hospital console's pending acceptance requests. */
export function getHospitalRequests(
  hospitalId: string
): Promise<HospitalRequest[]> {
  return api<HospitalRequest[]>("GET", `/hospital/${hospitalId}/requests`);
}

// --------------------------------------------------------------------------
// Health
// --------------------------------------------------------------------------

export function healthCheck(): Promise<{
  service: string;
  status: string;
  timestamp: string;
}> {
  return api("GET", "/health");
}
