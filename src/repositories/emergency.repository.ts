// ============================================================================
// Emergency Repository
// ============================================================================
// Pure data access layer — all Prisma queries live here.
// No business logic. No validation. No HTTP concerns.
//
// This layer is also the integration point for other modules:
// Person 2 (Ambulance Matching) and Person 3 (Hospital Ranking) can
// import and use this repository to read/write emergency data without
// going through HTTP.
// ============================================================================

import { prisma } from "../prisma/client";
import { EmergencyStatus, Severity, Prisma } from "@prisma/client";
import { CreateEmergencyInput } from "../types/emergency.types";

// --------------------------------------------------------------------------
// Default includes for emergency queries — always load relations
// --------------------------------------------------------------------------

const EMERGENCY_INCLUDE = {
  patient: true,
  assignedAmbulance: true,
  assignedHospital: true,
  timelineEvents: {
    orderBy: { createdAt: "asc" as const },
  },
  hospitalCandidates: {
    orderBy: { rank: "asc" as const },
  },
};

// --------------------------------------------------------------------------
// Emergency CRUD
// --------------------------------------------------------------------------

/**
 * Create a new emergency record.
 * Called when a patient triggers SOS.
 */
export async function createEmergency(input: CreateEmergencyInput) {
  return prisma.emergency.create({
    data: {
      patientId: input.patientId,
      patientLatitude: input.patientLatitude,
      patientLongitude: input.patientLongitude,
      patientAddress: input.patientAddress,
      emergencyType: input.emergencyType,
      patientName: input.patientName,
      patientAge: input.patientAge,
      patientSex: input.patientSex,
      patientBloodGroup: input.patientBloodGroup,
      patientAllergies: input.patientAllergies ?? [],
      patientConditions: input.patientConditions ?? [],
      // Auto-derive criticalAlert from first allergy if present
      criticalAlert:
        input.patientAllergies && input.patientAllergies.length > 0
          ? `${input.patientAllergies[0]} Allergy`
          : undefined,
    },
    include: EMERGENCY_INCLUDE,
  });
}

/**
 * Find an emergency by ID with all relations.
 */
export async function findEmergencyById(id: string) {
  return prisma.emergency.findUnique({
    where: { id },
    include: EMERGENCY_INCLUDE,
  });
}

/**
 * Update an emergency's status and optional fields.
 * This is a partial update — only provided fields are changed.
 */
export async function updateEmergency(
  id: string,
  data: {
    status: EmergencyStatus;
    severity?: Severity;
    assignedAmbulanceId?: string;
    assignedHospitalId?: string;
    etaMinutes?: number;
    emergencyType?: string;
    criticalAlert?: string;
  }
) {
  return prisma.emergency.update({
    where: { id },
    data,
    include: EMERGENCY_INCLUDE,
  });
}

/**
 * Find emergencies by patient ID (for patient app history).
 */
export async function findEmergenciesByPatientId(patientId: string) {
  return prisma.emergency.findMany({
    where: { patientId },
    include: EMERGENCY_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Find active emergencies (non-terminal states).
 * Useful for dashboard views and monitoring.
 */
export async function findActiveEmergencies() {
  return prisma.emergency.findMany({
    where: {
      status: {
        notIn: [EmergencyStatus.ARRIVED, EmergencyStatus.CANCELLED],
      },
    },
    include: EMERGENCY_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

// --------------------------------------------------------------------------
// Timeline Events
// --------------------------------------------------------------------------

/**
 * Create a timeline event for an emergency.
 * Called automatically by the service layer on every status change.
 */
export async function createTimelineEvent(data: {
  emergencyId: string;
  status: EmergencyStatus;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.timelineEvent.create({
    data: {
      emergencyId: data.emergencyId,
      status: data.status,
      label: data.label,
      description: data.description,
      metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

/**
 * Get all timeline events for an emergency, ordered chronologically.
 */
export async function findTimelineByEmergencyId(emergencyId: string) {
  return prisma.timelineEvent.findMany({
    where: { emergencyId },
    orderBy: { createdAt: "asc" },
  });
}

// --------------------------------------------------------------------------
// Hospital Candidates
// --------------------------------------------------------------------------
// These methods are primarily for the Hospital Ranking & Acceptance module
// (Person 3) but are owned by this repository for data locality.
// --------------------------------------------------------------------------

/**
 * Add hospital candidates to an emergency.
 * Called by the Hospital Ranking module when candidates are determined.
 */
export async function addHospitalCandidates(
  emergencyId: string,
  candidates: Array<{
    hospitalId: string;
    hospitalName?: string;
    rank: number;
  }>
) {
  return prisma.hospitalCandidate.createMany({
    data: candidates.map((c) => ({
      emergencyId,
      hospitalId: c.hospitalId,
      hospitalName: c.hospitalName,
      rank: c.rank,
    })),
  });
}

/**
 * Update a hospital candidate's response (ACCEPTED / REJECTED).
 * Called by the Hospital Acceptance module.
 */
export async function updateHospitalCandidateResponse(
  emergencyId: string,
  hospitalId: string,
  response: "ACCEPTED" | "REJECTED",
  rejectionReason?: string
) {
  return prisma.hospitalCandidate.update({
    where: {
      emergencyId_hospitalId: {
        emergencyId,
        hospitalId,
      },
    },
    data: {
      response,
      respondedAt: new Date(),
      rejectionReason,
    },
  });
}

/**
 * Get all hospital candidates for an emergency.
 */
export async function findHospitalCandidates(emergencyId: string) {
  return prisma.hospitalCandidate.findMany({
    where: { emergencyId },
    orderBy: { rank: "asc" },
  });
}
