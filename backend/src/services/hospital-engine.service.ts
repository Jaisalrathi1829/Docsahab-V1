// ============================================================================
// Hospital Engine Service — the SOLE hospital decision authority
// ============================================================================
// Everything about WHICH hospital gets selected — ranking, eligibility,
// temporary assignment, better-ranked replacement, pickup lock — is decided
// by `hospital-decision-engine`. This service is the Docsahab-side
// orchestrator: it gathers real inputs (Postgres), calls the engine's pure
// ranking engine and pure selection reducers, and commits the result
// atomically (one Prisma transaction covers the selection-state write AND
// the Emergency.assignedHospitalId write, so they can never diverge).
//
// This REPLACES hospital.service.ts's ranking/selection/reassignment/
// fallback logic as the live authority. That module is left in place for its
// still-generic `notifyAssignedHospital()` (reads assignedHospitalId, does
// not decide it) and for historical/unit-test reference — nothing here calls
// its ranking functions, and nothing in the live server wiring calls them
// either (see server.ts).
// ============================================================================

import { Prisma, HospitalResponse as PrismaHospitalResponse } from "@prisma/client";
import { prisma } from "../prisma/client";
import {
  HospitalRankingEngine,
  createSystemClock,
  createHospitalId,
  createEmergencyId,
  initializeSelection,
  reduceResponse,
  reducePickup,
  SelectionSnapshot,
  SelectionDecision,
  RankingResult,
} from "hospital-decision-engine";
import { hospitalProfileProvider } from "../adapters/hospital-profile-provider.adapter";
import { hospitalLiveStatusProvider } from "../adapters/hospital-live-status-provider.adapter";
import { etaProvider } from "../adapters/eta-provider.adapter";
import { buildEmergencyRequirement } from "../adapters/emergency-requirement.adapter";
import { PostgresSelectionStateStore } from "../adapters/selection-state-store.adapter";
import { resolveDemoHospital, ensureDemoHospitalInvited } from "./demo-routing.service";
import { emergencyEvents } from "./emergency.service";
import { AppError } from "../middleware/error-handler.middleware";
import { buildEmergencyView } from "./emergency-view.service";
import { EmergencyStatus } from "../enums/emergency-status.enum";

const log = (message: string, meta?: unknown) => console.log(`[hospital-engine] ${message}`, meta ?? "");

const rankingEngine = new HospitalRankingEngine(
  hospitalProfileProvider,
  hospitalLiveStatusProvider,
  etaProvider,
  createSystemClock()
);

const TOP_N = 3;
const INVITATION_TTL_MS = 5 * 60 * 1000;
const MAX_CONFLICT_RETRIES = 5;

/** Thrown internally to trigger a fresh retry of the whole transaction on a CAS conflict. */
class ConflictRetry extends Error {}

// ============================================================================
// 1. Ranking + invitation creation — triggered on AMBULANCE_EN_ROUTE
// ============================================================================

export async function startHospitalSearchViaEngine(emergencyId: string): Promise<RankingResult | null> {
  const emergency = await prisma.emergency.findUnique({
    where: { id: emergencyId },
    include: { assignedAmbulance: true, patient: { select: { phoneNumber: true } } },
  });
  if (!emergency) {
    log(`emergency ${emergencyId} not found — skipping hospital search`);
    return null;
  }
  if (!emergency.assignedAmbulance) {
    log(`emergency ${emergencyId} has no assigned ambulance yet — cannot compute an ambulance→hospital ETA, skipping`);
    return null;
  }

  const requirement = buildEmergencyRequirement({
    emergencyId,
    emergencyType: emergency.emergencyType,
    severity: emergency.severity,
    patientLocation: { latitude: emergency.patientLatitude, longitude: emergency.patientLongitude },
    ambulanceLocation: { latitude: emergency.assignedAmbulance.latitude, longitude: emergency.assignedAmbulance.longitude },
  });

  emergencyEvents.emit("hospitalSearchStarted", { emergencyId, requirement: requirement.probableEmergencyType });

  const result = await rankingEngine.rankHospitals({ emergency: requirement, config: { topN: TOP_N } });

  if (result.noEligibleHospitals) {
    log(`emergency ${emergencyId}: NO eligible hospitals (${result.excludedCount} excluded, ${result.totalConsidered} considered) — no fallback, explicit exhaustion`);
    emergencyEvents.emit("hospitalSearchExhausted", {
      emergencyId,
      candidatesTried: 0,
      excludedCount: result.excludedCount,
      totalConsidered: result.totalConsidered,
    });
    return result;
  }

  // Demo hospital guarantee (isolated to the demo patient's emergency only —
  // see demo-routing.service.ts). Real ranking runs unmodified above; this
  // only affects which of the ALREADY-COMPUTED eligible hospitals are
  // actually invited, using each hospital's genuine rank/score.
  const naturalTopN = result.rankedHospitals.slice(0, TOP_N);
  let invitedCandidates: typeof result.rankedHospitals = naturalTopN;
  const demoHospital = await resolveDemoHospital(emergency.patient?.phoneNumber ?? "");
  if (demoHospital) {
    invitedCandidates = ensureDemoHospitalInvited(
      demoHospital.id,
      demoHospital.name,
      naturalTopN,
      result.rankedHospitals,
      result.excludedHospitals
    );
  }

  const now = new Date();
  const snapshot = initializeSelection(
    {
      emergencyId: createEmergencyId(emergencyId),
      rankedHospitals: invitedCandidates,
      topN: invitedCandidates.length,
      invitationTtlMs: INVITATION_TTL_MS,
    },
    now
  );

  const store = new PostgresSelectionStateStore();
  try {
    await store.create(snapshot);
  } catch (e) {
    // Already initialized (e.g. a duplicate AMBULANCE_EN_ROUTE trigger) — not fatal.
    log(`selection already initialized for ${emergencyId}, skipping re-init: ${(e as Error).message}`);
    return result;
  }

  // Mirror the top-N as HospitalCandidate rows — audit trail + what the
  // Hospital console's inbox query reads (see getPendingRequestsForHospital).
  await prisma.hospitalCandidate.createMany({
    data: snapshot.candidates.map((c) => ({
      emergencyId,
      hospitalId: c.hospitalId.toString(),
      rank: c.rank,
      response: PrismaHospitalResponse.PENDING,
    })),
    skipDuplicates: true,
  });
  // Backfill hospitalName from the real Hospital rows (a second pass keeps the createMany above simple).
  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: snapshot.candidates.map((c) => c.hospitalId.toString()) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(hospitals.map((h) => [h.id, h.name]));
  await Promise.all(
    snapshot.candidates.map((c) =>
      prisma.hospitalCandidate.updateMany({
        where: { emergencyId, hospitalId: c.hospitalId.toString() },
        data: { hospitalName: nameById.get(c.hospitalId.toString()) ?? null },
      })
    )
  );

  emergencyEvents.emit("hospitalCandidatesRanked", {
    emergencyId,
    candidates: result.rankedHospitals.map((h) => ({
      hospitalId: h.hospitalId,
      rank: h.rank,
      finalScore: h.finalScore,
      distanceKm: h.distanceKm,
      etaSeconds: h.etaSeconds,
    })),
  });
  for (const c of snapshot.candidates) {
    emergencyEvents.emit("hospitalRequestSent", {
      emergencyId,
      hospitalId: c.hospitalId.toString(),
      rank: c.rank,
    });
  }

  log(`emergency ${emergencyId}: ${snapshot.candidates.length} real hospital invitation(s) created (engine-ranked)`, {
    ranked: result.rankedHospitals.map((h) => `#${h.rank} ${h.hospitalId} (${h.finalScore.toFixed(3)})`),
  });

  return result;
}

// ============================================================================
// 2. Hospital Accept / Decline — the ONLY path that can change
//    Emergency.assignedHospitalId. Atomic: selection-state + assignedHospitalId
//    commit or roll back together.
// ============================================================================

export interface HospitalRespondResult {
  decision: SelectionDecision;
  emergency: ReturnType<typeof buildEmergencyView>;
}

export async function respondToHospitalInvitation(
  hospitalId: string,
  candidateId: string,
  response: "ACCEPTED" | "REJECTED"
): Promise<HospitalRespondResult> {
  const candidateRow = await prisma.hospitalCandidate.findUnique({ where: { id: candidateId } });
  if (!candidateRow) {
    throw new AppError(404, "INVITATION_NOT_FOUND", "No such invitation");
  }
  if (candidateRow.hospitalId !== hospitalId) {
    // Fails closed — a hospital may only respond to its OWN invitation.
    throw new AppError(403, "NOT_YOUR_INVITATION", "This invitation was not sent to your hospital");
  }
  const emergencyId = candidateRow.emergencyId;
  const engineCandidateId = `${emergencyId}-${hospitalId}-${candidateRow.rank}`;

  let decision: SelectionDecision | null = null;

  for (let attempt = 1; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    try {
      decision = await prisma.$transaction(async (tx) => {
        const store = new PostgresSelectionStateStore(tx);
        const loaded = await store.load(createEmergencyId(emergencyId));
        if (!loaded) {
          throw new AppError(404, "NO_SELECTION_STATE", "No hospital selection is active for this emergency");
        }

        const respondedAt = new Date();
        const { snapshot: next, decision: d } = reduceResponse(
          loaded.snapshot,
          {
            emergencyId: createEmergencyId(emergencyId),
            candidateId: engineCandidateId,
            hospitalId: createHospitalId(hospitalId),
            response: response === "ACCEPTED" ? "ACCEPT" : "REJECT",
            respondedAt,
          },
          respondedAt
        );

        if (d.stateChanged) {
          const cas = await store.compareAndSwap(createEmergencyId(emergencyId), loaded.version, next);
          if (!cas.ok) throw new ConflictRetry();

          await tx.emergency.update({
            where: { id: emergencyId },
            data: { assignedHospitalId: next.currentAssignment ? next.currentAssignment.hospitalId.toString() : null },
          });

          await tx.hospitalCandidate.update({
            where: { id: candidateId },
            data: {
              response: response === "ACCEPTED" ? PrismaHospitalResponse.ACCEPTED : PrismaHospitalResponse.REJECTED,
              respondedAt,
            },
          });

          const current = await tx.emergency.findUnique({ where: { id: emergencyId }, select: { status: true } });
          await tx.timelineEvent.create({
            data: {
              emergencyId,
              status: current!.status,
              label: response === "ACCEPTED" ? "Hospital Accepted" : "Hospital Rejected",
              description: describeDecision(candidateRow.hospitalName, d),
              metadata: { hospitalId, candidateId, reason: d.reason.type } as Prisma.InputJsonValue,
            },
          });
        }

        return d;
      });
      break;
    } catch (e) {
      if (e instanceof ConflictRetry) {
        log(`selection CAS conflict for ${emergencyId}, retrying (attempt ${attempt}/${MAX_CONFLICT_RETRIES})`);
        continue;
      }
      throw e;
    }
  }

  if (!decision) {
    throw new AppError(409, "SELECTION_CONFLICT_EXHAUSTED", "Could not record the response under concurrent updates — please retry");
  }

  emitDecisionEvents(emergencyId, hospitalId, candidateRow.hospitalName, decision);

  const fullEmergency = await prisma.emergency.findUnique({
    where: { id: emergencyId },
    include: {
      patient: true,
      assignedAmbulance: true,
      assignedHospital: true,
      timelineEvents: { orderBy: { createdAt: "asc" } },
      hospitalCandidates: { orderBy: { rank: "asc" } },
    },
  });

  return { decision, emergency: buildEmergencyView(fullEmergency!) };
}

function describeDecision(hospitalName: string | null, decision: SelectionDecision): string {
  const name = hospitalName ?? "Hospital";
  switch (decision.reason.type) {
    case "INITIAL_ASSIGNMENT":
      return `${name} accepted — temporary assignment`;
    case "REPLACEMENT":
      return `${name} accepted and replaced the previous temporary assignment (better-ranked)`;
    case "NO_REPLACEMENT_LOWER_RANK":
      return `${name} accepted, but a higher-ranked hospital is already assigned`;
    case "REJECTION_RECORDED":
      return `${name} declined the request`;
    case "RESPONSE_REJECTED_LOCKED":
      return `${name} responded after the destination was already locked — ignored`;
    default:
      return `${name} response recorded (${decision.reason.type})`;
  }
}

function emitDecisionEvents(emergencyId: string, hospitalId: string, hospitalName: string | null, decision: SelectionDecision) {
  switch (decision.reason.type) {
    case "INITIAL_ASSIGNMENT":
      emergencyEvents.emit("hospitalAccepted", { emergencyId, hospitalId, hospitalName });
      emergencyEvents.emit("hospitalAssigned", { emergencyId, hospitalId, hospitalName });
      break;
    case "REPLACEMENT":
      emergencyEvents.emit("hospitalAccepted", { emergencyId, hospitalId, hospitalName });
      emergencyEvents.emit("hospitalReassigned", {
        emergencyId,
        hospitalId,
        hospitalName,
        previousHospitalId: decision.previousAssignment?.hospitalId.toString() ?? null,
      });
      break;
    case "REJECTION_RECORDED":
      emergencyEvents.emit("hospitalRejected", { emergencyId, hospitalId, hospitalName });
      break;
    default:
      // Duplicate/obsolete/locked/expired/unknown-candidate — audit-logged already, no lifecycle event.
      break;
  }
}

// ============================================================================
// 3. Pickup lock — triggered on PATIENT_PICKED_UP
// ============================================================================

export async function lockHospitalAtPickup(emergencyId: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const store = new PostgresSelectionStateStore(tx);
        const loaded = await store.load(createEmergencyId(emergencyId));
        if (!loaded) {
          log(`emergency ${emergencyId}: pickup fired but no selection state exists — nothing to lock`);
          return;
        }

        const pickedUpAt = new Date();
        const { snapshot: next, decision } = reducePickup(loaded.snapshot, pickedUpAt);
        if (!decision.stateChanged) return; // already locked — idempotent

        const cas = await store.compareAndSwap(createEmergencyId(emergencyId), loaded.version, next);
        if (!cas.ok) throw new ConflictRetry();

        // Defensive resync — assignedHospitalId should already match; this closes
        // any theoretical drift rather than assuming it.
        await tx.emergency.update({
          where: { id: emergencyId },
          data: { assignedHospitalId: next.currentAssignment ? next.currentAssignment.hospitalId.toString() : null },
        });

        log(`emergency ${emergencyId}: hospital assignment LOCKED (engine-enforced)`, { reason: decision.reason.type });
      });
      return;
    } catch (e) {
      if (e instanceof ConflictRetry) {
        log(`lock CAS conflict for ${emergencyId}, retrying (attempt ${attempt}/${MAX_CONFLICT_RETRIES})`);
        continue;
      }
      // A lock failure must never block the ambulance's pickup transition —
      // hospitalLockedAt is already stamped generically by emergency.service.ts;
      // this is defense-in-depth on the engine side, not the primary guarantee.
      log(`lockHospitalAtPickup failed for ${emergencyId}: ${(e as Error).message}`);
      return;
    }
  }
}

// ============================================================================
// 4. Hospital console reads
// ============================================================================

/** Pending invitations for a hospital — Name/Age/Sex ONLY, per product spec. */
export async function getPendingRequestsForHospital(hospitalId: string) {
  const candidates = await prisma.hospitalCandidate.findMany({
    where: {
      hospitalId,
      response: PrismaHospitalResponse.PENDING,
      // Once the destination is locked (to any hospital), no pending
      // invitation is actionable anymore — never show a stale request.
      emergency: { status: { notIn: ["ARRIVED", "CANCELLED"] }, hospitalLockedAt: null },
    },
    orderBy: { createdAt: "asc" },
    include: { emergency: { select: { id: true, patientName: true, patientAge: true, patientSex: true } } },
  });

  return candidates.map((c) => ({
    candidateId: c.id,
    emergencyId: c.emergencyId,
    rank: c.rank,
    patientName: c.emergency.patientName,
    patientAge: c.emergency.patientAge,
    patientSex: c.emergency.patientSex,
  }));
}

/**
 * This hospital's current active case (if any) — for the post-accept screen.
 * Before HOSPITAL_NOTIFIED, only identity + waiting state are meaningful.
 * After HOSPITAL_NOTIFIED, the view carries severity + ETA-to-hospital, which
 * the Hospital console must display and nothing else (per product spec).
 */
export async function getHospitalActiveCase(hospitalId: string) {
  const emergency = await prisma.emergency.findFirst({
    where: { assignedHospitalId: hospitalId, status: { notIn: ["ARRIVED", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      patient: true,
      assignedAmbulance: true,
      assignedHospital: true,
      timelineEvents: { orderBy: { createdAt: "asc" } },
      hospitalCandidates: { orderBy: { rank: "asc" } },
    },
  });
  if (!emergency) return null;

  const view = buildEmergencyView(emergency);
  return {
    emergencyId: view.id,
    status: view.status,
    patientName: view.patient.name,
    patientAge: view.patient.age,
    patientSex: view.patient.gender,
    locked: view.hospital?.locked ?? false,
    notified: view.hospital?.notifiedAt !== null,
    severity: view.severity,
    etaToHospitalMinutes: view.navigation.toHospital?.etaMinutes ?? null,
  };
}

// ============================================================================
// 5. Event-driven orchestration — the live authority's only trigger points
// ============================================================================

let handlersRegistered = false;

/**
 * Wires the REAL hospital-decision-engine into the emergency lifecycle:
 *   - AMBULANCE_EN_ROUTE  → real ranking + real invitations (this module)
 *   - PATIENT_PICKED_UP   → engine-side lock (defense-in-depth; the primary
 *     hospitalLockedAt guarantee is stamped generically by
 *     emergency.service.ts regardless of which module set assignedHospitalId)
 *
 * This REPLACES hospital.service.ts's registerHospitalEventHandlers() in the
 * live server wiring (see server.ts) — there is exactly one hospital
 * decision authority listening on these events.
 */
export function registerHospitalEngineEventHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  emergencyEvents.on(
    "statusChanged",
    (payload: { emergency: { id: string; assignedHospitalId: string | null } | null; newStatus: EmergencyStatus }) => {
      const emergency = payload.emergency;
      if (!emergency) return;

      if (payload.newStatus === EmergencyStatus.AMBULANCE_EN_ROUTE) {
        startHospitalSearchViaEngine(emergency.id).catch((e) =>
          log(`real hospital search failed for ${emergency.id}: ${(e as Error).message}`)
        );
      }

      if (payload.newStatus === EmergencyStatus.PATIENT_PICKED_UP) {
        lockHospitalAtPickup(emergency.id).catch((e) =>
          log(`engine-side lock failed for ${emergency.id}: ${(e as Error).message}`)
        );
      }
    }
  );

  log("event handlers registered — REAL engine authority (ranking on AMBULANCE_EN_ROUTE, lock on PATIENT_PICKED_UP)");
}
