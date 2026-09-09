// ============================================================================
// Clinical Derivation Rules — Configuration
// ============================================================================
// Deterministic, auditable keyword rules used to derive two DISTINCT concepts
// from a patient's saved medical profile. There is no AI, no model, and no
// probabilistic scoring anywhere in this file — a given profile always
// produces the same result, and every result can be traced to a rule below.
//
//   PROBABLE EMERGENCY  ← derived from CONDITIONS (medical history)
//       "what is most likely happening to this patient"
//
//   CRITICAL ALERT      ← derived from ALLERGIES
//       "what must the responder never do to this patient"
//
// These are deliberately kept separate: a penicillin allergy is a critical
// alert, NOT a probable emergency. Mixing them would tell a medic the wrong
// thing about why they were dispatched.
// ============================================================================

/**
 * Condition keyword → probable emergency label.
 *
 * Ordered by clinical priority: the FIRST matching rule wins, so
 * life-threatening categories are listed before chronic ones. A patient with
 * both "Coronary Artery Disease" and "Asthma" is dispatched as cardiac.
 */
export const probableEmergencyRules: ReadonlyArray<{
  keywords: string[];
  label: string;
}> = [
  {
    keywords: [
      "cardiac",
      "coronary",
      "heart",
      "angina",
      "myocardial",
      "arrhythmia",
      "atrial fibrillation",
      "heart failure",
    ],
    label: "Cardiac Emergency",
  },
  {
    keywords: ["stroke", "tia", "cerebrovascular", "aneurysm"],
    label: "Stroke / Neurological Emergency",
  },
  {
    keywords: ["epilep", "seizure", "convulsion"],
    label: "Seizure Emergency",
  },
  {
    keywords: ["asthma", "copd", "respirat", "pulmonary", "breathing"],
    label: "Respiratory Emergency",
  },
  {
    keywords: ["diabet", "hypoglyc", "hyperglyc", "insulin"],
    label: "Diabetic Emergency",
  },
  {
    keywords: ["renal", "kidney", "dialysis"],
    label: "Renal Emergency",
  },
  {
    keywords: ["hypertension", "blood pressure"],
    label: "Hypertensive Emergency",
  },
  {
    keywords: ["pregnan", "obstetric"],
    label: "Obstetric Emergency",
  },
];

/**
 * Fallback when the patient has no recorded conditions, or none of them match
 * a rule. Deliberately non-committal — the medic assesses on arrival.
 */
export const DEFAULT_PROBABLE_EMERGENCY = "Medical Emergency";

/**
 * Allergy keywords that warrant escalating the wording of the critical alert.
 * Everything else still produces an alert, just without the "SEVERE" prefix.
 */
export const highRiskAllergyKeywords: ReadonlyArray<string> = [
  "penicillin",
  "anaphyla",
  "peanut",
  "nut",
  "latex",
  "sulfa",
  "iodine",
  "contrast",
];
