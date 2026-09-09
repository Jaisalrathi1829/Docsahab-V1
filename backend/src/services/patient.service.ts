// ============================================================================
// Patient Service
// ============================================================================
// The patient side of the workflow: medical profile persistence, and the SOS
// entry point that creates the ONE emergency record both apps then observe.
// ============================================================================

import { EmergencyStatus } from "../enums/emergency-status.enum";
import * as patientRepo from "../repositories/patient.repository";
import * as emergencyRepo from "../repositories/emergency.repository";
import * as emergencyService from "./emergency.service";
import * as ambulanceService from "./ambulance.service";
import { deriveProbableEmergency } from "./clinical-derivation.service";
import { AppError } from "../middleware/error-handler.middleware";

// --------------------------------------------------------------------------
// Profile
// --------------------------------------------------------------------------

export async function getProfile(patientId: string) {
  const patient = await patientRepo.findById(patientId);
  if (!patient) {
    throw new AppError(404, "PATIENT_NOT_FOUND", "Patient record not found");
  }
  return patient;
}

export async function saveProfile(
  patientId: string,
  profile: patientRepo.PatientProfileInput
) {
  await getProfile(patientId); // 404s cleanly if the session outlived the record
  return patientRepo.saveProfile(patientId, profile);
}

// --------------------------------------------------------------------------
// Active emergency
// --------------------------------------------------------------------------

/**
 * The emergency this patient is currently in, or null. Drives app rehydration
 * after a refresh — the patient lands back on the live emergency screen.
 */
export async function getActiveEmergency(patientId: string) {
  return patientRepo.findActiveEmergencyForPatient(patientId);
}

// --------------------------------------------------------------------------
// SOS
// --------------------------------------------------------------------------

export interface TriggerSosInput {
  latitude: number;
  longitude: number;
  address?: string;
  /**
   * False when the device refused/failed to provide a real fix and the client
   * fell back to a known position. Recorded so the responder view can say so
   * rather than implying a real GPS lock.
   */
  locationIsPrecise?: boolean;
}

/**
 * Creates the emergency and immediately requests an ambulance.
 *
 * Assignment is performed here, server-side, rather than being a second call
 * the client is trusted to make — an emergency that exists but was never
 * dispatched is the worst possible failure mode for this product.
 *
 * A dispatch failure does NOT roll back the emergency: the SOS is real and
 * must stay visible. The caller receives the emergency plus a dispatch note.
 */
export async function triggerSos(patientId: string, input: TriggerSosInput) {
  const patient = await getProfile(patientId);

  if (!patient.profileCompleted) {
    throw new AppError(
      400,
      "PROFILE_INCOMPLETE",
      "Complete your medical profile before triggering an SOS"
    );
  }

  // One live emergency per patient. A second SOS returns the existing one
  // instead of creating a duplicate the two apps would then disagree about.
  const existing = await patientRepo.findActiveEmergencyForPatient(patientId);
  if (existing) {
    return {
      emergency: existing,
      alreadyActive: true,
      dispatch: { assigned: existing.assignedAmbulanceId !== null, note: null as string | null },
    };
  }

  // Probable emergency comes from medical HISTORY (conditions); the critical
  // alert is derived separately from allergies inside the repository.
  const probableEmergency = deriveProbableEmergency(patient.conditions);

  const emergency = await emergencyService.createEmergency({
    patientId,
    patientLatitude: input.latitude,
    patientLongitude: input.longitude,
    patientAddress: input.address,
    emergencyType: probableEmergency,
    patientName: patient.fullName,
    patientAge: patient.age,
    patientSex: patient.sex ?? undefined,
    patientBloodGroup: patient.bloodGroup,
    patientAllergies: patient.allergies,
    patientConditions: patient.conditions,
    patientMedications: patient.medications,
  });

  // Dispatch immediately. Only an eligible (ONLINE + free) unit can be matched.
  let assigned = false;
  let note: string | null = null;
  try {
    await ambulanceService.assignNearestAmbulance(emergency.id);
    assigned = true;
  } catch (error) {
    note =
      error instanceof AppError && error.code === "NO_AMBULANCE_AVAILABLE"
        ? "No ambulance is online right now. You are in the dispatch queue."
        : `Dispatch failed: ${(error as Error).message}`;
  }

  const current = await emergencyRepo.findEmergencyById(emergency.id);

  return {
    emergency: current!,
    alreadyActive: false,
    dispatch: { assigned, note },
  };
}

/**
 * Cancels the patient's active emergency. Only legal before pickup — the
 * transition map enforces that, so a cancel attempt after pickup is rejected
 * with the standard invalid-transition error rather than a special case here.
 */
export async function cancelActiveEmergency(patientId: string) {
  const active = await patientRepo.findActiveEmergencyForPatient(patientId);
  if (!active) {
    throw new AppError(
      404,
      "NO_ACTIVE_EMERGENCY",
      "There is no active emergency to cancel"
    );
  }

  return emergencyService.updateEmergencyStatus(active.id, {
    status: EmergencyStatus.CANCELLED,
    description: "Cancelled by patient",
  });
}
