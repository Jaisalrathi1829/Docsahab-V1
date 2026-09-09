export interface RankingConfiguration {
  capabilityWeight: number;
  etaWeight: number;
  resourceWeight: number;
  freshnessThresholds: FreshnessThresholds;
  maxETASeconds: number;
  maxDistanceKm: number;
  topN: number;
  tieBreakPolicy: TieBreakPolicy;
  capabilityPolicy: CapabilityPolicy;
  resourcePolicy: ResourcePolicy;
  configurationVersion: string;
}

export interface FreshnessThresholds {
  freshMs: number;
  staleMs: number;
}

export interface TieBreakPolicy {
  strategy: 'CAPABILITY_THEN_ETA_THEN_RESOURCE_THEN_ID';
}

export interface CapabilityPolicy {
  mandatoryMissingExcludes: boolean;
  preferredMissingScorePenalty: number;
}

export interface ResourcePolicy {
  normalizationStrategy: 'LINEAR' | 'STEP';
  minimumThresholdForEligibility: number;
}

export const DEFAULT_RANKING_CONFIGURATION: RankingConfiguration = {
  capabilityWeight: 0.50,
  etaWeight: 0.30,
  resourceWeight: 0.20,
  freshnessThresholds: {
    freshMs: 5 * 60 * 1000,
    staleMs: 15 * 60 * 1000,
  },
  maxETASeconds: 30 * 60,
  maxDistanceKm: 50,
  topN: 3,
  tieBreakPolicy: {
    strategy: 'CAPABILITY_THEN_ETA_THEN_RESOURCE_THEN_ID',
  },
  capabilityPolicy: {
    mandatoryMissingExcludes: true,
    preferredMissingScorePenalty: 0.15,
  },
  resourcePolicy: {
    normalizationStrategy: 'LINEAR',
    minimumThresholdForEligibility: 0.3,
  },
  configurationVersion: '1.0.0',
};

export function validateConfiguration(config: RankingConfiguration): ValidationResult {
  const errors: string[] = [];

  if (config.capabilityWeight < 0) errors.push('capabilityWeight cannot be negative');
  if (config.etaWeight < 0) errors.push('etaWeight cannot be negative');
  if (config.resourceWeight < 0) errors.push('resourceWeight cannot be negative');

  const totalWeight = config.capabilityWeight + config.etaWeight + config.resourceWeight;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    errors.push(`Weights must sum to 1.0, got ${totalWeight}`);
  }

  if (config.freshnessThresholds.freshMs <= 0) errors.push('freshMs must be positive');
  if (config.freshnessThresholds.staleMs <= config.freshnessThresholds.freshMs) {
    errors.push('staleMs must be greater than freshMs');
  }

  if (config.maxETASeconds <= 0) errors.push('maxETASeconds must be positive');
  if (config.maxDistanceKm <= 0) errors.push('maxDistanceKm must be positive');
  if (config.topN <= 0) errors.push('topN must be positive');

  if (config.capabilityPolicy.preferredMissingScorePenalty < 0 || config.capabilityPolicy.preferredMissingScorePenalty > 1) {
    errors.push('preferredMissingScorePenalty must be between 0 and 1');
  }

  if (config.resourcePolicy.minimumThresholdForEligibility < 0 || config.resourcePolicy.minimumThresholdForEligibility > 1) {
    errors.push('minimumThresholdForEligibility must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}