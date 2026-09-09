// ============================================================================
// Hospital Ranking & Acceptance — TypeScript Types (Person 3)
// ============================================================================
// Shared contracts for the Hospital module. Reuses the Prisma-generated
// Hospital / HospitalCandidate types — no duplicate model definitions.
// ============================================================================

import type { Hospital, HospitalCandidate, Severity } from "@prisma/client";

/**
 * The medical capabilities an emergency requires from a hospital, derived
 * from `emergencyType` (keyword rules) and `severity` (RED ⇒ ICU).
 * Limited to what the frozen Hospital model can express
 * (hasICU / hasTraumaCare / hasCardiology).
 */
export interface RequiredCapabilities {
  needsICU: boolean;
  needsTraumaCare: boolean;
  needsCardiology: boolean;
}

/**
 * One hospital scored by the ranking engine. `totalScore` is the weighted
 * blend of the three component scores (each in [0, 1]).
 */
export interface RankedHospital {
  hospital: Hospital;
  distanceKm: number;
  /** Estimated patient-transport ETA (patient location → hospital). */
  etaMinutes: number;
  capabilityScore: number;
  etaScore: number;
  resourceScore: number;
  totalScore: number;
}

/**
 * Outcome of a hospital's ACCEPT / REJECT response.
 */
export interface HospitalResponseResult {
  emergency: unknown; // full included emergency (shape owned by emergency layer)
  candidate: HospitalCandidate;
  /** True when this response changed the emergency's hospital assignment. */
  assignmentChanged: boolean;
  /** True when the assignment is locked (post-pickup) and the response was recorded as a no-op. */
  locked: boolean;
  /** True when this exact response had already been recorded (idempotent replay). */
  idempotent: boolean;
}

/**
 * Payload sent to each ranked hospital when acceptance is requested
 * (delivered today via `emergencyEvents` + the hospital-requests endpoint;
 * Person 4 will push it over sockets).
 */
export interface HospitalRequestPayload {
  emergencyId: string;
  hospitalId: string;
  rank: number;
  emergencyType: string | null;
  severity: Severity | null;
  patientAge: number | null;
  criticalAlert: string | null;
  /** Estimated ambulance arrival at the hospital (transport ETA), minutes. */
  estimatedArrivalMinutes: number;
  requiredServices: string[];
}

/** Payload emitted on `hospitalAssigned` / `hospitalReassigned`. */
export interface HospitalAssignmentEvent {
  emergencyId: string;
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  /** Only present on reassignment. */
  previousHospitalId?: string;
  emergency: unknown;
}

/** Payload emitted on `hospitalNotified`. */
export interface HospitalNotifiedEvent {
  emergencyId: string;
  hospitalId: string;
  severity: Severity | null;
  patientOnboard: true;
  etaMinutes: number;
  criticalAlert: string | null;
  emergency: unknown;
}
