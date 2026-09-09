// ============================================================================
// Docsahab Patient API Client
// ============================================================================
// Every piece of emergency state this app renders comes from here. The app
// holds NO lifecycle logic of its own — it triggers backend actions and draws
// whatever the backend says is true.
//
// Types mirror the backend contracts as literal unions so an invalid status or
// severity cannot be constructed on this side at all.
// ============================================================================

const API_BASE = "http://localhost:3000/api/v1";
const SESSION_KEY = "docsahab.patient.session";

// --------------------------------------------------------------------------
// Backend enums (mirror prisma/schema.prisma)
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
export type CallStatus = "NONE" | "INITIATED" | "ACTIVE" | "ENDED";

// --------------------------------------------------------------------------
// View model (built server-side by emergency-view.service.ts)
// --------------------------------------------------------------------------

export interface RouteEstimate {
  distanceKm: number;
  etaMinutes: number;
  provider: string;
  simulated: boolean;
}

export interface EmergencyView {
  id: string;
  status: EmergencyStatus;
  severity: Severity | null;
  probableEmergency: string | null;
  criticalAlert: string | null;
  criticalAlertIsHighRisk: boolean;
  patient: {
    id: string;
    name: string | null;
    age: number | null;
    gender: string | null;
    bloodGroup: string | null;
    allergies: string[];
    conditions: string[];
    medications: string[];
    phoneNumber: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
  location: { latitude: number; longitude: number; address: string | null };
  ambulance: {
    id: string;
    vehicleNo: string;
    type: string | null;
    driverName: string | null;
    latitude: number;
    longitude: number;
  } | null;
  hospital: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    temporary: boolean;
    locked: boolean;
    lockedAt: string | null;
    notifiedAt: string | null;
  } | null;
  navigation: {
    toPatient: RouteEstimate | null;
    toHospital: RouteEstimate | null;
    activeLeg: "patient" | "hospital";
  };
  call: {
    status: CallStatus;
    active: boolean;
    startedAt: string | null;
    endedAt: string | null;
    simulated: boolean;
  };
  patientOnboard: boolean;
  etaMinutes: number | null;
  timeline: Array<{
    status: EmergencyStatus;
    label: string;
    description: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PatientProfile {
  id: string;
  phoneNumber: string;
  fullName: string;
  age: number;
  sex: string | null;
  bloodGroup: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  profileCompleted: boolean;
}

// --------------------------------------------------------------------------
// Session storage
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
    /* private mode — the session simply won't survive a refresh */
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

async function api<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Cannot reach the Docsahab backend on http://localhost:3000",
      0
    );
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const code = payload?.error?.code ?? "UNKNOWN_ERROR";
    // An expired/invalid session must drop the client back to sign-in rather
    // than leaving it stuck retrying with a dead token.
    if (res.status === 401) clearToken();
    throw new ApiError(
      code,
      payload?.error?.message ?? `Request failed (${res.status})`,
      res.status
    );
  }

  return payload?.data as T;
}

// --------------------------------------------------------------------------
// Auth (OTP is simulated backend-side — any 6 digits verify a requested code)
// --------------------------------------------------------------------------

export function requestOtp(phoneNumber: string) {
  return api<{ phoneNumber: string; otpLength: number; simulated: boolean }>(
    "POST",
    "/auth/patient/request-otp",
    { phoneNumber }
  );
}

export async function verifyOtp(phoneNumber: string, code: string) {
  const session = await api<{
    token: string;
    subjectId: string;
    profileCompleted: boolean;
  }>("POST", "/auth/patient/verify-otp", { phoneNumber, code });
  setToken(session.token);
  return session;
}

/** Restores the whole routing decision after a refresh. */
export function getCurrentUser() {
  return api<{
    role: "PATIENT" | "AMBULANCE";
    id: string;
    phoneNumber: string;
    profileCompleted: boolean;
    profile: PatientProfile;
  }>("GET", "/auth/me");
}

export async function signOut() {
  try {
    await api("POST", "/auth/sign-out");
  } finally {
    clearToken();
  }
}

// --------------------------------------------------------------------------
// Profile
// --------------------------------------------------------------------------

export interface PatientProfileInput {
  fullName: string;
  age: number | string;
  gender?: string;
  bloodGroup: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export function saveProfile(profile: PatientProfileInput) {
  return api<PatientProfile>("PUT", "/patient/me/profile", profile);
}

export function getProfile() {
  return api<PatientProfile>("GET", "/patient/me/profile");
}

// --------------------------------------------------------------------------
// Emergency
// --------------------------------------------------------------------------

/** The live emergency, or null when idle. Polled while the app is open. */
export function getActiveEmergency() {
  return api<EmergencyView | null>("GET", "/patient/me/emergency");
}

/**
 * Confirms the SOS. The backend creates the emergency AND dispatches an
 * ambulance in one call, so a confirmed SOS is never left undispatched.
 */
export function triggerSos(input: {
  latitude: number;
  longitude: number;
  address?: string;
  locationIsPrecise?: boolean;
}) {
  return api<{
    emergency: EmergencyView;
    dispatch: { assigned: boolean; note: string | null };
    alreadyActive: boolean;
  }>("POST", "/patient/me/sos", input);
}

export function cancelEmergency() {
  return api<EmergencyView>("POST", "/patient/me/emergency/cancel");
}
