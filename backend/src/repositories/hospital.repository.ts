// ============================================================================
// Hospital Repository (Person 3)
// ============================================================================
// Pure data access for the Hospital Ranking & Acceptance module. All Prisma
// queries for hospitals and hospital-candidate responses live here. Uses the
// REAL Hospital / HospitalCandidate models from the frozen foundation schema.
//
// The atomic accept / reassign functions mirror the canonical concurrency
// pattern established by ambulance.repository.assignAmbulanceAtomically:
// a CONDITIONAL updateMany claim inside a prisma.$transaction, so no two
// concurrent responses can double-assign or corrupt emergency state.
// ============================================================================

import { HospitalResponse, Prisma, EmergencyStatus } from "@prisma/client";
import { prisma } from "../prisma/client";
import { STATUS_LABELS, isValidTransition } from "../enums/emergency-status.enum";
import { AppError } from "../middleware/error-handler.middleware";

// --------------------------------------------------------------------------
// Reads
// --------------------------------------------------------------------------

/**
 * Hospitals eligible for discovery: currently accepting emergency patients
 * (availableBeds > 0). Radius / capability filtering is pure logic and lives
 * in the service layer. Backed by the @@index([availableBeds]).
 */
export async function findAcceptingHospitals() {
  return prisma.hospital.findMany({
    where: { availableBeds: { gt: 0 } },
  });
}

export async function findHospitalById(id: string) {
  return prisma.hospital.findUnique({ where: { id } });
}

/**
 * One candidate row for an (emergency, hospital) pair — the unit of the
 * acceptance workflow. Backed by @@unique([emergencyId, hospitalId]).
 */
export async function findCandidate(emergencyId: string, hospitalId: string) {
  return prisma.hospitalCandidate.findUnique({
    where: { emergencyId_hospitalId: { emergencyId, hospitalId } },
  });
}

/**
 * A hospital console's inbox: every candidate request addressed to this
 * hospital that is still awaiting a response, newest first, with the full
 * emergency attached so the dashboard can render patient context.
 */
export async function findPendingRequestsForHospital(hospitalId: string) {
  return prisma.hospitalCandidate.findMany({
    where: { hospitalId, response: HospitalResponse.PENDING },
    orderBy: { createdAt: "desc" },
    include: {
      emergency: {
        include: {
          assignedAmbulance: true,
          // The console renders the emergency's audit trail alongside the
          // request, so the timeline travels with it.
          timelineEvents: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

/**
 * Whether the patient has been picked up — the assignment-locking trigger.
 * Derived from the immutable timeline (works in BOTH lifecycle paths: the
 * status field alone is ambiguous because hospital-phase statuses can occur
 * before or after pickup).
 */
export async function hasPatientBeenPickedUp(
  emergencyId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const pickup = await tx.timelineEvent.findFirst({
    where: { emergencyId, status: EmergencyStatus.PATIENT_PICKED_UP },
    select: { id: true },
  });
  return pickup !== null;
}

// --------------------------------------------------------------------------
// Atomic acceptance (first suitable hospital wins)
// --------------------------------------------------------------------------

/**
 * Atomically records a hospital's ACCEPT and makes it the (temporary)
 * assigned hospital, inside a single Prisma transaction:
 *
 *   1. Claim the emergency with a CONDITIONAL update
 *      (`assignedHospitalId: null` in the WHERE clause). If a concurrent
 *      acceptance already claimed it, `count` is 0 and we abort — the caller
 *      then evaluates dynamic reassignment instead.
 *   2. Re-read the emergency INSIDE the transaction and re-verify the
 *      assignment lock (post-pickup assignments are final).
 *   3. Mark the candidate ACCEPTED.
 *   4. If the current status legally transitions to HOSPITAL_ACCEPTED
 *      (early-acceptance path from AMBULANCE_EN_ROUTE, or the classic path
 *      from HOSPITAL_ACCEPTANCE_REQUESTED), advance the status. Otherwise
 *      the assignment stands without a status change (e.g. acceptance
 *      arriving between pickup and severity selection).
 *   5. Append a timeline event (immutable audit trail).
 *
 * If any step throws, the whole transaction rolls back — including the claim.
 */
export async function acceptHospitalAtomically(params: {
  emergencyId: string;
  hospitalId: string;
  timelineDescription: string;
  metadata: Record<string, unknown>;
}) {
  const { emergencyId, hospitalId, timelineDescription, metadata } = params;

  return prisma.$transaction(async (tx) => {
    // 1. Atomic claim — only succeeds while no hospital is assigned yet.
    const claim = await tx.emergency.updateMany({
      where: { id: emergencyId, assignedHospitalId: null },
      data: { assignedHospitalId: hospitalId },
    });
    if (claim.count === 0) {
      throw new AppError(
        409,
        "HOSPITAL_ALREADY_ASSIGNED",
        `Emergency ${emergencyId} already has an assigned hospital`
      );
    }

    // 2. Re-read inside the transaction.
    const current = await tx.emergency.findUnique({
      where: { id: emergencyId },
    });
    if (!current) {
      throw new AppError(
        404,
        "EMERGENCY_NOT_FOUND",
        `Emergency ${emergencyId} not found`
      );
    }

    // 3. Record the candidate's answer.
    const candidate = await tx.hospitalCandidate.update({
      where: { emergencyId_hospitalId: { emergencyId, hospitalId } },
      data: {
        response: HospitalResponse.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    // 4. Advance the lifecycle when the transition is legal; otherwise keep
    //    the current status (the assignment itself is still valid).
    const canTransition = isValidTransition(
      current.status,
      EmergencyStatus.HOSPITAL_ACCEPTED
    );
    let emergency = current;
    if (canTransition) {
      emergency = await tx.emergency.update({
        where: { id: emergencyId },
        data: { status: EmergencyStatus.HOSPITAL_ACCEPTED },
      });
    }

    // 5. Timeline event (immutable audit trail).
    const timelineEvent = await tx.timelineEvent.create({
      data: {
        emergencyId,
        status: canTransition
          ? EmergencyStatus.HOSPITAL_ACCEPTED
          : current.status,
        label: STATUS_LABELS[EmergencyStatus.HOSPITAL_ACCEPTED],
        description: timelineDescription,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return {
      emergency,
      candidate,
      timelineEvent,
      previousStatus: current.status,
      statusChanged: canTransition,
    };
  });
}

// --------------------------------------------------------------------------
// Atomic dynamic reassignment (rare, pre-pickup only)
// --------------------------------------------------------------------------

/**
 * Atomically switches the assigned hospital to a better-ranked late acceptor.
 * The CONDITIONAL update guards against a concurrent reassignment: the switch
 * only succeeds while the assignment still points at `expectedCurrentHospitalId`.
 *
 * The caller is responsible for the business checks (not locked, strictly
 * better rank); this function re-verifies the lock inside the transaction.
 */
export async function reassignHospitalAtomically(params: {
  emergencyId: string;
  newHospitalId: string;
  expectedCurrentHospitalId: string;
  timelineDescription: string;
  metadata: Record<string, unknown>;
}) {
  const {
    emergencyId,
    newHospitalId,
    expectedCurrentHospitalId,
    timelineDescription,
    metadata,
  } = params;

  return prisma.$transaction(async (tx) => {
    // Re-verify the lock inside the transaction: never reassign after pickup.
    if (await hasPatientBeenPickedUp(emergencyId, tx)) {
      throw new AppError(
        409,
        "HOSPITAL_ASSIGNMENT_LOCKED",
        `Emergency ${emergencyId} hospital assignment is locked (patient picked up)`
      );
    }

    // Conditional switch — fails if another response already changed it.
    const claim = await tx.emergency.updateMany({
      where: { id: emergencyId, assignedHospitalId: expectedCurrentHospitalId },
      data: { assignedHospitalId: newHospitalId },
    });
    if (claim.count === 0) {
      throw new AppError(
        409,
        "HOSPITAL_ASSIGNMENT_CHANGED",
        `Emergency ${emergencyId} assignment changed concurrently — reassignment aborted`
      );
    }

    const candidate = await tx.hospitalCandidate.update({
      where: {
        emergencyId_hospitalId: { emergencyId, hospitalId: newHospitalId },
      },
      data: {
        response: HospitalResponse.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    const emergency = await tx.emergency.findUnique({
      where: { id: emergencyId },
    });

    const timelineEvent = await tx.timelineEvent.create({
      data: {
        emergencyId,
        status: emergency!.status, // reassignment does not change lifecycle status
        label: "Hospital Reassigned",
        description: timelineDescription,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return { emergency: emergency!, candidate, timelineEvent };
  });
}

// --------------------------------------------------------------------------
// Atomic rejection
// --------------------------------------------------------------------------

/**
 * Atomically records a hospital's REJECT (candidate response + timeline).
 * Rejection never changes the emergency's lifecycle status — it advances the
 * candidate workflow only (frozen design decision).
 */
export async function rejectHospitalAtomically(params: {
  emergencyId: string;
  hospitalId: string;
  rejectionReason?: string;
  timelineDescription: string;
  metadata: Record<string, unknown>;
}) {
  const { emergencyId, hospitalId, rejectionReason, timelineDescription, metadata } =
    params;

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.hospitalCandidate.update({
      where: { emergencyId_hospitalId: { emergencyId, hospitalId } },
      data: {
        response: HospitalResponse.REJECTED,
        respondedAt: new Date(),
        rejectionReason,
      },
    });

    const emergency = await tx.emergency.findUnique({
      where: { id: emergencyId },
    });

    const timelineEvent = await tx.timelineEvent.create({
      data: {
        emergencyId,
        status: emergency!.status, // status unchanged by design
        label: "Hospital Rejected Request",
        description: timelineDescription,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return { emergency: emergency!, candidate, timelineEvent };
  });
}

// --------------------------------------------------------------------------
// Late acceptance recorded without assignment change
// --------------------------------------------------------------------------

/**
 * Records an ACCEPT that does not win (a hospital already holds the
 * assignment and outranks or equals the acceptor). The truthful answer is
 * stored on the candidate; the assignment is untouched.
 */
export async function recordAcceptWithoutAssignment(
  emergencyId: string,
  hospitalId: string
) {
  return prisma.hospitalCandidate.update({
    where: { emergencyId_hospitalId: { emergencyId, hospitalId } },
    data: {
      response: HospitalResponse.ACCEPTED,
      respondedAt: new Date(),
    },
  });
}
