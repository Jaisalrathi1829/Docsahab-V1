// ============================================================================
// Ambulance Matching Service (Person 2)
// ============================================================================
// Foundation-native business logic for ambulance discovery, nearest-unit
// selection, ETA generation, and atomic assignment.
//
// Reuses the frozen foundation:
//   - Ambulance / Emergency Prisma models (via repositories)
//   - EmergencyStatus lifecycle + transition rules
//   - emergencyEvents emitter (shared with the Emergency Core Service)
//   - AppError + standardized error codes
//
// It does NOT introduce a separate server, schema, or status system.
// ============================================================================

import type { Ambulance } from "@prisma/client";
import { EmergencyStatus, isValidTransition } from "../enums/emergency-status.enum";
import * as ambulanceRepo from "../repositories/ambulance.repository";
import * as emergencyRepo from "../repositories/emergency.repository";
import { emergencyEvents } from "./emergency.service";
import { haversineDistanceKm } from "../utils/haversine";
import { ambulanceMatchingConfig } from "../config/ambulance-matching.config";
import { AppError } from "../middleware/error-handler.middleware";
import type { NearestAmbulanceSelection } from "../types/ambulance.types";
import { resolveDemoAmbulance } from "./demo-routing.service";

const log = (message: string, meta?: unknown) =>
  console.log(`[ambulance-matching] ${message}`, meta ?? "");

/**
 * How many times to fall back to the next-nearest ambulance when a concurrent
 * request wins the atomic claim first. Bounds worst-case work under contention.
 */
const MAX_ASSIGNMENT_ATTEMPTS = 5;

// --------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// --------------------------------------------------------------------------

const isValidCoordinate = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

/**
 * Selects the nearest ambulance to a point by straight-line distance.
 * Pure — does not mutate inputs. Returns null for an empty fleet.
 *
 * @throws AppError(400, INVALID_COORDINATES) if the target point is invalid.
 */
export function selectNearestAmbulance(
  ambulances: Ambulance[],
  patientLat: number,
  patientLng: number
): NearestAmbulanceSelection | null {
  if (!isValidCoordinate(patientLat, patientLng)) {
    throw new AppError(
      400,
      "INVALID_COORDINATES",
      `Patient coordinates are invalid (lat=${patientLat}, lng=${patientLng})`
    );
  }
  if (ambulances.length === 0) return null;

  let best: NearestAmbulanceSelection | null = null;
  for (const ambulance of ambulances) {
    if (!isValidCoordinate(ambulance.latitude, ambulance.longitude)) continue;
    const distanceKm = haversineDistanceKm(
      patientLat,
      patientLng,
      ambulance.latitude,
      ambulance.longitude
    );
    if (best === null || distanceKm < best.distanceKm) {
      best = { ambulance, distanceKm };
    }
  }
  return best;
}

/**
 * Converts a straight-line distance into an ETA in whole minutes.
 *
 *   minutes = (distanceKm / averageSpeedKmph) * 60   →  rounded up
 *
 * Clamped to a configurable floor. See ambulance-matching.config.ts for the
 * speed/floor assumptions (no magic numbers here).
 */
export function estimateEtaMinutes(
  distanceKm: number,
  config = ambulanceMatchingConfig
): number {
  const rawMinutes = (distanceKm / config.averageSpeedKmph) * 60;
  return Math.max(config.minimumEtaMinutes, Math.ceil(rawMinutes));
}

// --------------------------------------------------------------------------
// Discovery
// --------------------------------------------------------------------------

export async function listAmbulances(available?: boolean) {
  return ambulanceRepo.findAmbulances(available);
}

// --------------------------------------------------------------------------
// Assignment workflow
// --------------------------------------------------------------------------

/**
 * Finds the nearest available ambulance for an emergency and assigns it
 * atomically, advancing the emergency to AMBULANCE_ASSIGNED.
 *
 * Steps:
 *   1. Load + validate the emergency (exists, not already assigned, can transition).
 *   2. Validate the patient coordinates captured at SOS time.
 *   3. Query real available ambulances and pick the nearest (haversine).
 *   4. Compute ETA.
 *   5. Commit the assignment in one transaction (atomic ambulance claim +
 *      emergency update + timeline event).
 *   6. Re-fetch the fully-included emergency and emit events.
 *
 * @param patientPhoneNumber optional — when it exactly matches the configured
 *        demo patient phone AND DOCSAHAB_DEMO_MODE is enabled, dispatch is
 *        forced to the configured demo ambulance instead of nearest-matching.
 *        See demo-routing.service.ts; every other caller is unaffected.
 * @returns the full emergency (same shape as GET /emergency/:id).
 */
export async function assignNearestAmbulance(
  emergencyId: string,
  patientPhoneNumber?: string
) {
  // 1. Load + validate the emergency.
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(
      404,
      "EMERGENCY_NOT_FOUND",
      `Emergency ${emergencyId} not found`
    );
  }
  if (emergency.assignedAmbulanceId) {
    throw new AppError(
      409,
      "EMERGENCY_ALREADY_HAS_AMBULANCE",
      `Emergency ${emergencyId} already has ambulance ${emergency.assignedAmbulanceId}`
    );
  }
  if (!isValidTransition(emergency.status, EmergencyStatus.AMBULANCE_ASSIGNED)) {
    throw new AppError(
      400,
      "INVALID_STATUS_TRANSITION",
      `Cannot assign an ambulance while emergency is ${emergency.status}`
    );
  }

  // 2. Validate captured coordinates (defensive — they were Zod-validated at SOS).
  if (!isValidCoordinate(emergency.patientLatitude, emergency.patientLongitude)) {
    throw new AppError(
      400,
      "INVALID_COORDINATES",
      `Emergency ${emergencyId} has invalid patient coordinates`
    );
  }

  const previousEtaMinutes = emergency.etaMinutes ?? null;

  // ---- Demo routing override (isolated; see demo-routing.service.ts) --------
  // Checked ONLY here, ONLY for the exact configured demo patient phone, ONLY
  // when DOCSAHAB_DEMO_MODE is on. Every other caller (patientPhoneNumber
  // omitted, wrong number, or demo mode off) falls straight through to the
  // unmodified nearest-ambulance logic below.
  if (patientPhoneNumber) {
    const demoAmbulance = await resolveDemoAmbulance(patientPhoneNumber);
    if (demoAmbulance) {
      const distanceKm = isValidCoordinate(demoAmbulance.latitude, demoAmbulance.longitude)
        ? haversineDistanceKm(
            emergency.patientLatitude,
            emergency.patientLongitude,
            demoAmbulance.latitude,
            demoAmbulance.longitude
          )
        : 0; // no real position shared yet — proximity is irrelevant to this forced pairing anyway
      const etaMinutes = estimateEtaMinutes(distanceKm);
      try {
        return await commitAmbulanceAssignment(
          emergencyId,
          demoAmbulance,
          distanceKm,
          etaMinutes,
          previousEtaMinutes,
          { demoRouting: true }
        );
      } catch (error) {
        if (error instanceof AppError && error.code === "AMBULANCE_NO_LONGER_AVAILABLE") {
          throw new AppError(
            503,
            "DEMO_AMBULANCE_NOT_AVAILABLE",
            `Demo ambulance ${demoAmbulance.vehicleNo} is not ONLINE/available right now — go online on that account before triggering the demo SOS`
          );
        }
        throw error;
      }
    }
  }

  // 3-6. Discover → select → atomically commit, with bounded retry. If a
  // concurrent request wins the atomic claim first, we fall back to the
  // next-nearest available unit rather than failing the caller.
  let lastConflict: AppError | null = null;

  for (let attempt = 1; attempt <= MAX_ASSIGNMENT_ATTEMPTS; attempt++) {
    // 3. Discover + select nearest available ambulance (re-queried each attempt
    //    so a just-claimed unit is excluded).
    const available = await ambulanceRepo.findAvailableAmbulances();
    const selection = selectNearestAmbulance(
      available,
      emergency.patientLatitude,
      emergency.patientLongitude
    );
    if (!selection) {
      log(`no ambulances available for emergency ${emergencyId}`);
      throw new AppError(
        503,
        "NO_AMBULANCE_AVAILABLE",
        "No ambulances are currently available"
      );
    }

    const { ambulance, distanceKm } = selection;

    // 4. ETA.
    const etaMinutes = estimateEtaMinutes(distanceKm);

    try {
      // 5-6. Atomic commit + event emission (shared with the demo path).
      return await commitAmbulanceAssignment(
        emergencyId,
        ambulance,
        distanceKm,
        etaMinutes,
        previousEtaMinutes
      );
    } catch (error) {
      // Only a lost atomic claim is retryable — re-select the next-nearest.
      // Everything else (e.g. emergency already assigned) propagates.
      if (
        error instanceof AppError &&
        error.code === "AMBULANCE_NO_LONGER_AVAILABLE"
      ) {
        lastConflict = error;
        log(
          `claim lost for ${ambulance.vehicleNo} on emergency ${emergencyId}; retrying (attempt ${attempt}/${MAX_ASSIGNMENT_ATTEMPTS})`
        );
        continue;
      }
      throw error;
    }
  }

  // Exhausted retries under sustained contention.
  throw (
    lastConflict ??
    new AppError(
      503,
      "NO_AMBULANCE_AVAILABLE",
      "Could not assign an ambulance after multiple attempts"
    )
  );
}

/**
 * Atomic commit + event emission shared by both the normal nearest-ambulance
 * path and the demo routing override. Identical downstream behavior either
 * way — the only difference is how `ambulance` was selected.
 */
async function commitAmbulanceAssignment(
  emergencyId: string,
  ambulance: Ambulance,
  distanceKm: number,
  etaMinutes: number,
  previousEtaMinutes: number | null,
  extraMetadata: Record<string, unknown> = {}
) {
  const distanceRounded = Number(distanceKm.toFixed(2));

  const { timelineEvent, previousStatus } = await ambulanceRepo.assignAmbulanceAtomically({
    emergencyId,
    ambulanceId: ambulance.id,
    etaMinutes,
    timelineDescription: extraMetadata.demoRouting
      ? `[DEMO ROUTING] Ambulance ${ambulance.vehicleNo} force-assigned · ETA ${etaMinutes} min`
      : `Ambulance ${ambulance.vehicleNo} assigned · ${distanceRounded} km · ETA ${etaMinutes} min`,
    metadata: {
      ambulanceId: ambulance.id,
      vehicleNo: ambulance.vehicleNo,
      distanceKm: distanceRounded,
      etaMinutes,
      ...extraMetadata,
    },
  });

  log(`assigned ${ambulance.vehicleNo} (${ambulance.id}) to emergency ${emergencyId}`, {
    distanceKm: distanceRounded,
    etaMinutes,
    ...extraMetadata,
  });

  // Re-fetch fully-included emergency and emit events.
  const fullEmergency = await emergencyRepo.findEmergencyById(emergencyId);

  // Reuse the existing lifecycle event so the Realtime module sees ambulance
  // assignment through the same `statusChanged` channel as every other status.
  emergencyEvents.emit("statusChanged", {
    emergency: fullEmergency,
    previousStatus,
    newStatus: EmergencyStatus.AMBULANCE_ASSIGNED,
    timelineEvent,
  });

  // Domain-specific events for ambulance-aware consumers.
  emergencyEvents.emit("ambulanceAssigned", {
    emergencyId,
    ambulanceId: ambulance.id,
    vehicleNo: ambulance.vehicleNo,
    distanceKm: distanceRounded,
    etaMinutes,
    emergency: fullEmergency,
  });
  emergencyEvents.emit("etaUpdated", {
    emergencyId,
    etaMinutes,
    previousEtaMinutes,
  });

  return fullEmergency!;
}
