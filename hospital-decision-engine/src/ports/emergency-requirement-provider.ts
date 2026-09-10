// ============================================================================
// EmergencyRequirementProvider — requirement-derivation boundary
// ============================================================================
// The engine is clinically agnostic: it consumes an EmergencyRequirement and
// never diagnoses. Turning Docsahab's clinical signals (probableEmergency,
// patient conditions, severity, ambulance location) into the engine's capability
// vocabulary is an INTEGRATION concern that belongs to Docsahab, expressed here
// as a port so the boundary is explicit and testable.
//
// The deterministic mapping Docsahab must implement is documented in the
// integration guide ("Requirement Derivation Boundary"). Allergy / critical-alert
// information is intentionally NOT a ranking input — it is a clinical alert
// surfaced to responders, per the current product behavior.
// ============================================================================

import { EmergencyRequirement } from '../domain/models/emergency-requirement';
import { Coordinates } from '../domain/models/types';

export interface EmergencyRequirementContext {
  emergencyId: string;
  /** Free-text probable emergency (Docsahab's deterministic clinical derivation output). */
  probableEmergencyType: string;
  /** Structured patient conditions, if available. */
  patientConditions?: ReadonlyArray<string>;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  patientLocation: Coordinates;
  ambulanceLocation: Coordinates;
}

export interface EmergencyRequirementProvider {
  deriveRequirement(context: EmergencyRequirementContext): Promise<EmergencyRequirement> | EmergencyRequirement;
}
