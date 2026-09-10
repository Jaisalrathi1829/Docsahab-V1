import { Capability, ResourceType } from '../models/types';
import { HospitalProfile } from '../models/hospital-profile';
import { HospitalLiveStatus, FreshnessLevel, classifyFreshness } from '../models/hospital-live-status';
import {
  HospitalSnapshot,
  DerivedValues,
  EligibilityResult,
  CapabilityMatchResult,
  ResourceAvailabilityResult,
  ResourceAvailability,
  EligibilityReason,
} from '../models/hospital-snapshot';
import { EmergencyRequirement, RequiredCapability, RequiredResource } from '../models/emergency-requirement';
import { RankingConfiguration } from './configuration';

export interface SnapshotInputs {
  profile: HospitalProfile;
  liveStatus: HospitalLiveStatus;
  emergency: EmergencyRequirement;
  etaResult: ETAResult | null;
  now: Date;
  config: RankingConfiguration;
}

export interface ETAResult {
  distanceKm: number;
  etaSeconds: number;
  timestamp: Date;
  provider: string;
  metadata?: Record<string, unknown>;
}

/** A finite, non-negative number — the only kind we accept from an ETA provider. */
function isValidMeasure(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/**
 * Whether a department's availability is relevant to THIS emergency.
 *
 * The emergency department (ER) is the universal front door for every emergency
 * patient, so an unavailable ER always disqualifies a hospital. The trauma
 * department, by contrast, only matters when the emergency actually requires
 * TRAUMA capability — a cardiac case must not be excluded because an unrelated
 * trauma bay is down. (P1-4 fix.)
 */
function isDepartmentRelevant(
  department: 'EMERGENCY' | 'TRAUMA',
  requiredCapabilities: ReadonlyArray<RequiredCapability>
): boolean {
  if (department === 'EMERGENCY') return true;
  // TRAUMA department is relevant iff a TRAUMA capability is required.
  return requiredCapabilities.some((rc) => rc.capability.toString() === 'TRAUMA');
}

export function createHospitalSnapshot(inputs: SnapshotInputs): HospitalSnapshot {
  const { profile, liveStatus, emergency, etaResult, now, config } = inputs;
  const fp = config.freshnessPolicy;

  const freshnessAssessment = classifyFreshness(
    liveStatus.lastUpdated,
    now,
    fp.freshMs,
    fp.staleMs,
    fp.maxClockSkewMs
  );
  const freshness = freshnessAssessment.level;

  // Freshness policy: decide whether STALE degrades confidence, and how.
  const isStale = freshness === 'STALE';
  const usedStaleData = isStale && fp.staleBehavior !== 'EXCLUDE';
  const confidenceMultiplier =
    isStale && fp.staleBehavior === 'DEGRADE' ? fp.staleConfidenceMultiplier : 1;

  const capabilityMatch = evaluateCapabilityMatch(emergency.requiredCapabilities, profile.capabilities);

  const resourceAvailability = evaluateResourceAvailability(
    emergency.requiredResources,
    liveStatus.availableResources,
    liveStatus.capacityIndicators
  );

  const eligibility = evaluateEligibility(
    profile,
    liveStatus,
    emergency,
    etaResult,
    capabilityMatch,
    resourceAvailability,
    freshnessAssessment,
    config
  );

  const derived: DerivedValues = {
    distanceKm: etaResult && isValidMeasure(etaResult.distanceKm) ? etaResult.distanceKm : undefined,
    etaSeconds: etaResult && isValidMeasure(etaResult.etaSeconds) ? etaResult.etaSeconds : undefined,
    capabilityMatch,
    resourceAvailability,
    eligibility,
    usedStaleData,
    confidenceMultiplier,
  };

  return {
    hospitalId: profile.hospitalId,
    profile,
    liveStatus,
    freshness,
    snapshotAt: now,
    derived,
  };
}

function evaluateCapabilityMatch(
  requiredCapabilities: ReadonlyArray<RequiredCapability>,
  hospitalCapabilities: ReadonlySet<Capability>
): CapabilityMatchResult {
  const mandatoryMatched = new Set<Capability>();
  const mandatoryMissing = new Set<Capability>();
  const preferredMatched = new Set<Capability>();
  const preferredMissing = new Set<Capability>();

  for (const req of requiredCapabilities) {
    const hasCapability = hospitalCapabilities.has(req.capability);
    if (req.requirementLevel === 'MANDATORY') {
      if (hasCapability) mandatoryMatched.add(req.capability);
      else mandatoryMissing.add(req.capability);
    } else {
      if (hasCapability) preferredMatched.add(req.capability);
      else preferredMissing.add(req.capability);
    }
  }

  const totalRequired = requiredCapabilities.length;
  const totalMatched = mandatoryMatched.size + preferredMatched.size;
  const matchPercentage = totalRequired > 0 ? totalMatched / totalRequired : 1;

  return { mandatoryMatched, mandatoryMissing, preferredMatched, preferredMissing, matchPercentage };
}

function evaluateResourceAvailability(
  requiredResources: ReadonlyArray<RequiredResource>,
  availableResources: ReadonlyMap<ResourceType, number>,
  capacityIndicators: HospitalLiveStatus['capacityIndicators']
): ResourceAvailabilityResult {
  const resources = new Map<ResourceType, ResourceAvailability>();

  for (const req of requiredResources) {
    const raw = getAvailableResource(req.resourceType, availableResources, capacityIndicators);
    // A malformed resource count (NaN/negative/Infinity) is treated as 0 — the
    // safe direction: it cannot inflate a hospital's resource standing.
    const available = Number.isFinite(raw) && raw >= 0 ? raw : 0;
    const meetsRequirement = available >= req.minimumQuantity;
    const percentage = req.minimumQuantity > 0 ? Math.min(available / req.minimumQuantity, 1) : 1;
    resources.set(req.resourceType, { available, required: req.minimumQuantity, meetsRequirement, percentage });
  }

  let overallScore = 1;
  if (requiredResources.length > 0) {
    const scores = Array.from(resources.values()).map((r) => r.percentage);
    overallScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  return { resources, overallScore };
}

function getAvailableResource(
  resourceType: ResourceType,
  availableResources: ReadonlyMap<ResourceType, number>,
  capacityIndicators: HospitalLiveStatus['capacityIndicators']
): number {
  if (availableResources.has(resourceType)) return availableResources.get(resourceType)!;

  switch (resourceType.toString()) {
    case 'GENERAL_BEDS': return capacityIndicators.generalBedsAvailable;
    case 'ICU_BEDS': return capacityIndicators.icuBedsAvailable;
    case 'ER_AVAILABILITY': return capacityIndicators.erBaysAvailable;
    case 'TRAUMA_AVAILABILITY': return capacityIndicators.traumaBaysAvailable;
    case 'EMERGENCY_RESOURCES': return capacityIndicators.ventilatorsAvailable;
    default: return 0;
  }
}

function evaluateEligibility(
  profile: HospitalProfile,
  liveStatus: HospitalLiveStatus,
  emergency: EmergencyRequirement,
  etaResult: ETAResult | null,
  capabilityMatch: CapabilityMatchResult,
  resourceAvailability: ResourceAvailabilityResult,
  freshnessAssessment: { level: FreshnessLevel; ageMs: number; futureDated: boolean },
  config: RankingConfiguration
): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  // --- Capability (mandatory) ---
  if (config.capabilityPolicy.mandatoryMissingExcludes && capabilityMatch.mandatoryMissing.size > 0) {
    for (const cap of capabilityMatch.mandatoryMissing) {
      reasons.push({ type: 'MISSING_MANDATORY_CAPABILITY', capability: cap });
    }
  }

  // --- Operational / accepting ---
  if (liveStatus.operationalStatus !== 'OPERATIONAL') {
    reasons.push({ type: 'HOSPITAL_NOT_OPERATIONAL', status: liveStatus.operationalStatus });
  }
  if (!liveStatus.acceptingEmergencyPatients) {
    reasons.push({ type: 'NOT_ACCEPTING_EMERGENCY_PATIENTS' });
  }

  // --- Department availability, scoped to what the emergency needs (P1-4) ---
  if (
    liveStatus.emergencyDepartmentStatus === 'UNAVAILABLE' &&
    isDepartmentRelevant('EMERGENCY', emergency.requiredCapabilities)
  ) {
    reasons.push({ type: 'DEPARTMENT_UNAVAILABLE', department: 'EMERGENCY' });
  }
  if (
    liveStatus.traumaDepartmentStatus === 'UNAVAILABLE' &&
    isDepartmentRelevant('TRAUMA', emergency.requiredCapabilities)
  ) {
    reasons.push({ type: 'DEPARTMENT_UNAVAILABLE', department: 'TRAUMA' });
  }

  // --- Mandatory resources ---
  for (const [resourceType, availability] of resourceAvailability.resources) {
    const req = emergency.requiredResources.find((r) => r.resourceType === resourceType);
    if (req && req.requirementLevel === 'MANDATORY' && !availability.meetsRequirement) {
      reasons.push({
        type: 'MISSING_MANDATORY_RESOURCE',
        resource: resourceType,
        available: availability.available,
        required: req.minimumQuantity,
      });
    }
  }

  // --- ETA / distance (P1-6, P2-13) ---
  // A hospital we cannot compute a route to cannot be safely ranked: the
  // workflow's "Fresh ETA" step is mandatory. A null etaResult (provider failed
  // or returned nothing) excludes with ETA_UNAVAILABLE; malformed values
  // (NaN/negative/Infinity) exclude with INVALID_ETA_DATA. Neither is silently
  // scored as a favorable "instantly close" hospital.
  if (!etaResult) {
    reasons.push({ type: 'ETA_UNAVAILABLE' });
  } else {
    const etaValid = Number.isFinite(etaResult.etaSeconds) && etaResult.etaSeconds >= 0;
    const distValid = Number.isFinite(etaResult.distanceKm) && etaResult.distanceKm >= 0;
    if (!etaValid || !distValid) {
      reasons.push({
        type: 'INVALID_ETA_DATA',
        etaSeconds: etaResult.etaSeconds,
        distanceKm: etaResult.distanceKm,
      });
    } else {
      if (etaResult.etaSeconds > config.maxETASeconds) {
        reasons.push({ type: 'EXCESSIVE_ETA', etaSeconds: etaResult.etaSeconds, maxETASeconds: config.maxETASeconds });
      }
      if (etaResult.distanceKm > config.maxDistanceKm) {
        reasons.push({ type: 'OUTSIDE_GEOGRAPHIC_BOUNDS' });
      }
    }
  }

  // --- Geographic bounds constraint ---
  if (emergency.constraints.geographicBounds) {
    const b = emergency.constraints.geographicBounds;
    const loc = profile.location;
    if (loc.latitude < b.minLat || loc.latitude > b.maxLat || loc.longitude < b.minLng || loc.longitude > b.maxLng) {
      reasons.push({ type: 'OUTSIDE_GEOGRAPHIC_BOUNDS' });
    }
  }

  // --- Freshness (P1-5, P1-19) ---
  if (freshnessAssessment.futureDated) {
    reasons.push({ type: 'DATA_TIMESTAMP_IN_FUTURE', ageMs: freshnessAssessment.ageMs });
  }
  if (freshnessAssessment.level === 'EXPIRED') {
    reasons.push({ type: 'DATA_EXPIRED', freshness: 'EXPIRED' });
  }
  if (freshnessAssessment.level === 'STALE' && config.freshnessPolicy.staleBehavior === 'EXCLUDE') {
    reasons.push({ type: 'DATA_STALE', freshness: 'STALE' });
  }

  // --- Explicit exclusion ---
  if (emergency.constraints.excludedHospitalIds?.includes(profile.hospitalId)) {
    reasons.push({ type: 'EXPLICITLY_EXCLUDED' });
  }

  return { eligible: reasons.length === 0, reasons };
}
