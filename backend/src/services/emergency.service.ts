// ============================================================================
// Emergency Service
// ============================================================================
// Business logic layer for the Emergency Core Service.
//
// Responsibilities:
// - Validates status transitions (state machine enforcement)
// - Automatically creates timeline events on every status change
// - Derives computed fields (criticalAlert)
// - Emits events for downstream modules (Realtime, Notifications)
//
// This layer sits between the controller (HTTP) and repository (database).
// Other modules can also import this service directly for programmatic use.
// ============================================================================

import { EventEmitter } from "events";
import * as emergencyRepo from "../repositories/emergency.repository";
import {
  CreateEmergencyInput,
  UpdateStatusInput,
} from "../types/emergency.types";
import {
  EmergencyStatus,
  STATUS_LABELS,
  isValidTransition,
} from "../enums/emergency-status.enum";
import { AppError } from "../middleware/error-handler.middleware";

// --------------------------------------------------------------------------
// Event Emitter
// --------------------------------------------------------------------------
// The realtime module (Person 4) can subscribe to these events to push
// updates via Socket.IO without tight coupling.
//
// Usage from the Realtime module:
//   import { emergencyEvents } from "../services/emergency.service";
//   emergencyEvents.on("statusChanged", (data) => { ... });
// --------------------------------------------------------------------------

export const emergencyEvents = new EventEmitter();

/**
 * Events emitted by the Emergency Service:
 *
 * "emergencyCreated"  — payload: { emergency }
 * "statusChanged"     — payload: { emergency, previousStatus, newStatus, timelineEvent }
 */

// --------------------------------------------------------------------------
// Create Emergency (SOS Trigger)
// --------------------------------------------------------------------------

/**
 * Creates a new emergency and records the initial SOS_TRIGGERED timeline event.
 *
 * Called when a patient presses the SOS button.
 */
export async function createEmergency(input: CreateEmergencyInput) {
  // Create the emergency record
  const emergency = await emergencyRepo.createEmergency(input);

  // Create the initial timeline event
  const timelineEvent = await emergencyRepo.createTimelineEvent({
    emergencyId: emergency.id,
    status: EmergencyStatus.SOS_TRIGGERED,
    label: STATUS_LABELS[EmergencyStatus.SOS_TRIGGERED],
    description: "Emergency SOS triggered by patient",
  });

  // Re-fetch with timeline included
  const fullEmergency = await emergencyRepo.findEmergencyById(emergency.id);

  // Emit event for realtime module
  emergencyEvents.emit("emergencyCreated", {
    emergency: fullEmergency,
  });

  return fullEmergency!;
}

// --------------------------------------------------------------------------
// Get Emergency
// --------------------------------------------------------------------------

/**
 * Retrieves a complete emergency with all relations (timeline, hospital candidates).
 *
 * Consumed by all three frontends and all backend modules.
 */
export async function getEmergencyById(id: string) {
  const emergency = await emergencyRepo.findEmergencyById(id);

  if (!emergency) {
    throw new AppError(404, "EMERGENCY_NOT_FOUND", `Emergency ${id} not found`);
  }

  return emergency;
}

/**
 * Returns the emergency currently in progress (most recent non-terminal), or
 * null when none is active. Read-only discovery for the responder frontends.
 */
export async function getActiveEmergency() {
  return emergencyRepo.findActiveEmergency();
}

// --------------------------------------------------------------------------
// Update Emergency Status
// --------------------------------------------------------------------------

/**
 * Advances the emergency through its lifecycle.
 *
 * This is the most critical method in the entire Docsahab platform:
 * 1. Validates the state transition (prevents invalid jumps)
 * 2. Updates the emergency record with new status + optional fields
 * 3. Creates an immutable timeline event
 * 4. Emits events for the realtime module
 *
 * Called by:
 * - Ambulance Matching module (AMBULANCE_ASSIGNED, AMBULANCE_EN_ROUTE)
 * - Ambulance app (PATIENT_PICKED_UP, SEVERITY_SELECTED)
 * - Hospital Ranking module (HOSPITAL_SEARCHING, HOSPITAL_ACCEPTANCE_REQUESTED)
 * - Hospital Acceptance module (HOSPITAL_ACCEPTED)
 * - Hospital app (HOSPITAL_NOTIFIED)
 * - Ambulance app (EN_ROUTE_TO_HOSPITAL, ARRIVED)
 */
export async function updateEmergencyStatus(
  emergencyId: string,
  input: UpdateStatusInput
) {
  // 1. Fetch current emergency
  const current = await emergencyRepo.findEmergencyById(emergencyId);

  if (!current) {
    throw new AppError(
      404,
      "EMERGENCY_NOT_FOUND",
      `Emergency ${emergencyId} not found`
    );
  }

  // 2. Validate state transition
  if (!isValidTransition(current.status, input.status)) {
    throw new AppError(
      400,
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from ${current.status} to ${input.status}. ` +
        `Valid transitions from ${current.status}: ${getValidNextStatuses(current.status)}`
    );
  }

  // 3. Build update payload (only include fields that were provided)
  const updateData: Parameters<typeof emergencyRepo.updateEmergency>[1] = {
    status: input.status,
  };

  if (input.severity !== undefined) updateData.severity = input.severity;
  if (input.assignedAmbulanceId !== undefined)
    updateData.assignedAmbulanceId = input.assignedAmbulanceId;
  if (input.assignedHospitalId !== undefined)
    updateData.assignedHospitalId = input.assignedHospitalId;
  if (input.etaMinutes !== undefined) updateData.etaMinutes = input.etaMinutes;
  if (input.emergencyType !== undefined)
    updateData.emergencyType = input.emergencyType;
  if (input.criticalAlert !== undefined)
    updateData.criticalAlert = input.criticalAlert;

  // 3b. Lifecycle-driven timestamps.
  //
  // Patient pickup is the moment the hospital destination becomes FINAL.
  // Stamping it here — on the single path every status change flows through —
  // means the lock cannot be bypassed by any caller, and it is stamped only
  // once (a repeated pickup is already rejected by the transition guard above).
  if (
    input.status === EmergencyStatus.PATIENT_PICKED_UP &&
    current.hospitalLockedAt === null
  ) {
    updateData.hospitalLockedAt = new Date();
  }

  if (
    input.status === EmergencyStatus.HOSPITAL_NOTIFIED &&
    current.hospitalNotifiedAt === null
  ) {
    updateData.hospitalNotifiedAt = new Date();
  }

  // 4. Update the emergency
  const updated = await emergencyRepo.updateEmergency(emergencyId, updateData);

  // 5. Create timeline event
  const timelineLabel = STATUS_LABELS[input.status];
  const timelineDescription = buildTimelineDescription(input);

  const timelineEvent = await emergencyRepo.createTimelineEvent({
    emergencyId,
    status: input.status,
    label: timelineLabel,
    description: timelineDescription || undefined,
    metadata: input.metadata,
  });

  // 6. Re-fetch full emergency with updated timeline
  const fullEmergency = await emergencyRepo.findEmergencyById(emergencyId);

  // 7. Emit event for realtime module
  emergencyEvents.emit("statusChanged", {
    emergency: fullEmergency,
    previousStatus: current.status,
    newStatus: input.status,
    timelineEvent,
  });

  return fullEmergency!;
}

// --------------------------------------------------------------------------
// Get Timeline
// --------------------------------------------------------------------------

/**
 * Returns the complete timeline for an emergency.
 * Provides a chronological audit trail of every status change.
 */
export async function getEmergencyTimeline(emergencyId: string) {
  // Verify emergency exists
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(
      404,
      "EMERGENCY_NOT_FOUND",
      `Emergency ${emergencyId} not found`
    );
  }

  return emergencyRepo.findTimelineByEmergencyId(emergencyId);
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Returns human-readable list of valid next statuses.
 * Used in error messages.
 */
function getValidNextStatuses(currentStatus: EmergencyStatus): string {
  const { VALID_TRANSITIONS } = require("../enums/emergency-status.enum");
  const next = VALID_TRANSITIONS[currentStatus] as EmergencyStatus[];
  if (next.length === 0) return "none (terminal state)";
  return next.join(", ");
}

/**
 * Builds a human-readable timeline description from the update input.
 */
function buildTimelineDescription(input: UpdateStatusInput): string | null {
  const parts: string[] = [];

  if (input.description) {
    return input.description;
  }

  if (input.assignedAmbulanceId) {
    parts.push(`Ambulance ${input.assignedAmbulanceId} assigned`);
  }
  if (input.assignedHospitalId) {
    parts.push(`Hospital ${input.assignedHospitalId} assigned`);
  }
  if (input.severity) {
    parts.push(`Severity set to ${input.severity}`);
  }
  if (input.etaMinutes !== undefined) {
    parts.push(`ETA: ${input.etaMinutes} minutes`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
