export type HospitalId = string & { readonly __brand: unique symbol };
export type EmergencyId = string & { readonly __brand: unique symbol };
export type CandidateId = string & { readonly __brand: unique symbol };

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function createHospitalId(id: string): HospitalId {
  return id as HospitalId;
}

export function createEmergencyId(id: string): EmergencyId {
  return id as EmergencyId;
}

export function createCandidateId(id: string): CandidateId {
  return id as CandidateId;
}

export type Capability = string & { readonly __brand: unique symbol };
export type ResourceType = string & { readonly __brand: unique symbol };

export function createCapability(cap: string): Capability {
  return cap as Capability;
}

export function createResourceType(res: string): ResourceType {
  return res as ResourceType;
}

export const CommonCapabilities = {
  CARDIAC_EMERGENCY: createCapability('CARDIAC_EMERGENCY'),
  TRAUMA: createCapability('TRAUMA'),
  NEUROLOGICAL_EMERGENCY: createCapability('NEUROLOGICAL_EMERGENCY'),
  PEDIATRIC_EMERGENCY: createCapability('PEDIATRIC_EMERGENCY'),
  OBSTETRIC_EMERGENCY: createCapability('OBSTETRIC_EMERGENCY'),
  BURN_UNIT: createCapability('BURN_UNIT'),
  TOXICOLOGY: createCapability('TOXICOLOGY'),
  ISOLATION: createCapability('ISOLATION'),
} as const;

export const CommonResources = {
  GENERAL_BEDS: createResourceType('GENERAL_BEDS'),
  ICU_BEDS: createResourceType('ICU_BEDS'),
  ER_AVAILABILITY: createResourceType('ER_AVAILABILITY'),
  TRAUMA_AVAILABILITY: createResourceType('TRAUMA_AVAILABILITY'),
  EMERGENCY_RESOURCES: createResourceType('EMERGENCY_RESOURCES'),
} as const;