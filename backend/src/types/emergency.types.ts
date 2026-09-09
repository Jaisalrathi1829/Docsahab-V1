// ============================================================================
// Emergency TypeScript Types
// ============================================================================
// Shared type definitions for the Emergency Core Service.
// These types define the contract between layers (controller ↔ service ↔ repo)
// and the shape of API request/response payloads.
// ============================================================================

import { EmergencyStatus, Severity, HospitalResponse } from "@prisma/client";

// --------------------------------------------------------------------------
// Input Types (what callers send to the service)
// --------------------------------------------------------------------------

/**
 * Input for creating a new emergency via POST /sos.
 * patientId and location are required. Profile fields are optional but
 * should be provided when available for downstream responder visibility.
 */
export interface CreateEmergencyInput {
  patientId: string;
  patientLatitude: number;
  patientLongitude: number;
  patientAddress?: string;
  emergencyType?: string;

  // Emergency profile (denormalized from patient profile)
  patientName?: string;
  patientAge?: number;
  patientSex?: string;
  patientBloodGroup?: string;
  patientAllergies?: string[];
  patientConditions?: string[];
  patientMedications?: string[];
}

/**
 * Input for updating emergency status via PATCH /emergency/:id/status.
 * The status field is required. All other fields are optional context
 * that gets persisted alongside the status change.
 */
export interface UpdateStatusInput {
  status: EmergencyStatus;

  // Optional fields that may accompany specific transitions
  severity?: Severity;
  assignedAmbulanceId?: string;
  assignedHospitalId?: string;
  etaMinutes?: number;
  emergencyType?: string;
  criticalAlert?: string;

  // Optional timeline event metadata
  description?: string;
  metadata?: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Response Types (what the API returns)
// --------------------------------------------------------------------------

/**
 * Full emergency response returned by GET /emergency/:id.
 */
export interface EmergencyResponse {
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

  hospitalCandidates: HospitalCandidateResponse[];
  timelineEvents: TimelineEventResponse[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Timeline event returned in emergency responses and GET /emergency/:id/timeline.
 */
export interface TimelineEventResponse {
  id: string;
  emergencyId: string;
  status: EmergencyStatus;
  label: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Hospital candidate entry for multi-hospital acceptance tracking.
 */
export interface HospitalCandidateResponse {
  id: string;
  emergencyId: string;
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  response: HospitalResponse;
  respondedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}
