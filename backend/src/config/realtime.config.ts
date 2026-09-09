// ============================================================================
// Realtime Synchronization — Configuration (Person 4)
// ============================================================================
// Centralizes every tunable of the Socket.IO layer so nothing is hardcoded
// in the gateway. All values can be overridden via environment variables.
//
// Follows the same pattern as config/ambulance-matching.config.ts and
// config/hospital-ranking.config.ts.
// ============================================================================

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const realtimeConfig = {
  /**
   * Socket.IO endpoint path on the existing HTTP server.
   * Override with REALTIME_PATH.
   */
  path: process.env.REALTIME_PATH ?? "/socket.io",

  /**
   * CORS for the websocket handshake. Mirrors the Express CORS policy:
   * open in development, ALLOWED_ORIGINS (comma-separated) in production.
   */
  corsOrigin:
    process.env.NODE_ENV === "production"
      ? (process.env.ALLOWED_ORIGINS?.split(",") ?? [])
      : "*",

  /**
   * Heartbeat tuning. Socket.IO defaults are fine for LAN dev; exposed for
   * production tuning (mobile networks need longer timeouts).
   * Override with REALTIME_PING_INTERVAL_MS / REALTIME_PING_TIMEOUT_MS.
   */
  pingIntervalMs: positiveNumberFromEnv("REALTIME_PING_INTERVAL_MS", 25000),
  pingTimeoutMs: positiveNumberFromEnv("REALTIME_PING_TIMEOUT_MS", 20000),

  /**
   * Guardrail: maximum rooms one socket may join. Prevents a misbehaving
   * client from subscribing to unbounded state.
   * Override with REALTIME_MAX_ROOMS_PER_SOCKET.
   */
  maxRoomsPerSocket: positiveNumberFromEnv("REALTIME_MAX_ROOMS_PER_SOCKET", 20),
} as const;
