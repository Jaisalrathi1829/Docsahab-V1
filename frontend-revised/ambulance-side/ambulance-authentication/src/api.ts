// ============================================================================
// Docsahab Ambulance API Client
// ============================================================================
// The ambulance app renders and acts on the SAME Emergency record the patient
// app is watching. It holds no lifecycle state of its own: every transition
// below is a backend action, and the screen is redrawn from the response.
// ============================================================================

const API_BASE = "http://localhost:3000/api/v1";
const SESSION_KEY = "docsahab.ambulance.session";

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
  /** Derived from the patient's medical HISTORY — not from allergies. */
  probableEmergency: string | null;
  /** Derived from the patient's ALLERGIES — a separate concept. */
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

export interface AmbulanceProfile {
  id: string;
  phoneNumber: string | null;
  vehicleNo: string;
  driverName: string | null;
  driverLicense: string | null;
  drivingExperience: string | null;
  ambulanceType: string | null;
  registrationNumber: string | null;
  serviceArea: string | null;
  baseLocation: string | null;
  emergencyContact: string | null;
  isOnline: boolean;
  isAvailable: boolean;
  latitude: number;
  longitude: number;
  profileCompleted: boolean;
}

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
    throw new ApiError(
      "NETWORK_ERROR",
      "Cannot reach the Docsahab backend on http://localhost:3000",
      0
    );
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
// Auth (OTP simulated backend-side)
// --------------------------------------------------------------------------

export function requestOtp(phoneNumber: string) {
  return api<{ phoneNumber: string; otpLength: number; simulated: boolean }>(
    "POST",
    "/auth/ambulance/request-otp",
    { phoneNumber }
  );
}

export async function verifyOtp(phoneNumber: string, code: string) {
  const session = await api<{
    token: string;
    subjectId: string;
    profileCompleted: boolean;
  }>("POST", "/auth/ambulance/verify-otp", { phoneNumber, code });
  setToken(session.token);
  return session;
}

export function getCurrentUser() {
  return api<{
    role: "PATIENT" | "AMBULANCE";
    id: string;
    phoneNumber: string;
    profileCompleted: boolean;
    profile: AmbulanceProfile;
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
// Profile & dispatch state
// --------------------------------------------------------------------------

export interface AmbulanceProfileInput {
  driverName: string;
  driverLicense?: string;
  drivingExperience?: string;
  vehicleNo: string;
  ambulanceType?: string;
  registrationNumber?: string;
  serviceArea?: string;
  baseLocation?: string;
  emergencyContact?: string;
}

export function saveProfile(profile: AmbulanceProfileInput) {
  return api<AmbulanceProfile>("PUT", "/ambulance/me/profile", profile);
}

export function getProfile() {
  return api<AmbulanceProfile>("GET", "/ambulance/me/profile");
}

/**
 * The REAL dispatch toggle. Going offline is refused by the backend while an
 * emergency is in progress, and an offline unit is genuinely excluded from
 * matching — this is not a cosmetic switch.
 */
export function setDispatchStatus(input: {
  isOnline: boolean;
  latitude?: number;
  longitude?: number;
}) {
  return api<AmbulanceProfile>("PATCH", "/ambulance/me/dispatch-status", input);
}

export function updateLocation(latitude: number, longitude: number) {
  return api<AmbulanceProfile>("PATCH", "/ambulance/me/location", {
    latitude,
    longitude,
  });
}

// --------------------------------------------------------------------------
// Emergency — all actions operate on the shared Emergency record
// --------------------------------------------------------------------------

export function getActiveEmergency() {
  return api<EmergencyView | null>("GET", "/ambulance/me/emergency");
}

const action = (id: string, path: string, body?: unknown) =>
  api<EmergencyView>("POST", `/ambulance/me/emergency/${id}/${path}`, body);

/** Crew starts driving — this is also what starts hospital coordination. */
export const startEnRoute = (id: string) => action(id, "en-route");

/** Medic initiates the call; the patient app enters speaker mode by itself. */
export const startCall = (id: string) => action(id, "call");
export const endCall = (id: string) => action(id, "call/end");

/** Patient onboard — this is what locks the hospital destination. */
export const pickUpPatient = (id: string) => action(id, "pickup");

/** Manual medic triage. Never inferred. */
export const selectSeverity = (id: string, severity: Severity) =>
  action(id, "severity", { severity });

export const notifyHospital = (id: string) => action(id, "notify-hospital");
export const enRouteToHospital = (id: string) => action(id, "en-route-hospital");
export const markArrived = (id: string) => action(id, "arrived");
