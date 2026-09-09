// ============================================================================
// Hospital Selection Provider
// ============================================================================
// Abstraction over "which hospital should receive this patient".
//
// TODAY : SimulationHospitalProvider — deterministically selects the
//         best-ranked hospital produced by the existing ranking engine and
//         accepts on that hospital's behalf, because no hospital-facing
//         console exists yet to press Accept.
//
// LATER : LiveDeterministicHospitalRankingProvider — same interface, but the
//         acceptance comes from a real hospital operator responding to a real
//         request, against fresh operational capacity data.
//
// The frontends never learn which provider is active, and never rank or pick
// a hospital themselves. They render `emergency.assignedHospital` and the
// lock flag, both owned by the backend.
//
// ── How the simulation plugs in ─────────────────────────────────────────────
// It does NOT reimplement ranking. The Hospital module already:
//   1. auto-starts a search when the ambulance goes AMBULANCE_EN_ROUTE,
//   2. ranks hospitals (capability + ETA + resources),
//   3. writes ranked HospitalCandidate rows, and
//   4. emits `hospitalCandidatesRanked`.
// This provider subscribes to (4) and performs the acceptance the missing
// hospital console would have performed — going through the very same
// transactional accept path, which already enforces the post-pickup lock.
// ============================================================================

import { emergencyEvents } from "../services/emergency.service";
import * as hospitalService from "../services/hospital.service";
import * as hospitalRepo from "../repositories/hospital.repository";
import * as emergencyRepo from "../repositories/emergency.repository";
import { AppError } from "../middleware/error-handler.middleware";

const log = (message: string, meta?: unknown) =>
  console.log(`[hospital-selection] ${message}`, meta ?? "");

export interface HospitalSelectionResult {
  hospitalId: string;
  hospitalName: string | null;
  rank: number;
  /** Why this hospital was chosen — surfaced for explainability. */
  reason: string;
  /** False until the patient is picked up; true once the destination is final. */
  locked: boolean;
  provider: string;
}

export interface HospitalSelectionProvider {
  readonly name: string;
  /**
   * Ensure the emergency has an assigned hospital, selecting one if needed.
   * Returns null when no eligible hospital could be selected.
   */
  selectForEmergency(emergencyId: string): Promise<HospitalSelectionResult | null>;
}

export class SimulationHospitalProvider implements HospitalSelectionProvider {
  readonly name = "simulation";

  /**
   * Runs a search (if no candidates exist yet) and accepts the best-ranked
   * hospital. Idempotent: if a hospital is already assigned it is returned
   * unchanged rather than reselected.
   */
  async selectForEmergency(
    emergencyId: string
  ): Promise<HospitalSelectionResult | null> {
    const emergency = await emergencyRepo.findEmergencyById(emergencyId);
    if (!emergency) return null;

    // Already decided — never churn an existing assignment here.
    if (emergency.assignedHospitalId) {
      const existing = await hospitalRepo.findCandidate(
        emergencyId,
        emergency.assignedHospitalId
      );
      return {
        hospitalId: emergency.assignedHospitalId,
        hospitalName: emergency.assignedHospital?.name ?? null,
        rank: existing?.rank ?? 1,
        reason: "Already assigned",
        locked: emergency.hospitalLockedAt !== null,
        provider: this.name,
      };
    }

    // Reuse the real ranking engine to produce candidates.
    let candidates = await emergencyRepo.findHospitalCandidates(emergencyId);
    if (candidates.length === 0) {
      const round = await hospitalService.startHospitalSearch(emergencyId);
      candidates = round.candidates;
    }

    const pending = candidates
      .filter((c) => c.response === "PENDING")
      .sort((a, b) => a.rank - b.rank);

    if (pending.length === 0) {
      log(`no selectable hospital for emergency ${emergencyId}`);
      return null;
    }

    return this.acceptOnBehalfOf(emergencyId, pending[0].hospitalId, pending[0].rank);
  }

  /**
   * Performs the acceptance the (not-yet-built) hospital console would do.
   * Goes through the module's transactional accept path, so the atomic claim,
   * candidate bookkeeping, timeline entry, events and — critically — the
   * post-pickup lock rule all apply exactly as they would for a real hospital.
   */
  private async acceptOnBehalfOf(
    emergencyId: string,
    hospitalId: string,
    rank: number
  ): Promise<HospitalSelectionResult | null> {
    try {
      const result = await hospitalService.respondToHospitalRequest(
        emergencyId,
        hospitalId,
        "ACCEPTED"
      );

      const emergency = await emergencyRepo.findEmergencyById(emergencyId);

      log(
        `emergency ${emergencyId}: hospital ${hospitalId} selected (rank ${rank}, changed=${result.assignmentChanged}, locked=${result.locked})`
      );

      return {
        hospitalId,
        hospitalName: emergency?.assignedHospital?.name ?? null,
        rank,
        reason: `Best-ranked eligible hospital (rank ${rank})`,
        locked: emergency?.hospitalLockedAt !== null,
        provider: this.name,
      };
    } catch (error) {
      // A locked or already-assigned emergency is a legitimate no-op, not a
      // failure — the destination simply stands.
      if (
        error instanceof AppError &&
        (error.code === "HOSPITAL_ALREADY_ASSIGNED" ||
          error.code === "HOSPITAL_ASSIGNMENT_LOCKED")
      ) {
        log(`emergency ${emergencyId}: selection skipped (${error.code})`);
        return null;
      }
      throw error;
    }
  }
}

export const hospitalSelectionProvider: HospitalSelectionProvider =
  new SimulationHospitalProvider();

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

let registered = false;

/**
 * Subscribes the provider to the ranking engine's output so hospital
 * coordination completes automatically WHILE the ambulance is still driving
 * to the patient — which is the intended product timing, not an afterthought
 * that waits for pickup.
 *
 * Fire-and-forget by design: a hospital-selection failure must never break
 * the emergency lifecycle write that triggered it.
 */
export function registerHospitalSelectionProvider(): void {
  if (registered) return;
  registered = true;

  emergencyEvents.on("hospitalCandidatesRanked", (payload: { emergencyId: string }) => {
    hospitalSelectionProvider
      .selectForEmergency(payload.emergencyId)
      .catch((e) =>
        log(`auto-selection failed for ${payload.emergencyId}: ${(e as Error).message}`)
      );
  });

  log(`registered (${hospitalSelectionProvider.name} provider, auto-selects on ranking)`);
}
