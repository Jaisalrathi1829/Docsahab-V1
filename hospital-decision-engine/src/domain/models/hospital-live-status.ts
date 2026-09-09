import { HospitalId, ResourceType } from './types';

export interface HospitalLiveStatus {
  hospitalId: HospitalId;
  acceptingEmergencyPatients: boolean;
  operationalStatus: OperationalStatus;
  emergencyDepartmentStatus: DepartmentStatus;
  traumaDepartmentStatus: DepartmentStatus;
  availableResources: ReadonlyMap<ResourceType, number>;
  currentERLoad: LoadLevel;
  currentTraumaLoad: LoadLevel;
  capacityIndicators: CapacityIndicators;
  lastUpdated: Date;
  dataSource: string;
}

export type OperationalStatus = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';
export type DepartmentStatus = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
export type LoadLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export interface CapacityIndicators {
  generalBedsAvailable: number;
  icuBedsAvailable: number;
  erBaysAvailable: number;
  traumaBaysAvailable: number;
  ventilatorsAvailable: number;
  bloodProductsAvailable: boolean;
}

export interface HospitalLiveStatusSnapshot {
  status: HospitalLiveStatus;
  snapshotAt: Date;
}

export function createHospitalLiveStatus(data: {
  hospitalId: HospitalId;
  acceptingEmergencyPatients: boolean;
  operationalStatus: OperationalStatus;
  emergencyDepartmentStatus: DepartmentStatus;
  traumaDepartmentStatus: DepartmentStatus;
  availableResources: ReadonlyMap<ResourceType, number>;
  currentERLoad: LoadLevel;
  currentTraumaLoad: LoadLevel;
  capacityIndicators: CapacityIndicators;
  dataSource: string;
  lastUpdated?: Date;
}): HospitalLiveStatus {
  return {
    ...data,
    lastUpdated: data.lastUpdated ?? new Date(),
  };
}

export function isStatusFresh(
  status: HospitalLiveStatus,
  now: Date,
  freshThresholdMs: number,
  staleThresholdMs: number
): FreshnessLevel {
  const ageMs = now.getTime() - status.lastUpdated.getTime();
  if (ageMs <= freshThresholdMs) return 'FRESH';
  if (ageMs <= staleThresholdMs) return 'STALE';
  return 'EXPIRED';
}

export type FreshnessLevel = 'FRESH' | 'STALE' | 'EXPIRED';
