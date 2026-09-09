import { EmergencyId, HospitalId, Capability, ResourceType, Coordinates } from './types';

export interface EmergencyRequirement {
  emergencyId: EmergencyId;
  probableEmergencyType: string;
  requiredCapabilities: RequiredCapability[];
  requiredResources: RequiredResource[];
  severity: EmergencySeverity;
  patientLocation: Coordinates;
  ambulanceLocation: Coordinates;
  constraints: EmergencyConstraints;
  createdAt: Date;
}

export interface RequiredCapability {
  capability: Capability;
  requirementLevel: RequirementLevel;
}

export type RequirementLevel = 'MANDATORY' | 'PREFERRED';

export interface RequiredResource {
  resourceType: ResourceType;
  minimumQuantity: number;
  requirementLevel: RequirementLevel;
}

export type EmergencySeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export interface EmergencyConstraints {
  maxETASeconds?: number;
  maxDistanceKm?: number;
  geographicBounds?: GeographicBounds;
  excludedHospitalIds?: HospitalId[];
}

export interface GeographicBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function createEmergencyRequirement(data: {
  emergencyId: EmergencyId;
  probableEmergencyType: string;
  requiredCapabilities: RequiredCapability[];
  requiredResources: RequiredResource[];
  severity: EmergencySeverity;
  patientLocation: Coordinates;
  ambulanceLocation: Coordinates;
  constraints?: Partial<EmergencyConstraints>;
}): EmergencyRequirement {
  return {
    ...data,
    constraints: {
      maxETASeconds: data.constraints?.maxETASeconds ?? 1800,
      maxDistanceKm: data.constraints?.maxDistanceKm ?? 50,
      geographicBounds: data.constraints?.geographicBounds,
      excludedHospitalIds: data.constraints?.excludedHospitalIds ?? [],
    },
    createdAt: new Date(),
  };
}
