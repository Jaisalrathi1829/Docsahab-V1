// ============================================================================
// Hospital Live Status Service
// ============================================================================
// The ONLY write path for HospitalLiveStatus. A hospital may update only its
// OWN status (enforced by the controller passing the authenticated
// hospitalId, never a client-supplied one). `lastUpdated` is always
// server-set to the moment of the real write, which is what makes the
// engine's freshness classification genuine rather than fabricated.
// ============================================================================

import { prisma } from "../prisma/client";
import { AppError } from "../middleware/error-handler.middleware";
import type { liveStatusUpdateSchema } from "../validators/hospital-console.validator";
import type { z } from "zod";

export type LiveStatusUpdateInput = z.infer<typeof liveStatusUpdateSchema>;

export async function getLiveStatus(hospitalId: string) {
  const status = await prisma.hospitalLiveStatus.findUnique({ where: { hospitalId } });
  if (!status) {
    throw new AppError(404, "LIVE_STATUS_NOT_FOUND", "No live status record for this hospital");
  }
  return status;
}

/** Upserts because a hospital seeded before this feature existed may not have a row yet. */
export async function updateLiveStatus(hospitalId: string, input: LiveStatusUpdateInput) {
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError(404, "HOSPITAL_NOT_FOUND", "Hospital record not found");
  }

  return prisma.hospitalLiveStatus.upsert({
    where: { hospitalId },
    create: {
      hospitalId,
      acceptingEmergencyPatients: input.acceptingEmergencyPatients ?? true,
      operationalStatus: input.operationalStatus ?? "OPERATIONAL",
      emergencyDepartmentStatus: input.emergencyDepartmentStatus ?? "AVAILABLE",
      traumaDepartmentStatus: input.traumaDepartmentStatus ?? "AVAILABLE",
      icuBedsAvailable: input.icuBedsAvailable ?? 0,
      generalBedsAvailable: input.generalBedsAvailable ?? hospital.availableBeds,
      erBaysAvailable: input.erBaysAvailable ?? 0,
      traumaBaysAvailable: input.traumaBaysAvailable ?? 0,
      ventilatorsAvailable: input.ventilatorsAvailable ?? 0,
      bloodProductsAvailable: input.bloodProductsAvailable ?? true,
      lastUpdated: new Date(),
    },
    update: {
      ...input,
      lastUpdated: new Date(),
    },
  });
}
