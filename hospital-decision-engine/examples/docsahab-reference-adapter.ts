// ============================================================================
// REFERENCE Docsahab adapters — STANDALONE, not wired into the main app.
// ============================================================================
// These show how Docsahab data SHAPES map onto the engine's provider contracts.
// They are illustrative reference code for the future integration task; they do
// NOT import Prisma and are NOT connected to the running backend.
//
// CRITICAL HONESTY MARKER:
//   Fields the current Docsahab `Hospital` table genuinely has are marked REAL.
//   Fields the engine needs that Docsahab does NOT yet store are marked
//   SIMULATED — they are fabricated here purely so the pipeline can run. A real
//   integration MUST source these from a new HospitalLiveStatus table (see the
//   integration guide's migration spec); fabricating them in production would
//   defeat the entire freshness model.
// ============================================================================

import {
  HospitalProfile,
  HospitalLiveStatus,
  HospitalProfileProvider,
  HospitalLiveStatusProvider,
  ETAProvider,
  ETAResult,
  Coordinates,
  createHospitalProfile,
  createHospitalLiveStatus,
  createHospitalId,
  createEmergencyId,
  createCapability,
  CommonCapabilities,
  CommonResources,
  EmergencyRequirement,
  createEmergencyRequirement,
  EmergencyRequirementContext,
  HospitalId,
} from '../src/index';

// ── Shape of the CURRENT Docsahab Prisma `Hospital` row (REAL fields only) ──
export interface DocsahabHospitalRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  hasICU: boolean;
  hasTraumaCare: boolean;
  hasCardiology: boolean;
  availableBeds: number;
}

// ── Shape of a FUTURE Docsahab `HospitalLiveStatus` row (does not exist yet) ──
export interface DocsahabHospitalLiveRow {
  hospitalId: string;
  acceptingEmergencyPatients: boolean;
  operationalStatus: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';
  emergencyDepartmentStatus: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
  traumaDepartmentStatus: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'UNKNOWN';
  icuBedsAvailable: number;
  generalBedsAvailable: number;
  erBaysAvailable: number;
  traumaBaysAvailable: number;
  ventilatorsAvailable: number;
  lastUpdated: Date;
  dataSource: string;
}

export const FIELD_PROVENANCE = {
  REAL_FROM_HOSPITAL_TABLE: ['id', 'name', 'latitude', 'longitude', 'hasICU', 'hasTraumaCare', 'hasCardiology', 'availableBeds'],
  SIMULATED_UNTIL_MIGRATION: [
    'operationalStatus', 'emergencyDepartmentStatus', 'traumaDepartmentStatus',
    'icuBedsAvailable', 'generalBedsAvailable', 'erBaysAvailable', 'traumaBaysAvailable',
    'ventilatorsAvailable', 'lastUpdated', 'dataSource', 'acceptingEmergencyPatients',
  ],
} as const;

/** REAL: maps the current 3-boolean capability model into the engine's capability set. */
export function mapCapabilities(row: DocsahabHospitalRow): Set<ReturnType<typeof createCapability>> {
  const caps = new Set<ReturnType<typeof createCapability>>();
  if (row.hasCardiology) caps.add(CommonCapabilities.CARDIAC_EMERGENCY);
  if (row.hasTraumaCare) caps.add(CommonCapabilities.TRAUMA);
  // NOTE: NEUROLOGICAL/PEDIATRIC/OBSTETRIC/BURN/TOXICOLOGY/ISOLATION have NO
  // column in the current Hospital table — they are UNREPRESENTABLE today.
  return caps;
}

export function toHospitalProfile(row: DocsahabHospitalRow): HospitalProfile {
  return createHospitalProfile({
    hospitalId: createHospitalId(row.id),
    name: row.name,
    location: { latitude: row.latitude, longitude: row.longitude }, // REAL
    capabilities: mapCapabilities(row), // REAL (partial — see note)
    services: new Set(),
    contactInfo: { phone: 'UNKNOWN', address: 'UNKNOWN' }, // SIMULATED (no column)
  });
}

/**
 * SIMULATED live status. In production this whole function is replaced by a
 * read from the new HospitalLiveStatus table. Here we synthesize a "reasonable"
 * live record from the one REAL live-ish field Docsahab has (availableBeds).
 */
export function toSimulatedLiveStatus(row: DocsahabHospitalRow, now: Date): HospitalLiveStatus {
  return createHospitalLiveStatus({
    hospitalId: createHospitalId(row.id),
    acceptingEmergencyPatients: row.availableBeds > 0, // derived from REAL availableBeds
    operationalStatus: 'OPERATIONAL', // SIMULATED
    emergencyDepartmentStatus: 'AVAILABLE', // SIMULATED
    traumaDepartmentStatus: row.hasTraumaCare ? 'AVAILABLE' : 'UNKNOWN', // SIMULATED
    availableResources: new Map([
      [CommonResources.GENERAL_BEDS, row.availableBeds], // REAL bed count
      [CommonResources.ICU_BEDS, row.hasICU ? Math.max(1, Math.floor(row.availableBeds / 4)) : 0], // SIMULATED split
    ]),
    currentERLoad: 'UNKNOWN',
    currentTraumaLoad: 'UNKNOWN',
    capacityIndicators: {
      generalBedsAvailable: row.availableBeds, // REAL
      icuBedsAvailable: row.hasICU ? Math.max(1, Math.floor(row.availableBeds / 4)) : 0, // SIMULATED
      erBaysAvailable: row.availableBeds, // SIMULATED
      traumaBaysAvailable: row.hasTraumaCare ? row.availableBeds : 0, // SIMULATED
      ventilatorsAvailable: 0, // SIMULATED
      bloodProductsAvailable: true, // SIMULATED
    },
    dataSource: 'SIMULATED_FROM_HOSPITAL_ROW', // marks the fabrication explicitly
    lastUpdated: now, // SIMULATED — no real freshness signal exists yet
  });
}

/** REAL live status once the migration exists — a faithful 1:1 map. */
export function toLiveStatus(row: DocsahabHospitalLiveRow): HospitalLiveStatus {
  return createHospitalLiveStatus({
    hospitalId: createHospitalId(row.hospitalId),
    acceptingEmergencyPatients: row.acceptingEmergencyPatients,
    operationalStatus: row.operationalStatus,
    emergencyDepartmentStatus: row.emergencyDepartmentStatus,
    traumaDepartmentStatus: row.traumaDepartmentStatus,
    availableResources: new Map([
      [CommonResources.GENERAL_BEDS, row.generalBedsAvailable],
      [CommonResources.ICU_BEDS, row.icuBedsAvailable],
    ]),
    currentERLoad: 'UNKNOWN',
    currentTraumaLoad: 'UNKNOWN',
    capacityIndicators: {
      generalBedsAvailable: row.generalBedsAvailable,
      icuBedsAvailable: row.icuBedsAvailable,
      erBaysAvailable: row.erBaysAvailable,
      traumaBaysAvailable: row.traumaBaysAvailable,
      ventilatorsAvailable: row.ventilatorsAvailable,
      bloodProductsAvailable: true,
    },
    dataSource: row.dataSource,
    lastUpdated: row.lastUpdated,
  });
}

// ── Provider adapters over an array of Docsahab rows ────────────────────────
export class DocsahabProfileProvider implements HospitalProfileProvider {
  constructor(private readonly rows: DocsahabHospitalRow[]) {}
  async getHospitalProfile(id: HospitalId): Promise<HospitalProfile | null> {
    const row = this.rows.find((r) => r.id === id.toString());
    return row ? toHospitalProfile(row) : null;
  }
  async getAllHospitalProfiles() {
    const m = new Map<HospitalId, HospitalProfile>();
    for (const r of this.rows) m.set(createHospitalId(r.id), toHospitalProfile(r));
    return m;
  }
}

export class DocsahabSimulatedLiveProvider implements HospitalLiveStatusProvider {
  constructor(private readonly rows: DocsahabHospitalRow[], private readonly now: Date) {}
  async getHospitalLiveStatus(id: HospitalId): Promise<HospitalLiveStatus | null> {
    const row = this.rows.find((r) => r.id === id.toString());
    return row ? toSimulatedLiveStatus(row, this.now) : null;
  }
  async getAllHospitalLiveStatuses() {
    const m = new Map<HospitalId, HospitalLiveStatus>();
    for (const r of this.rows) m.set(createHospitalId(r.id), toSimulatedLiveStatus(r, this.now));
    return m;
  }
  async updateHospitalLiveStatus() { /* no-op in the reference adapter */ }
}

/** Adapts Docsahab's existing haversine navigation (km/min) → engine ETAResult (km/seconds). */
export class DocsahabNavigationETAProvider implements ETAProvider {
  constructor(private readonly averageSpeedKmph = 40) {}
  async calculateETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult> {
    const distanceKm = haversine(origin, destination);
    const etaSeconds = Math.round((distanceKm / this.averageSpeedKmph) * 3600);
    return { distanceKm, etaSeconds, timestamp: new Date(), provider: 'DocsahabNavigationETAProvider' };
  }
}

/**
 * Reference requirement derivation (Docsahab's job). Deterministic keyword map
 * from a probable-emergency string → engine capabilities. NO AI, NO allergy use.
 */
export function deriveRequirement(ctx: EmergencyRequirementContext): EmergencyRequirement {
  const text = ctx.probableEmergencyType.toLowerCase();
  const caps: Array<{ capability: ReturnType<typeof createCapability>; requirementLevel: 'MANDATORY' | 'PREFERRED' }> = [];
  const add = (c: ReturnType<typeof createCapability>) => caps.push({ capability: c, requirementLevel: 'MANDATORY' });
  if (/cardiac|heart|chest pain|mi\b/.test(text)) add(CommonCapabilities.CARDIAC_EMERGENCY);
  if (/stroke|seizure|neuro/.test(text)) add(CommonCapabilities.NEUROLOGICAL_EMERGENCY);
  if (/trauma|accident|rta|injur|fracture|fall/.test(text)) add(CommonCapabilities.TRAUMA);
  if (/burn/.test(text)) add(CommonCapabilities.BURN_UNIT);
  if (/pois|toxic|overdose/.test(text)) add(CommonCapabilities.TOXICOLOGY);
  if (/pediatric|child|infant/.test(text)) add(CommonCapabilities.PEDIATRIC_EMERGENCY);
  if (/obstetric|pregnan|labou?r|delivery/.test(text)) add(CommonCapabilities.OBSTETRIC_EMERGENCY);

  return createEmergencyRequirement({
    emergencyId: createEmergencyId(ctx.emergencyId),
    probableEmergencyType: ctx.probableEmergencyType,
    requiredCapabilities: caps,
    requiredResources: ctx.severity === 'CRITICAL'
      ? [{ resourceType: CommonResources.ICU_BEDS, minimumQuantity: 1, requirementLevel: 'MANDATORY' }]
      : [],
    severity: ctx.severity,
    patientLocation: ctx.patientLocation,
    ambulanceLocation: ctx.ambulanceLocation,
  });
}

function haversine(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
