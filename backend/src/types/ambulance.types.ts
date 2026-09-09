// ============================================================================
// Ambulance Matching — TypeScript Types
// ============================================================================
// Shared contracts for the Ambulance Matching module (Person 2).
// Reuses the Prisma-generated Ambulance type — no duplicate model definitions.
// ============================================================================

import type { Ambulance } from "@prisma/client";

/**
 * Result of the pure nearest-ambulance selection step.
 */
export interface NearestAmbulanceSelection {
  ambulance: Ambulance;
  distanceKm: number;
}

/**
 * Payload emitted on the `ambulanceAssigned` event (for the Realtime module).
 */
export interface AmbulanceAssignedEvent {
  emergencyId: string;
  ambulanceId: string;
  vehicleNo: string;
  distanceKm: number;
  etaMinutes: number;
  emergency: unknown; // full included emergency (shape owned by emergency layer)
}

/**
 * Payload emitted on the `etaUpdated` event.
 */
export interface EtaUpdatedEvent {
  emergencyId: string;
  etaMinutes: number;
  previousEtaMinutes: number | null;
}
