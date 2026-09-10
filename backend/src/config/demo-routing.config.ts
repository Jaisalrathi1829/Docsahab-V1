// ============================================================================
// Demo Routing — Configuration (hackathon demo override)
// ============================================================================
// The ONE canonical source of the demo identities. Nothing else in the
// codebase should hardcode these numbers — see demo-routing.service.ts for
// the (sole) place they are checked against a real request.
//
// Disabled by default. Enabling it does not change behavior for anyone
// except the exact configured patient phone number.
// ============================================================================

function boolFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === "true" || raw.trim() === "1";
}

export const demoRoutingConfig = {
  /** Master switch. OFF by default — normal nearest-ambulance dispatch always applies. */
  enabled: boolFromEnv("DOCSAHAB_DEMO_MODE", false),

  /** Exact patient phone number that triggers the forced pairing when enabled. */
  demoPatientPhone: process.env.DEMO_PATIENT_PHONE ?? "1111111111",

  /** Exact ambulance phone number this demo patient is force-paired with. */
  demoAmbulancePhone: process.env.DEMO_AMBULANCE_PHONE ?? "2222222222",

  /**
   * Exact hospital phone number GUARANTEED to be among the invited
   * candidates for the demo patient's emergency — never force-selected,
   * never exempted from real eligibility. See demo-routing.service.ts.
   */
  demoHospitalPhone: process.env.DEMO_HOSPITAL_PHONE ?? "3333333333",
} as const;
