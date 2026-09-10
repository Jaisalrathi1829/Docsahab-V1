// ============================================================================
// Ranking Configuration
// ============================================================================
// Every tunable assumption of the ranking + freshness engine lives here so no
// business priority is hardcoded in decision logic. Nothing in this file reads
// process.env — configuration is injected by the caller (Docsahab), keeping the
// core free of hidden runtime dependencies.
// ============================================================================

export interface RankingConfiguration {
  capabilityWeight: number;
  etaWeight: number;
  resourceWeight: number;
  freshnessPolicy: FreshnessPolicy;
  maxETASeconds: number;
  maxDistanceKm: number;
  topN: number;
  /** How long an invitation stays answerable before it expires (ms). */
  invitationTtlMs: number;
  tieBreakPolicy: TieBreakPolicy;
  capabilityPolicy: CapabilityPolicy;
  resourcePolicy: ResourcePolicy;
  configurationVersion: string;
}

/**
 * Freshness is a first-class decision rule, not metadata.
 *
 *   age <= freshMs                         → FRESH
 *   freshMs < age <= staleMs               → STALE   (behavior = staleBehavior)
 *   age > staleMs                          → EXPIRED (always hard-excluded)
 *   age < -maxClockSkewMs (future dated)   → EXPIRED (rejected as untrustworthy)
 *   -maxClockSkewMs <= age < 0             → FRESH   (tolerated clock skew)
 *
 * `staleBehavior` is the one genuinely product-sensitive knob — see the
 * integration guide's "PRODUCT DECISION REQUIRED: STALE data policy".
 *
 *   'EXCLUDE'  — stale hospitals are hard-excluded (reason DATA_STALE).
 *   'DEGRADE'  — stale hospitals stay eligible but every score component that
 *                derives from live data is multiplied by staleConfidenceMultiplier,
 *                so a fresher hospital of equal quality always outranks a stale one.
 *   'ALLOW'    — stale data is trusted at full confidence (legacy behavior).
 *
 * Default is DEGRADE: with no fallback system, excluding outright risks starving
 * the candidate pool, while trusting 15-minute-old capacity data at full
 * confidence is unsafe. DEGRADE keeps the hospital reachable but ranks fresher
 * data higher. This default is flagged for product confirmation.
 */
export interface FreshnessPolicy {
  freshMs: number;
  staleMs: number;
  maxClockSkewMs: number;
  staleBehavior: "EXCLUDE" | "DEGRADE" | "ALLOW";
  /** Multiplier in [0,1] applied to live-derived scores when DEGRADE + STALE. */
  staleConfidenceMultiplier: number;
}

export interface TieBreakPolicy {
  strategy: "CAPABILITY_THEN_ETA_THEN_RESOURCE_THEN_ID";
}

export interface CapabilityPolicy {
  mandatoryMissingExcludes: boolean;
  preferredMissingScorePenalty: number;
}

export interface ResourcePolicy {
  normalizationStrategy: "LINEAR" | "STEP";
  minimumThresholdForEligibility: number;
}

export const DEFAULT_RANKING_CONFIGURATION: RankingConfiguration = {
  capabilityWeight: 0.5,
  etaWeight: 0.3,
  resourceWeight: 0.2,
  freshnessPolicy: {
    freshMs: 5 * 60 * 1000,
    staleMs: 15 * 60 * 1000,
    maxClockSkewMs: 60 * 1000,
    staleBehavior: "DEGRADE",
    staleConfidenceMultiplier: 0.6,
  },
  maxETASeconds: 30 * 60,
  maxDistanceKm: 50,
  topN: 3,
  invitationTtlMs: 5 * 60 * 1000,
  tieBreakPolicy: {
    strategy: "CAPABILITY_THEN_ETA_THEN_RESOURCE_THEN_ID",
  },
  capabilityPolicy: {
    mandatoryMissingExcludes: true,
    preferredMissingScorePenalty: 0.15,
  },
  resourcePolicy: {
    normalizationStrategy: "LINEAR",
    minimumThresholdForEligibility: 0.3,
  },
  configurationVersion: "2.0.0",
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfiguration(config: RankingConfiguration): ValidationResult {
  const errors: string[] = [];

  if (config.capabilityWeight < 0) errors.push("capabilityWeight cannot be negative");
  if (config.etaWeight < 0) errors.push("etaWeight cannot be negative");
  if (config.resourceWeight < 0) errors.push("resourceWeight cannot be negative");

  const totalWeight = config.capabilityWeight + config.etaWeight + config.resourceWeight;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    errors.push(`Weights must sum to 1.0, got ${totalWeight}`);
  }

  const fp = config.freshnessPolicy;
  if (fp.freshMs <= 0) errors.push("freshnessPolicy.freshMs must be positive");
  if (fp.staleMs <= fp.freshMs) errors.push("freshnessPolicy.staleMs must be greater than freshMs");
  if (fp.maxClockSkewMs < 0) errors.push("freshnessPolicy.maxClockSkewMs cannot be negative");
  if (fp.staleConfidenceMultiplier < 0 || fp.staleConfidenceMultiplier > 1) {
    errors.push("freshnessPolicy.staleConfidenceMultiplier must be between 0 and 1");
  }
  if (!["EXCLUDE", "DEGRADE", "ALLOW"].includes(fp.staleBehavior)) {
    errors.push(`freshnessPolicy.staleBehavior must be EXCLUDE|DEGRADE|ALLOW, got ${fp.staleBehavior}`);
  }

  if (config.maxETASeconds <= 0) errors.push("maxETASeconds must be positive");
  if (config.maxDistanceKm <= 0) errors.push("maxDistanceKm must be positive");
  if (config.topN <= 0) errors.push("topN must be positive");
  if (config.invitationTtlMs <= 0) errors.push("invitationTtlMs must be positive");

  if (
    config.capabilityPolicy.preferredMissingScorePenalty < 0 ||
    config.capabilityPolicy.preferredMissingScorePenalty > 1
  ) {
    errors.push("preferredMissingScorePenalty must be between 0 and 1");
  }

  if (
    config.resourcePolicy.minimumThresholdForEligibility < 0 ||
    config.resourcePolicy.minimumThresholdForEligibility > 1
  ) {
    errors.push("minimumThresholdForEligibility must be between 0 and 1");
  }

  return { valid: errors.length === 0, errors };
}

/** Deep-merges a partial override onto the default configuration. */
export function mergeConfiguration(
  base: RankingConfiguration,
  override?: Partial<RankingConfiguration>
): RankingConfiguration {
  if (!override) return base;
  return {
    ...base,
    ...override,
    freshnessPolicy: { ...base.freshnessPolicy, ...override.freshnessPolicy },
    tieBreakPolicy: { ...base.tieBreakPolicy, ...override.tieBreakPolicy },
    capabilityPolicy: { ...base.capabilityPolicy, ...override.capabilityPolicy },
    resourcePolicy: { ...base.resourcePolicy, ...override.resourcePolicy },
  };
}
