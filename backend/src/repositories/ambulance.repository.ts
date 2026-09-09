// ============================================================================
// Ambulance Repository
// ============================================================================
// Pure data access for the Ambulance Matching module. All Prisma queries for
// ambulances live here. Uses the REAL Ambulance model from the frozen
// foundation schema — no mock data, no duplicate models.
// ============================================================================

import { Prisma, EmergencyStatus } from "@prisma/client";
import { prisma } from "../prisma/client";
import { STATUS_LABELS, isValidTransition } from "../enums/emergency-status.enum";
import { AppError } from "../middleware/error-handler.middleware";

// --------------------------------------------------------------------------
// Reads
// --------------------------------------------------------------------------

/**
 * All currently-available ambulances. Backed by the @@index([isAvailable]).
 */
export async function findAvailableAmbulances() {
  return prisma.ambulance.findMany({
    where: { isAvailable: true },
  });
}

/**
 * All ambulances (optionally filtered by availability) — for discovery/dashboards.
 */
export async function findAmbulances(available?: boolean) {
  return prisma.ambulance.findMany({
    where: available === undefined ? undefined : { isAvailable: available },
    orderBy: { vehicleNo: "asc" },
  });
}

export async function findAmbulanceById(id: string) {
  return prisma.ambulance.findUnique({ where: { id } });
}

// --------------------------------------------------------------------------
// Atomic assignment
// --------------------------------------------------------------------------

/**
 * Atomically assigns an ambulance to an emergency inside a single Prisma
 * transaction. This is the heart of the race-safety guarantee:
 *
 *   1. Claim the ambulance with a CONDITIONAL update (`isAvailable: true` in
 *      the WHERE clause). If another concurrent request already claimed it,
 *      `count` is 0 and we abort — no two emergencies can hold the same unit.
 *   2. Re-validate the emergency INSIDE the transaction (exists, not already
 *      assigned, transition is legal) to guard against concurrent mutations.
 *   3. Update the emergency (status + assignedAmbulanceId + etaMinutes).
 *   4. Append the AMBULANCE_ASSIGNED timeline event.
 *
 * If any step throws, the whole transaction rolls back — including the
 * ambulance claim — so a failed assignment never leaves an ambulance stuck
 * as unavailable. This prevents double assignment, race conditions, and
 * inconsistent emergency state.
 */
export async function assignAmbulanceAtomically(params: {
  emergencyId: string;
  ambulanceId: string;
  etaMinutes: number;
  timelineDescription: string;
  metadata: Record<string, unknown>;
}) {
  const { emergencyId, ambulanceId, etaMinutes, timelineDescription, metadata } =
    params;

  return prisma.$transaction(async (tx) => {
    // 1. Atomic claim — only succeeds while the ambulance is still available.
    const claim = await tx.ambulance.updateMany({
      where: { id: ambulanceId, isAvailable: true },
      data: { isAvailable: false },
    });
    if (claim.count === 0) {
      throw new AppError(
        409,
        "AMBULANCE_NO_LONGER_AVAILABLE",
        `Ambulance ${ambulanceId} was claimed by another assignment`
      );
    }

    // 2. Re-validate the emergency within the transaction.
    const current = await tx.emergency.findUnique({ where: { id: emergencyId } });
    if (!current) {
      throw new AppError(
        404,
        "EMERGENCY_NOT_FOUND",
        `Emergency ${emergencyId} not found`
      );
    }
    if (current.assignedAmbulanceId) {
      throw new AppError(
        409,
        "EMERGENCY_ALREADY_HAS_AMBULANCE",
        `Emergency ${emergencyId} already has ambulance ${current.assignedAmbulanceId}`
      );
    }
    if (!isValidTransition(current.status, EmergencyStatus.AMBULANCE_ASSIGNED)) {
      throw new AppError(
        400,
        "INVALID_STATUS_TRANSITION",
        `Cannot assign an ambulance from status ${current.status}`
      );
    }

    // 3. Update the emergency.
    const emergency = await tx.emergency.update({
      where: { id: emergencyId },
      data: {
        status: EmergencyStatus.AMBULANCE_ASSIGNED,
        assignedAmbulanceId: ambulanceId,
        etaMinutes,
      },
    });

    // 4. Timeline event (immutable audit trail).
    const timelineEvent = await tx.timelineEvent.create({
      data: {
        emergencyId,
        status: EmergencyStatus.AMBULANCE_ASSIGNED,
        label: STATUS_LABELS[EmergencyStatus.AMBULANCE_ASSIGNED],
        description: timelineDescription,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return {
      emergency,
      timelineEvent,
      previousStatus: current.status,
    };
  });
}
