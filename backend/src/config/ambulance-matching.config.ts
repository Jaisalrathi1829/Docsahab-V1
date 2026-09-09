// ============================================================================
// Ambulance Matching — Configuration
// ============================================================================
// Centralizes the tunable assumptions of the matching/ETA logic so there are
// no unexplained magic numbers scattered through the service. Values can be
// overridden via environment variables for different cities/deployments.
// ============================================================================

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ambulanceMatchingConfig = {
  /**
   * Assumed average ambulance ground speed in km/h, used to convert the
   * straight-line (haversine) distance into an ETA.
   *
   * Default 30 km/h reflects dense Indian city traffic with siren priority.
   * The original prototype used `distanceKm * 2` minutes, which is exactly
   * 30 km/h — preserved here, but now named and configurable.
   * Override with AMBULANCE_AVG_SPEED_KMPH.
   */
  averageSpeedKmph: positiveNumberFromEnv("AMBULANCE_AVG_SPEED_KMPH", 30),

  /**
   * Floor for a reported ETA. Even an ambulance "on top of" the patient needs
   * a minute to mobilise, so we never report 0.
   * Override with AMBULANCE_MIN_ETA_MINUTES.
   */
  minimumEtaMinutes: positiveNumberFromEnv("AMBULANCE_MIN_ETA_MINUTES", 1),
} as const;
