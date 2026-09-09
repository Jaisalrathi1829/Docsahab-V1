// ============================================================================
// Clinical Derivation Service
// ============================================================================
// Turns a patient's saved medical profile into the two responder-facing
// signals the ambulance app displays. Pure functions — no I/O, no randomness,
// no AI. Same input always yields the same output, which is what makes the
// dispatch explainable and testable.
//
//   deriveProbableEmergency(conditions) → "Cardiac Emergency"
//   deriveCriticalAlert(allergies)      → "SEVERE: Penicillin Allergy"
//
// Both are computed once, at SOS creation, and denormalized onto the
// Emergency so the value a responder saw is preserved even if the patient
// later edits their profile.
// ============================================================================

import {
  probableEmergencyRules,
  DEFAULT_PROBABLE_EMERGENCY,
  highRiskAllergyKeywords,
} from "../config/clinical-rules.config";

/**
 * The most likely emergency category for this patient, based on their
 * recorded medical history.
 *
 * Rules are evaluated in clinical-priority order and the first match wins, so
 * a patient with both cardiac and respiratory history is dispatched as
 * cardiac. Returns a safe generic label when nothing matches.
 */
export function deriveProbableEmergency(
  conditions: readonly string[] | null | undefined
): string {
  if (!conditions || conditions.length === 0) {
    return DEFAULT_PROBABLE_EMERGENCY;
  }

  const haystack = conditions.join(" ").toLowerCase();

  for (const rule of probableEmergencyRules) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.label;
    }
  }

  return DEFAULT_PROBABLE_EMERGENCY;
}

/**
 * The single most important "do not do this" warning for responders.
 *
 * Derived from ALLERGIES only — never from conditions.
 *
 * The exact string format `"<allergen> Allergy"` is a FROZEN CONTRACT: it is
 * asserted verbatim by test-e2e.js and rendered directly by both frontends.
 * Do not reformat it. High-risk allergens are surfaced separately via
 * `isHighRiskAllergy()` so callers can style the same string differently
 * without changing its text.
 */
export function deriveCriticalAlert(
  allergies: readonly string[] | null | undefined
): string | null {
  if (!allergies || allergies.length === 0) return null;

  const primary = allergies[0]?.trim();
  if (!primary) return null;

  return `${primary} Allergy`;
}

/**
 * Whether the headline allergy is one that warrants visual escalation in the
 * responder UI. Kept separate from the alert text so the frozen string format
 * above stays untouched.
 */
export function isHighRiskAllergy(
  allergies: readonly string[] | null | undefined
): boolean {
  const primary = allergies?.[0]?.trim().toLowerCase();
  if (!primary) return false;
  return highRiskAllergyKeywords.some((keyword) => primary.includes(keyword));
}

/**
 * Every allergy formatted for display, so the ambulance app can list the full
 * set alongside the single headline alert.
 */
export function formatAllergyList(
  allergies: readonly string[] | null | undefined
): string[] {
  if (!allergies) return [];
  return allergies.map((a) => a.trim()).filter(Boolean);
}
