// ============================================================================
// Hospital Ranking & Acceptance — Configuration (Person 3)
// ============================================================================
// Centralizes every tunable assumption of the hospital ranking engine so no
// business priority is hardcoded in the service logic. All values can be
// overridden via environment variables for future tuning per city/deployment.
//
// Follows the same pattern as config/ambulance-matching.config.ts.
// ============================================================================

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface HospitalRankingWeights {
  /** Weight of the required-capability match (highest priority input). */
  capability: number;
  /** Weight of the estimated transport ETA (shorter is better). */
  eta: number;
  /** Weight of resource availability (beds). */
  resources: number;
}

export const hospitalRankingConfig = {
  /**
   * Ranking weights. Capability match dominates by default (a nearby hospital
   * that cannot treat the emergency is worthless), followed by transport ETA,
   * then resource availability. Override with:
   *   HOSPITAL_RANK_WEIGHT_CAPABILITY / _ETA / _RESOURCES
   * Weights are normalized at scoring time, so they need not sum to 1.
   */
  weights: {
    capability: positiveNumberFromEnv("HOSPITAL_RANK_WEIGHT_CAPABILITY", 0.5),
    eta: positiveNumberFromEnv("HOSPITAL_RANK_WEIGHT_ETA", 0.3),
    resources: positiveNumberFromEnv("HOSPITAL_RANK_WEIGHT_RESOURCES", 0.2),
  } as HospitalRankingWeights,

  /**
   * Initial hospital search radius around the patient, in km.
   * Override with HOSPITAL_SEARCH_RADIUS_KM.
   */
  initialSearchRadiusKm: positiveNumberFromEnv("HOSPITAL_SEARCH_RADIUS_KM", 15),

  /**
   * Multiplier applied to the search radius on each fallback round
   * (all candidates rejected → expand and re-search).
   * Override with HOSPITAL_SEARCH_RADIUS_EXPANSION.
   */
  radiusExpansionFactor: positiveNumberFromEnv(
    "HOSPITAL_SEARCH_RADIUS_EXPANSION",
    2
  ),

  /**
   * Hard ceiling on the search radius, in km. Past this, the search is
   * exhausted (no hospital within the safe golden-hour transport window).
   * Override with HOSPITAL_SEARCH_RADIUS_MAX_KM.
   */
  maxSearchRadiusKm: positiveNumberFromEnv("HOSPITAL_SEARCH_RADIUS_MAX_KM", 60),

  /**
   * How many ranked hospitals receive a request per search round.
   * Override with HOSPITAL_MAX_CANDIDATES.
   */
  maxCandidatesPerRound: positiveNumberFromEnv("HOSPITAL_MAX_CANDIDATES", 3),

  /**
   * Golden-hour guardrail: hospitals whose estimated transport ETA exceeds
   * this are excluded from ranking entirely.
   * Override with HOSPITAL_GOLDEN_HOUR_MAX_ETA_MIN.
   */
  goldenHourMaxEtaMinutes: positiveNumberFromEnv(
    "HOSPITAL_GOLDEN_HOUR_MAX_ETA_MIN",
    60
  ),

  /**
   * Assumed average patient-transport speed in km/h (ambulance with patient
   * onboard, siren priority). Used to convert haversine distance → ETA.
   * Override with HOSPITAL_TRANSPORT_SPEED_KMPH.
   */
  transportSpeedKmph: positiveNumberFromEnv("HOSPITAL_TRANSPORT_SPEED_KMPH", 40),

  /**
   * Floor for a reported transport ETA (minutes). Never report 0.
   * Override with HOSPITAL_MIN_ETA_MINUTES.
   */
  minimumEtaMinutes: positiveNumberFromEnv("HOSPITAL_MIN_ETA_MINUTES", 1),

  /**
   * Bed count at (or above) which a hospital earns a full resource score.
   * Below it, the score scales linearly. Hospitals with 0 beds are excluded
   * from discovery entirely (treated as "not accepting").
   * Override with HOSPITAL_BEDS_FULL_SCORE.
   */
  bedsForFullResourceScore: positiveNumberFromEnv(
    "HOSPITAL_BEDS_FULL_SCORE",
    10
  ),
} as const;

// ----------------------------------------------------------------------------
// Emergency type → required capability mapping
// ----------------------------------------------------------------------------
// `Emergency.emergencyType` is free text (e.g. "Cardiac Emergency",
// "Severe Trauma — RTA"), so requirements are derived by keyword match.
// Kept here (config, not service) so clinical routing rules are tunable
// without touching ranking logic.
// ----------------------------------------------------------------------------

export const capabilityKeywordRules: ReadonlyArray<{
  /** Case-insensitive substrings that trigger the requirement. */
  keywords: string[];
  capability: "cardiology" | "traumaCare" | "icu";
}> = [
  {
    keywords: ["cardiac", "heart", "chest pain", "stroke"],
    capability: "cardiology",
  },
  {
    keywords: ["trauma", "accident", "rta", "injur", "fracture", "burn", "fall"],
    capability: "traumaCare",
  },
  {
    keywords: ["icu", "critical", "unconscious", "respiratory", "breathing"],
    capability: "icu",
  },
];
