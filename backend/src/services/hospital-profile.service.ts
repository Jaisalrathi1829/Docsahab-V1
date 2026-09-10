// ============================================================================
// Hospital Profile Service
// ============================================================================
// Hospitals are pre-provisioned (seeded) — there is no profile-editing flow.
// This exists purely so `GET /auth/me` can resolve a HOSPITAL session to its
// subject, the same way patient/ambulance sessions do.
// ============================================================================

import { prisma } from "../prisma/client";
import { AppError } from "../middleware/error-handler.middleware";

export async function getProfile(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    throw new AppError(404, "HOSPITAL_NOT_FOUND", "Hospital record not found");
  }
  return hospital;
}
