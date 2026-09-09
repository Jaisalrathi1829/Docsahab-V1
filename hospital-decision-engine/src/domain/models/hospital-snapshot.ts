import { HospitalId, Capability, ResourceType } from './types';
import { HospitalProfile } from './hospital-profile';
import { HospitalLiveStatus, FreshnessLevel } from './hospital-live-status';
import { Coordinates } from './hospital-profile';

export interface HospitalSnapshot {
  hospitalId: HospitalId;
  profile: HospitalProfile;
  liveStatus: HospitalLiveStatus;
  freshness: FreshnessLevel;
  snapshotAt: Date;
  derived: DerivedValues;
}

export interface DerivedValues {
  distanceKm?: number;
  etaSeconds?: number;
  capabilityMatch: CapabilityMatchResult;
  resourceAvailability: ResourceAvailabilityResult;
  eligibility: EligibilityResult;
}

export interface CapabilityMatchResult {
  mandatoryMatched: ReadonlySet<Capability>;
  mandatoryMissing: ReadonlySet<Capability>;
  preferredMatched: ReadonlySet<Capability>;
  preferredMissing: ReadonlySet<Capability>;
  matchPercentage: number;
}

export interface ResourceAvailabilityResult {
  resources: ReadonlyMap<ResourceType, ResourceAvailability>;
  overallScore: number;
}

export interface ResourceAvailability {
  available: number;
  required: number;
  meetsRequirement: boolean;
  percentage: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

export type EligibilityReason =
  | { type: 'MISSING_MANDATORY_CAPABILITY'; capability: Capability }
  | { type: 'HOSPITAL_NOT_OPERATIONAL'; status: string }
  | { type: 'NOT_ACCEPTING_EMERGENCY_PATIENTS' }
  | { type: 'MISSING_MANDATORY_RESOURCE'; resource: ResourceType; available: number; required: number }
  | { type: 'EXCESSIVE_ETA'; etaSeconds: number; maxETASeconds: number }
  | { type: 'OUTSIDE_GEOGRAPHIC_BOUNDS' }
  | { type: 'DATA_EXPIRED'; freshness: FreshnessLevel }
  | { type: 'EXPLICITLY_EXCLUDED' }
  | { type: 'DEPARTMENT_UNAVAILABLE'; department: string };

export function createHospitalSnapshot(
  profile: HospitalProfile,
  liveStatus: HospitalLiveStatus,
  freshness: FreshnessLevel,
  derived: DerivedValues
): HospitalSnapshot {
  return {
    hospitalId: profile.hospitalId,
    profile,
    liveStatus,
    freshness,
    snapshotAt: new Date(),
    derived,
  };
}