// ============================================================================
// Patient Repository
// ============================================================================
// Prisma access for the patient's own record: the medical profile they save
// during onboarding, and the lookup used to decide whether onboarding is
// still required.
// ============================================================================

import { prisma } from "../prisma/client";
import { EmergencyStatus } from "@prisma/client";

export async function findById(id: string) {
  return prisma.patient.findUnique({ where: { id } });
}

export interface PatientProfileInput {
  fullName: string;
  age: number;
  sex?: string;
  bloodGroup: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

/**
 * Saves the medical profile and marks onboarding complete. Called for both
 * first-time setup and later edits — the client sends the whole profile.
 */
export async function saveProfile(id: string, profile: PatientProfileInput) {
  return prisma.patient.update({
    where: { id },
    data: { ...profile, profileCompleted: true },
  });
}

/**
 * This patient's currently-running emergency, if any.
 *
 * Scoped to the patient so two people using the demo simultaneously never see
 * each other's emergency — the shared-source-of-truth rule is per patient,
 * not global.
 */
export async function findActiveEmergencyForPatient(patientId: string) {
  return prisma.emergency.findFirst({
    where: {
      patientId,
      status: {
        notIn: [EmergencyStatus.ARRIVED, EmergencyStatus.CANCELLED],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      patient: true,
      assignedAmbulance: true,
      assignedHospital: true,
      timelineEvents: { orderBy: { createdAt: "asc" } },
      hospitalCandidates: { orderBy: { rank: "asc" } },
    },
  });
}
