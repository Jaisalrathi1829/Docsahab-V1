import { HospitalId, Capability, ResourceType, Coordinates } from '../models/types';
import { HospitalProfile } from '../models/hospital-profile';
import { HospitalLiveStatus, FreshnessLevel, isStatusFresh } from '../models/hospital-live-status';
import { HospitalSnapshot, DerivedValues, EligibilityResult, CapabilityMatchResult, ResourceAvailabilityResult, ResourceAvailability, EligibilityReason } from '../models/hospital-snapshot';
import { EmergencyRequirement, RequiredCapability, RequiredResource } from '../models/emergency-requirement';
import { RankingConfiguration, DEFAULT_RANKING_CONFIGURATION, validateConfiguration } from './configuration';

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

export function createHospitalSnapshot(inputs: SnapshotInputs): HospitalSnapshot {
  const { profile, liveStatus, emergency, etaResult, now, config } = inputs;

  const freshness = isStatusFresh(liveStatus, now, config.freshnessThresholds.freshMs, config.freshnessThresholds.staleMs);
  
  const capabilityMatch = evaluateCapabilityMatch(
    emergency.requiredCapabilities,
    profile.capabilities,
    liveStatus,
    config
  );

  const resourceAvailability = evaluateResourceAvailability(
    emergency.requiredResources,
    liveStatus.availableResources,
    liveStatus.capacityIndicators,
    config
  );

  const eligibility = evaluateEligibility(
    profile,
    liveStatus,
    emergency,
    etaResult,
    capabilityMatch,
    resourceAvailability,
    freshness,
    config,
    now
  );

  const derived: DerivedValues = {
    distanceKm: etaResult?.distanceKm,
    etaSeconds: etaResult?.etaSeconds,
    capabilityMatch,
    resourceAvailability,
    eligibility,
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
  hospitalCapabilities: ReadonlySet<Capability>,
  liveStatus: HospitalLiveStatus,
  config: RankingConfiguration
): CapabilityMatchResult {
  const mandatoryMatched = new Set<Capability>();
  const mandatoryMissing = new Set<Capability>();
  const preferredMatched = new Set<Capability>();
  const preferredMissing = new Set<Capability>();

  for (const req of requiredCapabilities) {
    const hasCapability = hospitalCapabilities.has(req.capability);
    
    if (req.requirementLevel === 'MANDATORY') {
      if (hasCapability) {
        mandatoryMatched.add(req.capability);
      } else {
        mandatoryMissing.add(req.capability);
      }
    } else {
      if (hasCapability) {
        preferredMatched.add(req.capability);
      } else {
        preferredMissing.add(req.capability);
      }
    }
  }

  const totalRequired = requiredCapabilities.length;
  const totalMatched = mandatoryMatched.size + preferredMatched.size;
  const matchPercentage = totalRequired > 0 ? totalMatched / totalRequired : 1;

  return {
    mandatoryMatched,
    mandatoryMissing,
    preferredMatched,
    preferredMissing,
    matchPercentage,
  };
}

function evaluateResourceAvailability(
  requiredResources: ReadonlyArray<RequiredResource>,
  availableResources: ReadonlyMap<ResourceType, number>,
  capacityIndicators: HospitalLiveStatus['capacityIndicators'],
  config: RankingConfiguration
): ResourceAvailabilityResult {
  const resources = new Map<ResourceType, ResourceAvailability>();

  for (const req of requiredResources) {
    const available = getAvailableResource(req.resourceType, availableResources, capacityIndicators);
    const meetsRequirement = available >= req.minimumQuantity;
    const percentage = req.minimumQuantity > 0 ? Math.min(available / req.minimumQuantity, 1) : 1;

    resources.set(req.resourceType, {
      available,
      required: req.minimumQuantity,
      meetsRequirement,
      percentage,
    });
  }

  let overallScore = 1;
  if (requiredResources.length > 0) {
    const scores = Array.from(resources.values()).map(r => r.percentage);
    overallScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }

  return {
    resources,
    overallScore,
  };
}

function getAvailableResource(
  resourceType: ResourceType,
  availableResources: ReadonlyMap<ResourceType, number>,
  capacityIndicators: HospitalLiveStatus['capacityIndicators']
): number {
  if (availableResources.has(resourceType)) {
    return availableResources.get(resourceType)!;
  }

  const key = resourceType.toString();
  switch (key) {
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
  freshness: FreshnessLevel,
  config: RankingConfiguration,
  now: Date
): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  if (config.capabilityPolicy.mandatoryMissingExcludes && capabilityMatch.mandatoryMissing.size > 0) {
    for (const cap of capabilityMatch.mandatoryMissing) {
      reasons.push({ type: 'MISSING_MANDATORY_CAPABILITY', capability: cap });
    }
  }

  if (liveStatus.operationalStatus !== 'OPERATIONAL') {
    reasons.push({ type: 'HOSPITAL_NOT_OPERATIONAL', status: liveStatus.operationalStatus });
  }

  if (!liveStatus.acceptingEmergencyPatients) {
    reasons.push({ type: 'NOT_ACCEPTING_EMERGENCY_PATIENTS' });
  }

  if (liveStatus.emergencyDepartmentStatus === 'UNAVAILABLE') {
    reasons.push({ type: 'DEPARTMENT_UNAVAILABLE', department: 'EMERGENCY' });
  }

  if (liveStatus.traumaDepartmentStatus === 'UNAVAILABLE') {
    reasons.push({ type: 'DEPARTMENT_UNAVAILABLE', department: 'TRAUMA' });
  }

  for (const [resourceType, availability] of resourceAvailability.resources) {
    const req = emergency.requiredResources.find(r => r.resourceType === resourceType);
    if (req && req.requirementLevel === 'MANDATORY' && !availability.meetsRequirement) {
      reasons.push({
        type: 'MISSING_MANDATORY_RESOURCE',
        resource: resourceType,
        available: availability.available,
        required: req.minimumQuantity,
      });
    }
  }

  if (etaResult) {
    if (etaResult.etaSeconds > config.maxETASeconds) {
      reasons.push({ type: 'EXCESSIVE_ETA', etaSeconds: etaResult.etaSeconds, maxETASeconds: config.maxETASeconds });
    }
    if (etaResult.distanceKm > config.maxDistanceKm) {
      reasons.push({ type: 'OUTSIDE_GEOGRAPHIC_BOUNDS' });
    }
  }

  if (emergency.constraints.geographicBounds) {
    const bounds = emergency.constraints.geographicBounds;
    const loc = profile.location;
    if (loc.latitude < bounds.minLat || loc.latitude > bounds.maxLat ||
        loc.longitude < bounds.minLng || loc.longitude > bounds.maxLng) {
      reasons.push({ type: 'OUTSIDE_GEOGRAPHIC_BOUNDS' });
    }
  }

  if (freshness === 'EXPIRED') {
    reasons.push({ type: 'DATA_EXPIRED', freshness });
  }

  if (emergency.constraints.excludedHospitalIds?.includes(profile.hospitalId)) {
    reasons.push({ type: 'EXPLICITLY_EXCLUDED' });
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}