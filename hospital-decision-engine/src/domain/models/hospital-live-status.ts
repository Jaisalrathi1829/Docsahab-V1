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

export type FreshnessLevel = 'FRESH' | 'STALE' | 'EXPIRED';

export interface FreshnessAssessment {
  level: FreshnessLevel;
  ageMs: number;
  /** True when lastUpdated is further in the future than the allowed skew. */
  futureDated: boolean;
}

/**
 * Classifies a live-status record's freshness, clock-skew aware.
 *
 *   ageMs < -maxClockSkewMs   → EXPIRED, futureDated=true  (untrustworthy clock)
 *   -maxClockSkewMs..freshMs  → FRESH
 *   freshMs..staleMs          → STALE
 *   > staleMs                 → EXPIRED
 *
 * A record dated further in the future than the tolerated skew is treated as
 * EXPIRED rather than FRESH: a future timestamp means a broken/malicious clock,
 * and trusting it would let stale data masquerade as current indefinitely.
 */
export function classifyFreshness(
  lastUpdated: Date,
  now: Date,
  freshThresholdMs: number,
  staleThresholdMs: number,
  maxClockSkewMs = 0
): FreshnessAssessment {
  const ageMs = now.getTime() - lastUpdated.getTime();

  if (ageMs < -maxClockSkewMs) {
    return { level: 'EXPIRED', ageMs, futureDated: true };
  }
  if (ageMs <= freshThresholdMs) return { level: 'FRESH', ageMs, futureDated: false };
  if (ageMs <= staleThresholdMs) return { level: 'STALE', ageMs, futureDated: false };
  return { level: 'EXPIRED', ageMs, futureDated: false };
}

/**
 * @deprecated Retained for backward compatibility; prefer classifyFreshness,
 * which is clock-skew aware. This wrapper treats any future timestamp as FRESH
 * (the old, unsafe behavior) and is no longer used by the ranking engine.
 */
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
