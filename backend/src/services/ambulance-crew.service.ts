// ============================================================================
// Ambulance Crew Service
// ============================================================================
// The crew-facing side of an ambulance: its profile, its ONLINE/OFFLINE
// dispatch state, its live position, and the emergency it is currently
// working. Distinct from ambulance.service.ts, which owns MATCHING (choosing
// which unit to send) — this module owns the unit's own state.
// ============================================================================

import { EmergencyStatus } from "../enums/emergency-status.enum";
import { prisma } from "../prisma/client";
import * as ambulanceRepo from "../repositories/ambulance.repository";
import { AppError } from "../middleware/error-handler.middleware";

// --------------------------------------------------------------------------
// Profile
// --------------------------------------------------------------------------

export async function getProfile(ambulanceId: string) {
  const ambulance = await ambulanceRepo.findAmbulanceById(ambulanceId);
  if (!ambulance) {
    throw new AppError(404, "AMBULANCE_NOT_FOUND", "Ambulance record not found");
  }
  return ambulance;
}

export interface AmbulanceProfileInput {
  driverName: string;
  driverLicense?: string;
  drivingExperience?: string;
  vehicleNo: string;
  ambulanceType?: string;
  registrationNumber?: string;
  serviceArea?: string;
  baseLocation?: string;
  emergencyContact?: string;
}

/**
 * Saves the crew/vehicle/service profile and marks onboarding complete.
 *
 * `vehicleNo` is globally unique, so a collision is reported as a clean 409
 * rather than leaking a Prisma constraint error.
 */
export async function saveProfile(
  ambulanceId: string,
  profile: AmbulanceProfileInput
) {
  await getProfile(ambulanceId);

  const clash = await prisma.ambulance.findFirst({
    where: { vehicleNo: profile.vehicleNo, NOT: { id: ambulanceId } },
    select: { id: true },
  });
  if (clash) {
    throw new AppError(
      409,
      "VEHICLE_NUMBER_TAKEN",
      `Vehicle number ${profile.vehicleNo} is already registered`
    );
  }

  return prisma.ambulance.update({
    where: { id: ambulanceId },
    data: { ...profile, profileCompleted: true },
  });
}

// --------------------------------------------------------------------------
// Dispatch state (ONLINE / OFFLINE)
// --------------------------------------------------------------------------

/**
 * Toggles the unit's on-duty state. This is a REAL dispatch flag, not a UI
 * decoration: findAvailableAmbulances() requires isOnline, so an OFFLINE unit
 * is genuinely unreachable by matching.
 *
 * Rules enforced here:
 *  - going ONLINE requires a completed profile and a real position, because
 *    dispatch needs both to route to you;
 *  - going OFFLINE is refused while committed to a live emergency — a crew
 *    cannot make an in-progress patient undispatchable.
 */
export async function setOnlineStatus(
  ambulanceId: string,
  isOnline: boolean,
  location?: { latitude: number; longitude: number }
) {
  const ambulance = await getProfile(ambulanceId);

  if (isOnline) {
    if (!ambulance.profileCompleted) {
      throw new AppError(
        400,
        "PROFILE_INCOMPLETE",
        "Complete your ambulance profile before going online"
      );
    }

    const lat = location?.latitude ?? ambulance.latitude;
    const lng = location?.longitude ?? ambulance.longitude;
    if (lat === 0 && lng === 0) {
      throw new AppError(
        400,
        "LOCATION_REQUIRED",
        "Share your location before going online"
      );
    }

    return prisma.ambulance.update({
      where: { id: ambulanceId },
      data: { isOnline: true, latitude: lat, longitude: lng },
    });
  }

  const active = await findActiveEmergencyForAmbulance(ambulanceId);
  if (active) {
    throw new AppError(
      409,
      "EMERGENCY_IN_PROGRESS",
      "You cannot go offline while an emergency is in progress"
    );
  }

  return prisma.ambulance.update({
    where: { id: ambulanceId },
    data: { isOnline: false },
  });
}

/** Updates the unit's live position (used while online / navigating). */
export async function updateLocation(
  ambulanceId: string,
  latitude: number,
  longitude: number
) {
  await getProfile(ambulanceId);
  return prisma.ambulance.update({
    where: { id: ambulanceId },
    data: { latitude, longitude },
  });
}

// --------------------------------------------------------------------------
// Active emergency
// --------------------------------------------------------------------------

/**
 * The emergency this ambulance is currently assigned to, or null.
 *
 * This is the ambulance app's window onto the SAME Emergency row the patient
 * app is reading — there is no separate ambulance-side copy of the lifecycle.
 */
export async function findActiveEmergencyForAmbulance(ambulanceId: string) {
  return prisma.emergency.findFirst({
    where: {
      assignedAmbulanceId: ambulanceId,
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

/**
 * Guard used by every crew action on an emergency: confirms this ambulance is
 * actually the one assigned, so one crew cannot drive another's emergency.
 */
export async function assertAssignedTo(
  ambulanceId: string,
  emergencyId: string
) {
  const emergency = await prisma.emergency.findUnique({
    where: { id: emergencyId },
    select: { id: true, assignedAmbulanceId: true },
  });

  if (!emergency) {
    throw new AppError(404, "EMERGENCY_NOT_FOUND", "Emergency not found");
  }
  if (emergency.assignedAmbulanceId !== ambulanceId) {
    throw new AppError(
      403,
      "NOT_ASSIGNED_TO_EMERGENCY",
      "This emergency is not assigned to your ambulance"
    );
  }
  return emergency;
}

/**
 * Releases the unit back into the dispatch pool once its emergency reaches a
 * terminal state, so a repeatable demo does not slowly exhaust the fleet.
 */
export async function releaseIfFree(ambulanceId: string) {
  const active = await findActiveEmergencyForAmbulance(ambulanceId);
  if (active) return null;
  return prisma.ambulance.update({
    where: { id: ambulanceId },
    data: { isAvailable: true },
  });
}
