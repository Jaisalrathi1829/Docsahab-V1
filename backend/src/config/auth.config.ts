// ============================================================================
// Authentication — Configuration
// ============================================================================
// This MVP authenticates a mobile number via an OTP SIMULATION. There is no
// SMS provider wired up, so no code is ever actually delivered.
//
// The simulation is deliberately explicit rather than hidden: `otpSimulated`
// travels in the request-OTP response so the frontend can label the screen
// honestly instead of implying a real SMS was sent.
// ============================================================================

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const authConfig = {
  /**
   * SIMULATION MODE. While true, any syntactically valid 6-digit code
   * verifies a challenge that was actually requested for that number.
   * Set AUTH_OTP_SIMULATED=false once a real SMS provider is integrated.
   */
  otpSimulated: process.env.AUTH_OTP_SIMULATED !== "false",

  /** How long a requested OTP challenge stays verifiable. */
  otpTtlMinutes: positiveNumberFromEnv("AUTH_OTP_TTL_MINUTES", 10),

  /**
   * Session lifetime. Long by design: this is a demo MVP and re-authenticating
   * mid-emergency would be actively harmful.
   */
  sessionTtlDays: positiveNumberFromEnv("AUTH_SESSION_TTL_DAYS", 30),

  /** Indian mobile numbers — 10 digits, no country code stored. */
  phoneNumberLength: 10,

  /** Fixed OTP length the UI renders. */
  otpLength: 6,
} as const;
