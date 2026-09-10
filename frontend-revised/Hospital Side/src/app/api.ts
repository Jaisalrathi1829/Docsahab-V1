// ============================================================================
// Docsahab Hospital Console API Client
// ============================================================================
// Same pattern as the Patient and Ambulance apps: bearer-token session,
// server-authoritative state, no client-side simulation. The hospital
// console never decides ranking or selection — it only reflects what the
// real hospital-decision-engine already decided.
// ============================================================================

const API_BASE = "http://localhost:3000/api/v1";
const SESSION_KEY = "docsahab.hospital.session";

// --------------------------------------------------------------------------
// Session
// --------------------------------------------------------------------------

export function getToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    /* private mode */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// --------------------------------------------------------------------------
// Fetch wrapper
// --------------------------------------------------------------------------

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
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Cannot reach the Docsahab backend on http://localhost:3000", 0);
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new ApiError(
      payload?.error?.code ?? "UNKNOWN_ERROR",
      payload?.error?.message ?? `Request failed (${res.status})`,
      res.status
    );
  }
  return payload?.data as T;
}

// --------------------------------------------------------------------------
// Auth (OTP simulated backend-side — hospitals are pre-provisioned/seeded,
// there is no profile-onboarding step)
// --------------------------------------------------------------------------

export function requestOtp(phoneNumber: string) {
  return api<{ phoneNumber: string; otpLength: number; simulated: boolean }>(
    "POST",
    "/auth/hospital/request-otp",
    { phoneNumber }
  );
}

export interface HospitalProfile {
  id: string;
  name: string;
  phoneNumber: string | null;
  latitude: number;
  longitude: number;
  hasICU: boolean;
  hasTraumaCare: boolean;
  hasCardiology: boolean;
  profileCompleted: boolean;
}

export function verifyOtp(phoneNumber: string, code: string) {
  return api<{ token: string; role: "HOSPITAL"; subjectId: string; profileCompleted: boolean }>(
    "POST",
    "/auth/hospital/verify-otp",
    { phoneNumber, code }
  );
}

export function getCurrentUser() {
  return api<{ role: string; id: string; phoneNumber: string | null; profileCompleted: boolean; profile: HospitalProfile }>(
    "GET",
    "/auth/me"
  );
}

export function signOut() {
  return api<null>("POST", "/auth/sign-out");
}

// --------------------------------------------------------------------------
// Incoming requests — Name / Age / Sex ONLY, per product spec
// --------------------------------------------------------------------------

export interface PendingRequest {
  candidateId: string;
  emergencyId: string;
  rank: number;
  patientName: string | null;
  patientAge: number | null;
  patientSex: string | null;
}

export function getPendingRequests() {
  return api<PendingRequest[]>("GET", "/hospital/me/requests");
}

export interface RespondResult {
  emergency: { hospital: { name: string; temporary: boolean; locked: boolean } | null };
  replacementOccurred: boolean;
}

export function respondToRequest(candidateId: string, response: "ACCEPTED" | "REJECTED") {
  return api<RespondResult>("POST", `/hospital/me/requests/${candidateId}/respond`, { response });
}

// --------------------------------------------------------------------------
// Active case — waiting state pre-notify, Severity + ETA ONLY post-notify
// --------------------------------------------------------------------------

export type Severity = "RED" | "YELLOW" | "GREEN";

export interface ActiveCase {
  emergencyId: string;
  status: string;
  patientName: string | null;
  patientAge: number | null;
  patientSex: string | null;
  locked: boolean;
  notified: boolean;
  severity: Severity | null;
  etaToHospitalMinutes: number | null;
}

export function getActiveCase() {
  return api<ActiveCase | null>("GET", "/hospital/me/active-case");
}

// --------------------------------------------------------------------------
// Live status — real hospital-operated capacity, drives the engine's
// freshness/eligibility (not fabricated telemetry).
// --------------------------------------------------------------------------

export interface LiveStatus {
  hospitalId: string;
  acceptingEmergencyPatients: boolean;
  operationalStatus: string;
  emergencyDepartmentStatus: string;
  traumaDepartmentStatus: string;
  icuBedsAvailable: number;
  generalBedsAvailable: number;
  erBaysAvailable: number;
  traumaBaysAvailable: number;
  ventilatorsAvailable: number;
  lastUpdated: string;
}

export function getLiveStatus() {
  return api<LiveStatus>("GET", "/hospital/me/live-status");
}

export function updateLiveStatus(patch: Partial<Omit<LiveStatus, "hospitalId" | "lastUpdated">>) {
  return api<LiveStatus>("PATCH", "/hospital/me/live-status", patch);
}
