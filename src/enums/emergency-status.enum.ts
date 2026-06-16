// ============================================================================
// Emergency Status Enum & Transition Map
// ============================================================================
// Centralized status definitions consumed by ALL modules across Docsahab.
// The transition map enforces valid state machine progression and prevents
// impossible status jumps (e.g., SOS_TRIGGERED → ARRIVED).
// ============================================================================

import { EmergencyStatus } from "@prisma/client";

// Re-export so consumers don't need to import from @prisma/client directly
export { EmergencyStatus };

/**
 * Human-readable labels for each status.
 * Used by the timeline system and API responses.
 */
export const STATUS_LABELS: Record<EmergencyStatus, string> = {
  SOS_TRIGGERED: "SOS Triggered",
  AMBULANCE_ASSIGNED: "Ambulance Assigned",
  AMBULANCE_EN_ROUTE: "Ambulance En Route",
  PATIENT_PICKED_UP: "Patient Picked Up",
  SEVERITY_SELECTED: "Severity Selected",
  HOSPITAL_SEARCHING: "Hospital Search Started",
  HOSPITAL_ACCEPTANCE_REQUESTED: "Hospital Acceptance Requested",
  HOSPITAL_ACCEPTED: "Hospital Accepted",
  HOSPITAL_NOTIFIED: "Hospital Notified",
  EN_ROUTE_TO_HOSPITAL: "En Route to Hospital",
  ARRIVED: "Arrived at Hospital",
  CANCELLED: "Emergency Cancelled",
};

/**
 * Valid transitions from each status.
 *
 * Rules:
 * - CANCELLED is reachable only from the first three states (before patient pickup).
 * - After pickup, the emergency MUST complete — no cancellation allowed.
 * - HOSPITAL_ACCEPTANCE_REQUESTED can loop back to HOSPITAL_SEARCHING (retry if all reject).
 */
export const VALID_TRANSITIONS: Record<EmergencyStatus, EmergencyStatus[]> = {
  SOS_TRIGGERED: [
    EmergencyStatus.AMBULANCE_ASSIGNED,
    EmergencyStatus.CANCELLED,
  ],
  AMBULANCE_ASSIGNED: [
    EmergencyStatus.AMBULANCE_EN_ROUTE,
    EmergencyStatus.CANCELLED,
  ],
  AMBULANCE_EN_ROUTE: [
    EmergencyStatus.PATIENT_PICKED_UP,
    EmergencyStatus.CANCELLED,
  ],
  PATIENT_PICKED_UP: [
    EmergencyStatus.SEVERITY_SELECTED,
  ],
  SEVERITY_SELECTED: [
    EmergencyStatus.HOSPITAL_SEARCHING,
  ],
  HOSPITAL_SEARCHING: [
    EmergencyStatus.HOSPITAL_ACCEPTANCE_REQUESTED,
  ],
  HOSPITAL_ACCEPTANCE_REQUESTED: [
    EmergencyStatus.HOSPITAL_ACCEPTED,
    EmergencyStatus.HOSPITAL_SEARCHING, // Retry: all candidates rejected
  ],
  HOSPITAL_ACCEPTED: [
    EmergencyStatus.HOSPITAL_NOTIFIED,
  ],
  HOSPITAL_NOTIFIED: [
    EmergencyStatus.EN_ROUTE_TO_HOSPITAL,
  ],
  EN_ROUTE_TO_HOSPITAL: [
    EmergencyStatus.ARRIVED,
  ],
  ARRIVED: [],     // Terminal state
  CANCELLED: [],   // Terminal state
};

/**
 * Checks whether a transition from `currentStatus` to `newStatus` is valid.
 */
export function isValidTransition(
  currentStatus: EmergencyStatus,
  newStatus: EmergencyStatus
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed.includes(newStatus);
}
