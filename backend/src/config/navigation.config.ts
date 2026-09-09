// ============================================================================
// Navigation / Routing — Configuration
// ============================================================================
// Tunables for the simulated routing provider. Kept out of the provider so
// the assumptions are visible and overridable per deployment, and so no
// magic numbers reach the frontends.
// ============================================================================

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const navigationConfig = {
  /**
   * Assumed average ambulance speed in km/h, used to convert straight-line
   * distance into an ETA. 30 km/h reflects dense Indian city traffic with
   * siren priority — the same assumption the ambulance matching module uses.
   * Override with NAVIGATION_AVG_SPEED_KMPH.
   */
  averageSpeedKmph: positiveNumberFromEnv("NAVIGATION_AVG_SPEED_KMPH", 30),

  /**
   * Never report a 0-minute ETA — even an ambulance on the doorstep needs a
   * minute to mobilise. Override with NAVIGATION_MIN_ETA_MINUTES.
   */
  minimumEtaMinutes: positiveNumberFromEnv("NAVIGATION_MIN_ETA_MINUTES", 1),
} as const;
