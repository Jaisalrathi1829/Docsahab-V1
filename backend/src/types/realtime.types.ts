// ============================================================================
// Realtime Synchronization — TypeScript Types & Payload Contracts (Person 4)
// ============================================================================
// STABLE wire contracts for every realtime event. These are explicit DTOs —
// never raw Prisma objects — so the socket payload shape is decoupled from
// the database schema and stays backward compatible as either evolves.
//
// Contract rules:
//   - Additive evolution only: new optional fields may be added; existing
//     fields are never renamed, retyped, or removed.
//   - Every emergency-scoped payload carries `seq`, a per-emergency monotonic
//     sequence number, so clients can discard stale/out-of-order deliveries
//     and re-baseline from a snapshot after reconnecting.
//   - Timestamps are ISO-8601 strings.
// ============================================================================

import type { EmergencyStatus, Severity, HospitalResponse } from "@prisma/client";

// --------------------------------------------------------------------------
// Room naming
// --------------------------------------------------------------------------

export type RoomKind = "emergency" | "patient" | "ambulance" | "hospital";

/** `emergency:{id}` · `patient:{id}` · `ambulance:{id}` · `hospital:{id}` · `dispatch` */
export type RoomName = `${RoomKind}:${string}` | "dispatch";

// --------------------------------------------------------------------------
// Client → Server messages (all ack-based)
// --------------------------------------------------------------------------

export interface SubscribeRequest {
  room: string;
}

export interface SyncRequest {
  emergencyId: string;
}

export interface Ack<T = undefined> {
  success: boolean;
  /** Set when success=false. Same machine-code style as the HTTP API. */
  error?: { code: string; message: string };
  data?: T;
}

// --------------------------------------------------------------------------
// Core state DTO — the client's picture of an emergency
// --------------------------------------------------------------------------

export interface EmergencyStatePayload {
  emergencyId: string;
  status: EmergencyStatus;
  severity: Severity | null;
  emergencyType: string | null;
  etaMinutes: number | null;
  assignedAmbulanceId: string | null;
  assignedHospitalId: string | null;
  patient: {
    patientId: string;
    name: string | null;
    age: number | null;
    sex: string | null;
    bloodGroup: string | null;
    allergies: string[];
    conditions: string[];
    criticalAlert: string | null;
  };
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
  };
  updatedAt: string;
  /** Per-emergency monotonic sequence (see module header). */
  seq: number;
}

export interface TimelineEventPayload {
  status: EmergencyStatus;
  label: string;
  description: string | null;
  createdAt: string;
}

export interface HospitalCandidatePayload {
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  response: HospitalResponse;
  respondedAt: string | null;
}

/** Sent to a socket on emergency-room join and on explicit `sync` — the
 *  authoritative recovery baseline after any reconnection. */
export interface EmergencySnapshotPayload extends EmergencyStatePayload {
  timeline: TimelineEventPayload[];
  hospitalCandidates: HospitalCandidatePayload[];
}

// --------------------------------------------------------------------------
// Server → Client event payloads
// --------------------------------------------------------------------------

export interface EmergencyCreatedPayload extends EmergencyStatePayload {}

export interface EmergencyStatusPayload extends EmergencyStatePayload {
  previousStatus: EmergencyStatus | null;
  timelineEvent: TimelineEventPayload | null;
}

export interface EmergencyEtaPayload {
  emergencyId: string;
  etaMinutes: number;
  previousEtaMinutes: number | null;
  seq: number;
}

export interface EmergencyCompletedPayload extends EmergencyStatePayload {
  outcome: "ARRIVED" | "CANCELLED";
}

export interface AmbulanceAssignedPayload {
  emergencyId: string;
  ambulanceId: string;
  vehicleNo: string;
  distanceKm: number;
  etaMinutes: number;
  seq: number;
}

export interface HospitalSearchStartedPayload {
  emergencyId: string;
  radiusKm: number;
  requiredServices: string[];
  seq: number;
}

export interface HospitalCandidatesRankedPayload {
  emergencyId: string;
  radiusKm: number;
  candidates: Array<{
    hospitalId: string;
    hospitalName: string | null;
    rank: number;
    distanceKm: number;
    etaMinutes: number;
    totalScore: number;
  }>;
  seq: number;
}

export interface HospitalRequestSentPayload {
  emergencyId: string;
  hospitalId: string;
  rank: number;
  emergencyType: string | null;
  severity: Severity | null;
  patientAge: number | null;
  criticalAlert: string | null;
  estimatedArrivalMinutes: number;
  requiredServices: string[];
  seq: number;
}

export interface HospitalResponsePayload {
  emergencyId: string;
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  rejectionReason?: string | null;
  seq: number;
}

export interface HospitalAssignedPayload {
  emergencyId: string;
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  previousHospitalId?: string;
  seq: number;
}

export interface HospitalLockedPayload {
  emergencyId: string;
  hospitalId: string;
  seq: number;
}

export interface HospitalNotifiedPayload {
  emergencyId: string;
  hospitalId: string;
  severity: Severity | null;
  patientOnboard: boolean;
  etaMinutes: number;
  criticalAlert: string | null;
  seq: number;
}

export interface HospitalSearchExhaustedPayload {
  emergencyId: string;
  maxRadiusKm: number;
  candidatesTried: number;
  seq: number;
}

// --------------------------------------------------------------------------
// Server → Client event names (the wire contract)
// --------------------------------------------------------------------------

export const REALTIME_EVENTS = {
  // Emergency lifecycle
  EMERGENCY_CREATED: "emergency:created",
  EMERGENCY_STATUS: "emergency:status",
  EMERGENCY_SEVERITY: "emergency:severity", // alias fired on SEVERITY_SELECTED
  EMERGENCY_COMPLETED: "emergency:completed", // alias fired on ARRIVED / CANCELLED
  EMERGENCY_ETA: "emergency:eta",
  EMERGENCY_SNAPSHOT: "emergency:snapshot",
  // Ambulance
  AMBULANCE_ASSIGNED: "ambulance:assigned",
  // Hospital workflow
  HOSPITAL_SEARCH_STARTED: "hospital:searchStarted",
  HOSPITAL_CANDIDATES_RANKED: "hospital:candidatesRanked",
  HOSPITAL_REQUEST_SENT: "hospital:requestSent",
  HOSPITAL_ACCEPTED: "hospital:accepted",
  HOSPITAL_REJECTED: "hospital:rejected",
  HOSPITAL_ASSIGNED: "hospital:assigned",
  HOSPITAL_REASSIGNED: "hospital:reassigned",
  HOSPITAL_LOCKED: "hospital:locked",
  HOSPITAL_NOTIFIED: "hospital:notified",
  HOSPITAL_SEARCH_EXHAUSTED: "hospital:searchExhausted",
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
