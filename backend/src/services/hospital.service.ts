// ============================================================================
// Hospital Ranking & Acceptance Service (Person 3)
// ============================================================================
// Foundation-native business logic for hospital discovery, configurable
// ranking, candidate generation, parallel acceptance requests, temporary
// assignment, dynamic reassignment, assignment locking, fallback search
// expansion, and hospital notification.
//
// Reuses the frozen foundation:
//   - Hospital / HospitalCandidate / Emergency Prisma models (via repositories)
//   - EmergencyStatus lifecycle + transition rules (NEVER duplicated here —
//     all status changes go through the Emergency Core Service or the
//     isValidTransition-guarded atomic repository transactions)
//   - emergencyEvents emitter (shared with the Emergency Core Service)
//   - AppError + standardized error codes
//
// Workflow (official):
//   AMBULANCE_EN_ROUTE ─(auto)→ discovery → ranking → candidates(PENDING)
//   → parallel requests → first suitable ACCEPT ⇒ temporary assignment
//   (status → HOSPITAL_ACCEPTED) → [rare: dynamic reassignment to a
//   better-ranked late acceptor] → PATIENT_PICKED_UP ⇒ assignment LOCKED
//   → SEVERITY_SELECTED → notification ⇒ HOSPITAL_NOTIFIED.
//
// The classic post-severity path (SEVERITY_SELECTED → HOSPITAL_SEARCHING →
// HOSPITAL_ACCEPTANCE_REQUESTED → HOSPITAL_ACCEPTED → HOSPITAL_NOTIFIED)
// remains fully supported — both routes share this module's logic.
//
// IMPORTANT: the automatic (event-driven) search phase writes NO timeline
// events and NO status changes — it only creates candidate rows and emits
// events. Timeline writes happen on explicit responses (accept / reject /
// reassign / notify). This keeps the frozen Emergency Core E2E contract
// (exact timeline counts) intact.
// ============================================================================

import type { Hospital, HospitalCandidate, Severity } from "@prisma/client";
import { HospitalResponse } from "@prisma/client";
import {
  EmergencyStatus,
  isValidTransition,
} from "../enums/emergency-status.enum";
import * as hospitalRepo from "../repositories/hospital.repository";
import * as emergencyRepo from "../repositories/emergency.repository";
import {
  emergencyEvents,
  updateEmergencyStatus,
} from "./emergency.service";
import { haversineDistanceKm } from "../utils/haversine";
import {
  hospitalRankingConfig,
  capabilityKeywordRules,
} from "../config/hospital-ranking.config";
import { AppError } from "../middleware/error-handler.middleware";
import type {
  RequiredCapabilities,
  RankedHospital,
  HospitalResponseResult,
  HospitalRequestPayload,
} from "../types/hospital.types";

const log = (message: string, meta?: unknown) =>
  console.log(`[hospital-ranking] ${message}`, meta ?? "");

// ============================================================================
// Pure logic (exported for unit testing)
// ============================================================================

/**
 * Derives the medical capabilities an emergency requires, from its free-text
 * `emergencyType` (keyword rules in config) and `severity` (RED ⇒ ICU).
 * Limited to what the frozen Hospital model can express.
 */
export function deriveRequiredCapabilities(
  emergencyType: string | null | undefined,
  severity: Severity | null | undefined
): RequiredCapabilities {
  const required: RequiredCapabilities = {
    needsICU: false,
    needsTraumaCare: false,
    needsCardiology: false,
  };

  const type = (emergencyType ?? "").toLowerCase();
  for (const rule of capabilityKeywordRules) {
    if (rule.keywords.some((k) => type.includes(k))) {
      if (rule.capability === "icu") required.needsICU = true;
      if (rule.capability === "traumaCare") required.needsTraumaCare = true;
      if (rule.capability === "cardiology") required.needsCardiology = true;
    }
  }

  // RED (critical) triage always requires ICU capability.
  if (severity === "RED") required.needsICU = true;

  return required;
}

/**
 * A hospital is capable when it has EVERY required capability.
 * (Hospitals missing a required capability are excluded from discovery —
 * "incapable of treating the emergency".)
 */
export function isHospitalCapable(
  hospital: Hospital,
  required: RequiredCapabilities
): boolean {
  if (required.needsICU && !hospital.hasICU) return false;
  if (required.needsTraumaCare && !hospital.hasTraumaCare) return false;
  if (required.needsCardiology && !hospital.hasCardiology) return false;
  return true;
}

/**
 * Converts a straight-line distance into a patient-transport ETA in whole
 * minutes, using the configurable transport speed (no magic numbers).
 */
export function estimateTransportEtaMinutes(
  distanceKm: number,
  config = hospitalRankingConfig
): number {
  const rawMinutes = (distanceKm / config.transportSpeedKmph) * 60;
  return Math.max(config.minimumEtaMinutes, Math.ceil(rawMinutes));
}

/**
 * Human-readable list of required services (for request payloads / UI).
 */
export function requiredServiceLabels(required: RequiredCapabilities): string[] {
  const labels: string[] = [];
  if (required.needsICU) labels.push("ICU");
  if (required.needsTraumaCare) labels.push("Trauma Care");
  if (required.needsCardiology) labels.push("Cardiology");
  return labels;
}

/**
 * The configurable ranking engine. Pure — no I/O.
 *
 * Filters (discovery rules):
 *   - hospital must be accepting patients (availableBeds > 0)
 *   - hospital must have every required capability
 *   - hospital must be within `radiusKm` of the patient
 *   - transport ETA must fit the golden-hour window
 *
 * Scoring (each component in [0, 1], blended by configurable weights):
 *   - capabilityScore: 1.0 when requirements exist and are met; when nothing
 *     specific is required, richer facilities rank higher (capabilities / 3)
 *   - etaScore: 1 − eta / goldenHourMax (shorter transport is better)
 *   - resourceScore: availableBeds / bedsForFullResourceScore, capped at 1
 *
 * Sorted best-first; ties broken by shorter distance.
 */
export function rankHospitals(
  hospitals: Hospital[],
  patientLat: number,
  patientLng: number,
  required: RequiredCapabilities,
  radiusKm: number,
  config = hospitalRankingConfig
): RankedHospital[] {
  const { weights } = config;
  const weightSum = weights.capability + weights.eta + weights.resources;
  const hasRequirements =
    required.needsICU || required.needsTraumaCare || required.needsCardiology;

  const ranked: RankedHospital[] = [];

  for (const hospital of hospitals) {
    if (hospital.availableBeds <= 0) continue; // not accepting
    if (!isHospitalCapable(hospital, required)) continue; // incapable

    const distanceKm = haversineDistanceKm(
      patientLat,
      patientLng,
      hospital.latitude,
      hospital.longitude
    );
    if (distanceKm > radiusKm) continue; // outside search radius

    const etaMinutes = estimateTransportEtaMinutes(distanceKm, config);
    if (etaMinutes > config.goldenHourMaxEtaMinutes) continue; // golden hour

    const capabilityScore = hasRequirements
      ? 1
      : (Number(hospital.hasICU) +
          Number(hospital.hasTraumaCare) +
          Number(hospital.hasCardiology)) /
        3;
    const etaScore = Math.max(
      0,
      1 - etaMinutes / config.goldenHourMaxEtaMinutes
    );
    const resourceScore = Math.min(
      hospital.availableBeds / config.bedsForFullResourceScore,
      1
    );

    const totalScore =
      (weights.capability * capabilityScore +
        weights.eta * etaScore +
        weights.resources * resourceScore) /
      weightSum;

    ranked.push({
      hospital,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMinutes,
      capabilityScore,
      etaScore,
      resourceScore,
      totalScore,
    });
  }

  ranked.sort(
    (a, b) => b.totalScore - a.totalScore || a.distanceKm - b.distanceKm
  );
  return ranked;
}

// ============================================================================
// Hospital Discovery + Ranking + Candidate Generation + Parallel Requests
// ============================================================================

/**
 * Runs one search round for an emergency:
 *   discovery → ranking → candidate generation (PENDING) → parallel requests.
 *
 * - Hospitals that are already candidates (from earlier rounds) are skipped.
 * - Candidate ranks continue across rounds (round 2 starts after round 1's
 *   worst rank), so rank comparisons for dynamic reassignment stay global.
 * - Emits `hospitalSearchStarted`, `hospitalCandidatesRanked`, and one
 *   `hospitalRequestSent` per hospital (concurrently — never sequentially).
 * - Writes NO timeline events and NO status changes (see module header).
 *
 * @param radiusKm search radius for this round (defaults to the configured
 *                 initial radius; fallback rounds pass an expanded radius).
 */
export async function startHospitalSearch(
  emergencyId: string,
  options: { radiusKm?: number } = {}
) {
  const config = hospitalRankingConfig;
  const radiusKm = options.radiusKm ?? config.initialSearchRadiusKm;

  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(
      404,
      "EMERGENCY_NOT_FOUND",
      `Emergency ${emergencyId} not found`
    );
  }

  const required = deriveRequiredCapabilities(
    emergency.emergencyType,
    emergency.severity
  );

  emergencyEvents.emit("hospitalSearchStarted", {
    emergencyId,
    radiusKm,
    requiredServices: requiredServiceLabels(required),
  });

  // Discovery: accepting hospitals only (beds > 0), then pure filtering/ranking.
  const hospitals = await hospitalRepo.findAcceptingHospitals();
  const ranked = rankHospitals(
    hospitals,
    emergency.patientLatitude,
    emergency.patientLongitude,
    required,
    radiusKm,
    config
  );

  // Skip hospitals already tried in earlier rounds.
  const existing = await emergencyRepo.findHospitalCandidates(emergencyId);
  const alreadyTried = new Set(existing.map((c) => c.hospitalId));
  const fresh = ranked.filter((r) => !alreadyTried.has(r.hospital.id));
  const selected = fresh.slice(0, config.maxCandidatesPerRound);

  if (selected.length === 0) {
    log(
      `no new eligible hospitals for emergency ${emergencyId} within ${radiusKm} km`
    );
    return { candidates: [] as HospitalCandidate[], ranked: selected, radiusKm };
  }

  // Candidate generation — ranks continue globally across rounds.
  const baseRank = existing.reduce((max, c) => Math.max(max, c.rank), 0);
  await emergencyRepo.addHospitalCandidates(
    emergencyId,
    selected.map((r, i) => ({
      hospitalId: r.hospital.id,
      hospitalName: r.hospital.name,
      rank: baseRank + i + 1,
    }))
  );
  const candidates = (
    await emergencyRepo.findHospitalCandidates(emergencyId)
  ).filter((c) => selected.some((r) => r.hospital.id === c.hospitalId));

  emergencyEvents.emit("hospitalCandidatesRanked", {
    emergencyId,
    radiusKm,
    candidates: selected.map((r, i) => ({
      hospitalId: r.hospital.id,
      hospitalName: r.hospital.name,
      rank: baseRank + i + 1,
      distanceKm: r.distanceKm,
      etaMinutes: r.etaMinutes,
      totalScore: Number(r.totalScore.toFixed(4)),
    })),
  });

  // Parallel requests — all ranked hospitals are notified concurrently.
  await Promise.all(
    selected.map(async (r, i) => {
      const payload = buildRequestPayload(
        emergency,
        r.hospital.id,
        baseRank + i + 1,
        r.etaMinutes,
        required
      );
      emergencyEvents.emit("hospitalRequestSent", payload);
    })
  );

  log(
    `emergency ${emergencyId}: ${selected.length} hospital request(s) sent (radius ${radiusKm} km)`,
    selected.map((r) => r.hospital.name)
  );

  return { candidates, ranked: selected, radiusKm };
}

/**
 * The payload each hospital receives with an acceptance request.
 */
function buildRequestPayload(
  emergency: {
    id: string;
    emergencyType: string | null;
    severity: Severity | null;
    patientAge: number | null;
    criticalAlert: string | null;
  },
  hospitalId: string,
  rank: number,
  transportEtaMinutes: number,
  required: RequiredCapabilities
): HospitalRequestPayload {
  return {
    emergencyId: emergency.id,
    hospitalId,
    rank,
    emergencyType: emergency.emergencyType,
    severity: emergency.severity,
    patientAge: emergency.patientAge,
    criticalAlert: emergency.criticalAlert,
    estimatedArrivalMinutes: transportEtaMinutes,
    requiredServices: requiredServiceLabels(required),
  };
}

// ============================================================================
// Hospital Response (ACCEPT / REJECT) — idempotent, transactional
// ============================================================================

/**
 * Processes a hospital's response to an acceptance request.
 *
 * ACCEPT:
 *   - first suitable acceptance ⇒ atomic temporary assignment
 *     (+ status → HOSPITAL_ACCEPTED when the transition is legal)
 *   - later acceptance by a STRICTLY better-ranked hospital, before pickup ⇒
 *     dynamic reassignment (rare)
 *   - anything after the assignment is locked (patient picked up) ⇒ ignored
 *   - duplicate ACCEPTs replay idempotently (no state change, no duplicate
 *     timeline events)
 *
 * REJECT:
 *   - recorded on the candidate (never an emergency status — frozen design)
 *   - when every candidate has rejected and nothing is assigned, the search
 *     radius expands and a new round runs (fallback), until a hospital
 *     accepts or no hospital remains within the golden-hour window
 */
export async function respondToHospitalRequest(
  emergencyId: string,
  hospitalId: string,
  response: "ACCEPTED" | "REJECTED",
  rejectionReason?: string
): Promise<HospitalResponseResult> {
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(
      404,
      "EMERGENCY_NOT_FOUND",
      `Emergency ${emergencyId} not found`
    );
  }

  const candidate = await hospitalRepo.findCandidate(emergencyId, hospitalId);
  if (!candidate) {
    throw new AppError(
      404,
      "HOSPITAL_CANDIDATE_NOT_FOUND",
      `Hospital ${hospitalId} was not requested for emergency ${emergencyId}`
    );
  }

  // ---- Idempotent replay: the same answer was already recorded. ----
  if (candidate.response === response) {
    return {
      emergency,
      candidate,
      assignmentChanged: false,
      locked: await hospitalRepo.hasPatientBeenPickedUp(emergencyId),
      idempotent: true,
    };
  }

  // ---- Conflicting answer after a final one. ----
  if (candidate.response !== HospitalResponse.PENDING) {
    throw new AppError(
      409,
      "HOSPITAL_ALREADY_RESPONDED",
      `Hospital ${hospitalId} already responded ${candidate.response} for emergency ${emergencyId}`
    );
  }

  if (response === "REJECTED") {
    return handleRejection(emergencyId, hospitalId, candidate, rejectionReason);
  }
  return handleAcceptance(emergencyId, hospitalId, candidate);
}

// --------------------------------------------------------------------------
// ACCEPT path
// --------------------------------------------------------------------------

async function handleAcceptance(
  emergencyId: string,
  hospitalId: string,
  candidate: HospitalCandidate
): Promise<HospitalResponseResult> {
  const locked = await hospitalRepo.hasPatientBeenPickedUp(emergencyId);
  const current = await emergencyRepo.findEmergencyById(emergencyId);

  // ---- LOCKED: assignment is final — ignore new acceptances entirely. ----
  if (locked && current!.assignedHospitalId) {
    log(
      `emergency ${emergencyId}: acceptance from ${hospitalId} ignored (assignment locked)`
    );
    return {
      emergency: current,
      candidate,
      assignmentChanged: false,
      locked: true,
      idempotent: false,
    };
  }

  // ---- No hospital assigned yet: first suitable acceptance wins. ----
  if (!current!.assignedHospitalId) {
    try {
      const result = await hospitalRepo.acceptHospitalAtomically({
        emergencyId,
        hospitalId,
        timelineDescription: `Hospital ${candidate.hospitalName ?? hospitalId} accepted (rank ${candidate.rank}) — temporary assignment`,
        metadata: {
          hospitalId,
          hospitalName: candidate.hospitalName,
          rank: candidate.rank,
          temporary: !locked,
        },
      });

      const fullEmergency = await emergencyRepo.findEmergencyById(emergencyId);

      if (result.statusChanged) {
        // Same channel every lifecycle change uses (Realtime/P4 seam).
        emergencyEvents.emit("statusChanged", {
          emergency: fullEmergency,
          previousStatus: result.previousStatus,
          newStatus: EmergencyStatus.HOSPITAL_ACCEPTED,
          timelineEvent: result.timelineEvent,
        });
      }
      emergencyEvents.emit("hospitalAccepted", {
        emergencyId,
        hospitalId,
        hospitalName: candidate.hospitalName,
        rank: candidate.rank,
        emergency: fullEmergency,
      });
      emergencyEvents.emit("hospitalAssigned", {
        emergencyId,
        hospitalId,
        hospitalName: candidate.hospitalName,
        rank: candidate.rank,
        emergency: fullEmergency,
      });

      log(
        `emergency ${emergencyId}: hospital ${hospitalId} assigned (rank ${candidate.rank}, temporary=${!locked})`
      );

      return {
        emergency: fullEmergency,
        candidate: result.candidate,
        assignmentChanged: true,
        locked,
        idempotent: false,
      };
    } catch (error) {
      // Lost the claim to a concurrent acceptance — evaluate reassignment.
      if (
        !(error instanceof AppError) ||
        error.code !== "HOSPITAL_ALREADY_ASSIGNED"
      ) {
        throw error;
      }
    }
  }

  // ---- A hospital is already assigned: dynamic reassignment (rare). ----
  return evaluateDynamicReassignment(emergencyId, hospitalId, candidate);
}

/**
 * How many times to re-evaluate a dynamic reassignment when a concurrent
 * response changes the assignment between our read and our conditional
 * switch. Mirrors the bounded-retry pattern of the Ambulance module so
 * concurrent acceptances always converge on the best-ranked hospital.
 */
const MAX_REASSIGNMENT_ATTEMPTS = 3;

/**
 * Dynamic reassignment: before pickup, a STRICTLY better-ranked late acceptor
 * may take over the temporary assignment. Everything else records the
 * acceptance truthfully without changing the assignment.
 */
async function evaluateDynamicReassignment(
  emergencyId: string,
  hospitalId: string,
  candidate: HospitalCandidate,
  attempt = 1
): Promise<HospitalResponseResult> {
  const current = await emergencyRepo.findEmergencyById(emergencyId);
  const assignedHospitalId = current!.assignedHospitalId as string;
  const locked = await hospitalRepo.hasPatientBeenPickedUp(emergencyId);

  const assignedCandidate = await hospitalRepo.findCandidate(
    emergencyId,
    assignedHospitalId
  );

  // Reassign only when: not locked, the current assignment came from this
  // candidate workflow (has a rank), and the acceptor STRICTLY outranks it.
  const shouldReassign =
    !locked &&
    assignedCandidate !== null &&
    candidate.rank < assignedCandidate.rank;

  if (shouldReassign) {
    try {
      const result = await hospitalRepo.reassignHospitalAtomically({
        emergencyId,
        newHospitalId: hospitalId,
        expectedCurrentHospitalId: assignedHospitalId,
        timelineDescription: `Reassigned to ${candidate.hospitalName ?? hospitalId} (rank ${candidate.rank}, previously rank ${assignedCandidate.rank})`,
        metadata: {
          hospitalId,
          hospitalName: candidate.hospitalName,
          rank: candidate.rank,
          previousHospitalId: assignedHospitalId,
          previousRank: assignedCandidate.rank,
        },
      });

      const fullEmergency = await emergencyRepo.findEmergencyById(emergencyId);

      emergencyEvents.emit("hospitalAccepted", {
        emergencyId,
        hospitalId,
        hospitalName: candidate.hospitalName,
        rank: candidate.rank,
        emergency: fullEmergency,
      });
      emergencyEvents.emit("hospitalReassigned", {
        emergencyId,
        hospitalId,
        hospitalName: candidate.hospitalName,
        rank: candidate.rank,
        previousHospitalId: assignedHospitalId,
        emergency: fullEmergency,
      });

      log(
        `emergency ${emergencyId}: REASSIGNED ${assignedHospitalId} → ${hospitalId} (rank ${assignedCandidate.rank} → ${candidate.rank})`
      );

      return {
        emergency: fullEmergency,
        candidate: result.candidate,
        assignmentChanged: true,
        locked: false,
        idempotent: false,
      };
    } catch (error) {
      if (
        !(error instanceof AppError) ||
        (error.code !== "HOSPITAL_ASSIGNMENT_CHANGED" &&
          error.code !== "HOSPITAL_ASSIGNMENT_LOCKED")
      ) {
        throw error;
      }
      // Assignment changed under us — re-evaluate against the new holder
      // (bounded), so the best-ranked acceptor always wins the race.
      if (
        error.code === "HOSPITAL_ASSIGNMENT_CHANGED" &&
        attempt < MAX_REASSIGNMENT_ATTEMPTS
      ) {
        return evaluateDynamicReassignment(
          emergencyId,
          hospitalId,
          candidate,
          attempt + 1
        );
      }
      // Locked concurrently (or retries exhausted) — record-only below.
    }
  }

  // Acceptance recorded truthfully; assignment untouched.
  const updated = await hospitalRepo.recordAcceptWithoutAssignment(
    emergencyId,
    hospitalId
  );
  emergencyEvents.emit("hospitalAccepted", {
    emergencyId,
    hospitalId,
    hospitalName: candidate.hospitalName,
    rank: candidate.rank,
    emergency: current,
  });

  return {
    emergency: await emergencyRepo.findEmergencyById(emergencyId),
    candidate: updated,
    assignmentChanged: false,
    locked,
    idempotent: false,
  };
}

// --------------------------------------------------------------------------
// REJECT path + fallback search expansion
// --------------------------------------------------------------------------

async function handleRejection(
  emergencyId: string,
  hospitalId: string,
  candidate: HospitalCandidate,
  rejectionReason?: string
): Promise<HospitalResponseResult> {
  const result = await hospitalRepo.rejectHospitalAtomically({
    emergencyId,
    hospitalId,
    rejectionReason,
    timelineDescription: `Hospital ${candidate.hospitalName ?? hospitalId} rejected (rank ${candidate.rank})${rejectionReason ? ` — ${rejectionReason}` : ""}`,
    metadata: {
      hospitalId,
      hospitalName: candidate.hospitalName,
      rank: candidate.rank,
      rejectionReason: rejectionReason ?? null,
    },
  });

  emergencyEvents.emit("hospitalRejected", {
    emergencyId,
    hospitalId,
    hospitalName: candidate.hospitalName,
    rank: candidate.rank,
    rejectionReason: rejectionReason ?? null,
  });

  // Fallback: if every candidate has now rejected and nothing is assigned,
  // expand the radius and run another round.
  await runFallbackSearchIfExhausted(emergencyId);

  return {
    emergency: await emergencyRepo.findEmergencyById(emergencyId),
    candidate: result.candidate,
    assignmentChanged: false,
    locked: await hospitalRepo.hasPatientBeenPickedUp(emergencyId),
    idempotent: false,
  };
}

/**
 * Fallback logic: when ALL candidates have rejected and no hospital is
 * assigned, expand the search radius (configurable factor, capped by the
 * golden-hour ceiling) and generate the next candidate round. When the
 * classic post-severity path is active (status HOSPITAL_ACCEPTANCE_REQUESTED),
 * the retry loops through HOSPITAL_SEARCHING via the Emergency Core Service —
 * the transition map already models exactly this.
 */
async function runFallbackSearchIfExhausted(emergencyId: string) {
  const config = hospitalRankingConfig;
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency || emergency.assignedHospitalId) return;

  const candidates = await emergencyRepo.findHospitalCandidates(emergencyId);
  const allRejected =
    candidates.length > 0 &&
    candidates.every((c) => c.response === HospitalResponse.REJECTED);
  if (!allRejected) return;

  // Radius for the next round grows with the number of completed rounds.
  const roundsCompleted = Math.max(
    1,
    Math.ceil(candidates.length / config.maxCandidatesPerRound)
  );
  const nextRadiusKm = Math.min(
    config.initialSearchRadiusKm *
      Math.pow(config.radiusExpansionFactor, roundsCompleted),
    config.maxSearchRadiusKm
  );

  const radiusExhausted =
    config.initialSearchRadiusKm *
      Math.pow(config.radiusExpansionFactor, roundsCompleted - 1) >=
    config.maxSearchRadiusKm;

  // Classic path bookkeeping: loop back to HOSPITAL_SEARCHING (audited by P1).
  const classicRetry =
    emergency.status === EmergencyStatus.HOSPITAL_ACCEPTANCE_REQUESTED;
  if (classicRetry) {
    await updateEmergencyStatus(emergencyId, {
      status: EmergencyStatus.HOSPITAL_SEARCHING,
      description: "All candidate hospitals rejected — expanding search",
    });
  }

  if (radiusExhausted) {
    log(
      `emergency ${emergencyId}: hospital search EXHAUSTED (max radius ${config.maxSearchRadiusKm} km reached)`
    );
    emergencyEvents.emit("hospitalSearchExhausted", {
      emergencyId,
      maxRadiusKm: config.maxSearchRadiusKm,
      candidatesTried: candidates.length,
    });
    return;
  }

  const round = await startHospitalSearch(emergencyId, {
    radiusKm: nextRadiusKm,
  });

  if (round.candidates.length === 0) {
    emergencyEvents.emit("hospitalSearchExhausted", {
      emergencyId,
      maxRadiusKm: nextRadiusKm,
      candidatesTried: candidates.length,
    });
    return;
  }

  if (classicRetry) {
    await updateEmergencyStatus(emergencyId, {
      status: EmergencyStatus.HOSPITAL_ACCEPTANCE_REQUESTED,
      description: `Acceptance requested from ${round.candidates.length} hospital(s) (expanded radius ${round.radiusKm} km)`,
    });
  }
}

// ============================================================================
// Hospital Notification (post-severity)
// ============================================================================

/**
 * Notifies the locked/assigned hospital after severity selection: final
 * severity, patient-onboard confirmation, updated transport ETA, critical
 * alerts. Advances the lifecycle to HOSPITAL_NOTIFIED strictly through the
 * Emergency Core Service (which validates the transition and writes the
 * timeline) — no lifecycle logic is duplicated here.
 */
export async function notifyAssignedHospital(emergencyId: string) {
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(
      404,
      "EMERGENCY_NOT_FOUND",
      `Emergency ${emergencyId} not found`
    );
  }
  if (!emergency.assignedHospitalId) {
    throw new AppError(
      400,
      "NO_HOSPITAL_ASSIGNED",
      `Emergency ${emergencyId} has no assigned hospital to notify`
    );
  }

  const hospital = await hospitalRepo.findHospitalById(
    emergency.assignedHospitalId
  );
  if (!hospital) {
    throw new AppError(
      404,
      "HOSPITAL_NOT_FOUND",
      `Hospital ${emergency.assignedHospitalId} not found`
    );
  }

  // Updated transport ETA: patient location → locked hospital.
  const distanceKm = haversineDistanceKm(
    emergency.patientLatitude,
    emergency.patientLongitude,
    hospital.latitude,
    hospital.longitude
  );
  const etaMinutes = estimateTransportEtaMinutes(distanceKm);

  // Lifecycle change via the Emergency Core Service (single source of truth):
  // validates SEVERITY_SELECTED → HOSPITAL_NOTIFIED (official path) or
  // HOSPITAL_ACCEPTED → HOSPITAL_NOTIFIED (classic path), writes the
  // timeline event, and emits `statusChanged`.
  const updated = await updateEmergencyStatus(emergencyId, {
    status: EmergencyStatus.HOSPITAL_NOTIFIED,
    etaMinutes,
    description: `${hospital.name} notified — severity ${emergency.severity ?? "N/A"}, patient onboard, ETA ${etaMinutes} min`,
    metadata: {
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      severity: emergency.severity,
      patientOnboard: true,
      etaMinutes,
      criticalAlert: emergency.criticalAlert,
    },
  });

  emergencyEvents.emit("hospitalNotified", {
    emergencyId,
    hospitalId: hospital.id,
    severity: emergency.severity,
    patientOnboard: true as const,
    etaMinutes,
    criticalAlert: emergency.criticalAlert,
    emergency: updated,
  });

  log(
    `emergency ${emergencyId}: hospital ${hospital.name} notified (severity ${emergency.severity}, ETA ${etaMinutes} min)`
  );

  return updated;
}

// ============================================================================
// Hospital console inbox
// ============================================================================

/**
 * Every pending acceptance request addressed to a hospital, with the request
 * payload the hospital console needs (emergency type, patient age, critical
 * alert, estimated arrival, required services).
 */
export async function getHospitalRequests(hospitalId: string) {
  const hospital = await hospitalRepo.findHospitalById(hospitalId);
  if (!hospital) {
    throw new AppError(
      404,
      "HOSPITAL_NOT_FOUND",
      `Hospital ${hospitalId} not found`
    );
  }

  const pending = await hospitalRepo.findPendingRequestsForHospital(hospitalId);

  return pending.map((c) => {
    const required = deriveRequiredCapabilities(
      c.emergency.emergencyType,
      c.emergency.severity
    );
    const distanceKm = haversineDistanceKm(
      c.emergency.patientLatitude,
      c.emergency.patientLongitude,
      hospital.latitude,
      hospital.longitude
    );
    return {
      candidateId: c.id,
      requestedAt: c.createdAt,
      ...buildRequestPayload(
        c.emergency,
        hospitalId,
        c.rank,
        estimateTransportEtaMinutes(distanceKm),
        required
      ),
      emergency: c.emergency,
    };
  });
}

// ============================================================================
// Event-driven orchestration (the automatic workflow triggers)
// ============================================================================

let handlersRegistered = false;

/**
 * Wires the Hospital module into the emergency lifecycle:
 *
 *   - AMBULANCE_EN_ROUTE  ⇒ automatically begin Hospital Discovery
 *     (search runs while the ambulance travels to the patient)
 *   - PATIENT_PICKED_UP   ⇒ the hospital assignment becomes FINAL
 *     (`hospitalAssignmentLocked` emitted; later acceptances are ignored)
 *
 * Handlers are fire-and-forget and swallow their own errors — a hospital
 * search failure must never disturb the emergency lifecycle write that
 * triggered it.
 */
export function registerHospitalEventHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  emergencyEvents.on(
    "statusChanged",
    (payload: { emergency: { id: string; assignedHospitalId: string | null } | null; newStatus: EmergencyStatus }) => {
      const emergency = payload.emergency;
      if (!emergency) return;

      if (payload.newStatus === EmergencyStatus.AMBULANCE_EN_ROUTE) {
        startHospitalSearch(emergency.id).catch((e) =>
          log(`auto hospital search failed for ${emergency.id}: ${e.message}`)
        );
      }

      if (
        payload.newStatus === EmergencyStatus.PATIENT_PICKED_UP &&
        emergency.assignedHospitalId
      ) {
        log(
          `emergency ${emergency.id}: hospital assignment LOCKED (${emergency.assignedHospitalId})`
        );
        emergencyEvents.emit("hospitalAssignmentLocked", {
          emergencyId: emergency.id,
          hospitalId: emergency.assignedHospitalId,
        });
      }
    }
  );

  log("event handlers registered (auto-search on AMBULANCE_EN_ROUTE, lock on PATIENT_PICKED_UP)");
}
