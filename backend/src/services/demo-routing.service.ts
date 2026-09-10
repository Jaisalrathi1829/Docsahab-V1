// ============================================================================
// Demo Routing Service — isolated forced-pairing override
// ============================================================================
// Exists for exactly one purpose: when DOCSAHAB_DEMO_MODE is enabled, force
// the configured demo patient to always be dispatched to the configured demo
// ambulance, bypassing nearest-unit / distance-based matching for that one
// pairing only.
//
// This is the ONLY place in the backend that checks the demo phone numbers.
// It resolves REAL database records (via the same auth.repository lookups
// used by login) — never a frontend-supplied identity, never a fabricated
// record. Every other patient and every other ambulance is completely
// unaffected; this function returns null for all of them and the caller
// (ambulance.service.ts) falls straight through to normal dispatch.
// ============================================================================

import { demoRoutingConfig } from "../config/demo-routing.config";
import * as authRepo from "../repositories/auth.repository";
import type { RankedHospital } from "hospital-decision-engine";

const log = (message: string, meta?: unknown) =>
  console.log(`[demo-routing] ${message}`, meta ?? "");

/**
 * Resolves the forced demo ambulance for a dispatch request, or null if this
 * is not the demo case (demo mode off, or the phone doesn't match exactly).
 *
 * Returning null is always safe: it means "use normal dispatch."
 */
export async function resolveDemoAmbulance(patientPhoneNumber: string) {
  if (!demoRoutingConfig.enabled) return null;
  if (patientPhoneNumber !== demoRoutingConfig.demoPatientPhone) return null;

  const ambulance = await authRepo.findAmbulanceByPhone(demoRoutingConfig.demoAmbulancePhone);
  if (!ambulance) {
    // The demo ambulance account has never logged in yet (no DB row exists).
    // There is nothing to force-assign to, so we degrade to normal dispatch
    // rather than blocking the demo patient's SOS entirely. Loudly logged so
    // this is never a silent surprise during a live demo.
    log(
      `DEMO MODE is ON and patient ${patientPhoneNumber} matches, but no ambulance record exists for ${demoRoutingConfig.demoAmbulancePhone} yet — falling back to normal dispatch. Log in as the demo ambulance at least once before demoing.`
    );
    return null;
  }

  log(
    `forcing demo pairing: patient ${patientPhoneNumber} -> ambulance ${ambulance.vehicleNo} (${ambulance.id}, phone ${demoRoutingConfig.demoAmbulancePhone})`
  );
  return ambulance;
}

/** True iff this exact phone number is the configured demo patient AND demo mode is on. */
export function isDemoPatient(phoneNumber: string): boolean {
  return demoRoutingConfig.enabled && phoneNumber === demoRoutingConfig.demoPatientPhone;
}

/**
 * Resolves the real, pre-provisioned demo hospital — or null if this isn't
 * the demo patient's emergency, demo mode is off, or the hospital hasn't
 * been seeded/registered yet. Never fabricates a hospital record.
 */
export async function resolveDemoHospital(patientPhoneNumber: string) {
  if (!demoRoutingConfig.enabled) return null;
  if (patientPhoneNumber !== demoRoutingConfig.demoPatientPhone) return null;

  const hospital = await authRepo.findHospitalByPhone(demoRoutingConfig.demoHospitalPhone);
  if (!hospital) {
    log(
      `DEMO MODE is ON and patient ${patientPhoneNumber} matches, but no hospital record exists for ${demoRoutingConfig.demoHospitalPhone} yet — demo hospital guarantee skipped (seed it first).`
    );
    return null;
  }
  return hospital;
}

/**
 * For the demo patient's emergency ONLY: guarantees the demo hospital is
 * among the invited candidates, without changing anyone's real rank/score
 * and WITHOUT inventing eligibility for a hospital that genuinely failed a
 * hard filter. `allRanked` is the engine's full (unsliced) eligible-and-
 * ranked list; `naturalTopN` is what would normally be invited.
 *
 * - Demo hospital already in naturalTopN            -> unchanged (real ranking won).
 * - Demo hospital eligible but ranked outside topN   -> appended, keeping its
 *   REAL rank/score, so the invited set becomes topN + 1 for this emergency.
 * - Demo hospital genuinely ineligible (hard filter)  -> NOT forced in; logged
 *   with the real exclusion reason so the root cause is fixable, not hidden.
 *
 * Every other patient's emergency is untouched — this only ever runs after
 * resolveDemoHospital() has already confirmed the demo patient + demo mode.
 */
export function ensureDemoHospitalInvited(
  demoHospitalId: string,
  demoHospitalName: string,
  naturalTopN: ReadonlyArray<RankedHospital>,
  allRanked: ReadonlyArray<RankedHospital>,
  excluded: ReadonlyArray<{ hospitalId: unknown; reasons: ReadonlyArray<{ type: string }> }>
): RankedHospital[] {
  const isId = (h: { hospitalId: unknown }) => h.hospitalId?.toString() === demoHospitalId;

  if (naturalTopN.some(isId)) {
    return [...naturalTopN]; // already genuinely in — nothing to do
  }

  const realEntry = allRanked.find(isId);
  if (realEntry) {
    log(
      `demo hospital guarantee: including ${demoHospitalName} (real rank #${realEntry.rank}, score ${realEntry.finalScore.toFixed(3)}) alongside the natural top-${naturalTopN.length} for the demo emergency`
    );
    return [...naturalTopN, realEntry];
  }

  const excludedEntry = excluded.find(isId);
  log(
    `demo hospital ${demoHospitalName} is NOT eligible for this emergency${
      excludedEntry ? ` (${excludedEntry.reasons.map((r) => r.type).join(", ")})` : " (not found in ranking output)"
    } — the guarantee does not fabricate eligibility. Fix the underlying live-status/capability data if this is unexpected.`
  );
  return [...naturalTopN];
}
