import { CapabilityMatchResult, ResourceAvailabilityResult } from '../models/hospital-snapshot';
import { RankingConfiguration } from './configuration';

export interface FactorScores {
  capabilityScore: number;
  etaScore: number;
  resourceScore: number;
}

export interface NormalizedFactors {
  capability: number;
  eta: number;
  resource: number;
}

export interface ScoredHospital {
  hospitalId: string;
  capabilityMatch: CapabilityMatchResult;
  resourceAvailability: ResourceAvailabilityResult;
  distanceKm?: number;
  etaSeconds?: number;
  factorScores: FactorScores;
  normalizedFactors: NormalizedFactors;
  finalScore: number;
}

export function calculateFactorScores(
  capabilityMatch: CapabilityMatchResult,
  resourceAvailability: ResourceAvailabilityResult,
  etaSeconds: number | undefined,
  distanceKm: number | undefined,
  config: RankingConfiguration
): FactorScores {
  const capabilityScore = calculateCapabilityScore(capabilityMatch, config);
  const etaScore = calculateETAScore(etaSeconds, config);
  const resourceScore = calculateResourceScore(resourceAvailability, config);

  return {
    capabilityScore,
    etaScore,
    resourceScore,
  };
}

function calculateCapabilityScore(
  match: CapabilityMatchResult,
  config: RankingConfiguration
): number {
  if (match.mandatoryMissing.size > 0 && config.capabilityPolicy.mandatoryMissingExcludes) {
    return 0;
  }

  let score = match.matchPercentage;

  if (match.preferredMissing.size > 0) {
    const penalty = match.preferredMissing.size * config.capabilityPolicy.preferredMissingScorePenalty;
    score = Math.max(0, score - penalty);
  }

  return clamp01(score);
}

function calculateETAScore(etaSeconds: number | undefined, config: RankingConfiguration): number {
  if (etaSeconds === undefined || etaSeconds <= 0) {
    return 0;
  }

  const maxETA = config.maxETASeconds;
  if (etaSeconds >= maxETA) {
    return 0;
  }

  const normalized = 1 - (etaSeconds / maxETA);
  return clamp01(normalized);
}

function calculateResourceScore(
  availability: ResourceAvailabilityResult,
  config: RankingConfiguration
): number {
  if (availability.overallScore < config.resourcePolicy.minimumThresholdForEligibility) {
    return 0;
  }
  return clamp01(availability.overallScore);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calculateFinalScore(
  factorScores: FactorScores,
  config: RankingConfiguration
): number {
  const {
    capabilityScore,
    etaScore,
    resourceScore,
  } = factorScores;

  const { capabilityWeight, etaWeight, resourceWeight } = config;

  const weightedSum =
    capabilityScore * capabilityWeight +
    etaScore * etaWeight +
    resourceScore * resourceWeight;

  return clamp01(weightedSum);
}

export function normalizeFactors(
  scored: ReadonlyArray<ScoredHospital>,
  config: RankingConfiguration
): ReadonlyArray<ScoredHospital> {
  return scored.map(h => ({
    ...h,
    normalizedFactors: {
      capability: h.factorScores.capabilityScore,
      eta: h.factorScores.etaScore,
      resource: h.factorScores.resourceScore,
    },
  }));
}