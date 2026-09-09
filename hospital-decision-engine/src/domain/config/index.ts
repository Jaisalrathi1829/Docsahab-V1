import { DomainError } from '../errors';

export interface RankingConfig {
  version: string;
  weights: {
    capability: number;
    eta: number;
    resources: number;
  };
  freshnessThresholdsMs: {
    fresh: number;
    stale: number;
  };
  maxETASeconds: number;
  topN: number;
  allowPartialCapabilityMatch: boolean;
  preferredCapabilityPenalty: number;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  version: '1.0.0',
  weights: {
    capability: 0.50,
    eta: 0.30,
    resources: 0.20,
  },
  freshnessThresholdsMs: {
    fresh: 5 * 60 * 1000,
    stale: 15 * 60 * 1000,
  },
  maxETASeconds: 1800,
  topN: 3,
  allowPartialCapabilityMatch: true,
  preferredCapabilityPenalty: 0.2,
};

export function validateRankingConfig(config: RankingConfig): void {
  const sumWeights = config.weights.capability + config.weights.eta + config.weights.resources;
  if (Math.abs(sumWeights - 1.0) > 0.001) {
    throw new DomainError('CONFIGURATION_ERROR', 'Ranking weights must sum to 1.0', { sumWeights });
  }
  if (config.weights.capability < 0 || config.weights.eta < 0 || config.weights.resources < 0) {
    throw new DomainError('CONFIGURATION_ERROR', 'Ranking weights cannot be negative');
  }
  if (config.topN <= 0) {
    throw new DomainError('CONFIGURATION_ERROR', 'topN must be greater than zero');
  }
  if (config.maxETASeconds <= 0) {
    throw new DomainError('CONFIGURATION_ERROR', 'maxETASeconds must be greater than zero');
  }
}
