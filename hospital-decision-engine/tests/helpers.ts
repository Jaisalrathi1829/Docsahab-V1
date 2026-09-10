import {
  RankedHospital,
  HospitalId,
  createHospitalId,
  createEmergencyId,
  EmergencyId,
  createHospitalProfile,
  createHospitalLiveStatus,
  HospitalProfile,
  HospitalLiveStatus,
  CommonCapabilities,
  CommonResources,
  Capability,
  ResourceType,
} from '../src/index';

/** Minimal synthetic RankedHospital for selection tests (rank + score only matter). */
export function rankedHospital(id: string, rank: number, finalScore: number): RankedHospital {
  return {
    hospitalId: createHospitalId(id),
    rank,
    finalScore,
    factorScores: { capabilityScore: finalScore, etaScore: finalScore, resourceScore: finalScore },
    normalizedFactors: { capability: finalScore, eta: finalScore, resource: finalScore },
    distanceKm: 5,
    etaSeconds: 300,
    eligibility: { eligible: true, reasons: [] },
    freshness: 'FRESH',
    usedStaleData: false,
    confidenceMultiplier: 1,
    lastUpdated: new Date('2026-09-10T10:00:00Z'),
    snapshotAt: new Date('2026-09-10T10:00:00Z'),
    capabilityMatch: { matchPercentage: 1, mandatoryMatched: 1, mandatoryMissing: 0, preferredMatched: 0, preferredMissing: 0 },
    resourceAvailability: { overallScore: 1, resources: [] },
    rankingReasons: [],
  };
}

/** A 4-hospital ranked list A(#1) B(#2) C(#3) D(#4) for the mandatory scenario. */
export function abcdRanked(): { A: RankedHospital; B: RankedHospital; C: RankedHospital; D: RankedHospital; list: RankedHospital[] } {
  const A = rankedHospital('H-A', 1, 0.9);
  const B = rankedHospital('H-B', 2, 0.8);
  const C = rankedHospital('H-C', 3, 0.7);
  const D = rankedHospital('H-D', 4, 0.6);
  return { A, B, C, D, list: [A, B, C, D] };
}

export function emergencyId(id: string): EmergencyId {
  return createEmergencyId(id);
}

export function hospitalId(id: string): HospitalId {
  return createHospitalId(id);
}

export interface HospitalSpec {
  id: string;
  lat?: number;
  lng?: number;
  capabilities?: Capability[];
  accepting?: boolean;
  operational?: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';
  emergencyDept?: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
  traumaDept?: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
  resources?: Array<[ResourceType, number]>;
  beds?: { general?: number; icu?: number; er?: number; trauma?: number; ventilators?: number };
  lastUpdated?: Date;
}

/** Builds a fully-controllable (profile, liveStatus) pair for a hospital. */
export function buildHospital(spec: HospitalSpec, baseTime: Date): { profile: HospitalProfile; status: HospitalLiveStatus } {
  const profile = createHospitalProfile({
    hospitalId: createHospitalId(spec.id),
    name: spec.id,
    location: { latitude: spec.lat ?? 28.61, longitude: spec.lng ?? 77.20 },
    capabilities: new Set(spec.capabilities ?? [CommonCapabilities.TRAUMA, CommonCapabilities.CARDIAC_EMERGENCY]),
    services: new Set(['ER']),
    contactInfo: { phone: '+91-00-0000', address: 'addr' },
  });
  const status = createHospitalLiveStatus({
    hospitalId: createHospitalId(spec.id),
    acceptingEmergencyPatients: spec.accepting ?? true,
    operationalStatus: spec.operational ?? 'OPERATIONAL',
    emergencyDepartmentStatus: spec.emergencyDept ?? 'AVAILABLE',
    traumaDepartmentStatus: spec.traumaDept ?? 'AVAILABLE',
    // Default to an EMPTY explicit-resource map so resource lookups fall back to
    // capacityIndicators (the `beds` spec). Tests that want an explicit map pass one.
    availableResources: new Map(spec.resources ?? []),
    currentERLoad: 'LOW',
    currentTraumaLoad: 'LOW',
    capacityIndicators: {
      generalBedsAvailable: spec.beds?.general ?? 20,
      icuBedsAvailable: spec.beds?.icu ?? 8,
      erBaysAvailable: spec.beds?.er ?? 10,
      traumaBaysAvailable: spec.beds?.trauma ?? 6,
      ventilatorsAvailable: spec.beds?.ventilators ?? 5,
      bloodProductsAvailable: true,
    },
    dataSource: 'TEST',
    lastUpdated: spec.lastUpdated ?? baseTime,
  });
  return { profile, status };
}
