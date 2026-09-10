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
  config: RankingConfiguration,
  confidenceMultiplier = 1
): FactorScores {
  const capabilityScore = calculateCapabilityScore(capabilityMatch, config);
  const etaScore = calculateETAScore(etaSeconds, config);
  // Capability is static-profile derived; ETA is route-provider derived. Only
  // the resource score reflects the hospital's LIVE capacity feed, so the stale
  // confidence penalty applies to it alone.
  const resourceScore = clamp01(calculateResourceScore(resourceAvailability, config) * confidenceMultiplier);

  return { capabilityScore, etaScore, resourceScore };
}

function calculateCapabilityScore(match: CapabilityMatchResult, config: RankingConfiguration): number {
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

/**
 * ETA score: linear decay to 0 at maxETA. A missing, non-positive, or otherwise
 * invalid ETA scores 0 — it can never IMPROVE a ranking. (Eligibility already
 * excludes hospitals with malformed ETA data; this is defense in depth.)
 */
function calculateETAScore(etaSeconds: number | undefined, config: RankingConfiguration): number {
  // Missing or negative ETA scores 0 (never favorable). A legitimate 0 ETA
  // (hospital co-located with the ambulance) is the BEST case and scores 1 —
  // eligibility already rejects malformed/negative values, so 0 here is genuine.
  if (etaSeconds === undefined || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return 0;
  }
  const maxETA = config.maxETASeconds;
  if (etaSeconds >= maxETA) return 0;
  return clamp01(1 - etaSeconds / maxETA);
}

function calculateResourceScore(availability: ResourceAvailabilityResult, config: RankingConfiguration): number {
  if (availability.overallScore < config.resourcePolicy.minimumThresholdForEligibility) {
    return 0;
  }
  return clamp01(availability.overallScore);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function calculateFinalScore(factorScores: FactorScores, config: RankingConfiguration): number {
  const { capabilityScore, etaScore, resourceScore } = factorScores;
  const { capabilityWeight, etaWeight, resourceWeight } = config;
  const weightedSum =
    capabilityScore * capabilityWeight + etaScore * etaWeight + resourceScore * resourceWeight;
  return clamp01(weightedSum);
}

export function normalizeFactors(
  scored: ReadonlyArray<ScoredHospital>
): ReadonlyArray<ScoredHospital> {
  return scored.map((h) => ({
    ...h,
    normalizedFactors: {
      capability: h.factorScores.capabilityScore,
      eta: h.factorScores.etaScore,
      resource: h.factorScores.resourceScore,
    },
  }));
}
