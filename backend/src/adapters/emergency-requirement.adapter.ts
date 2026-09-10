// ============================================================================
// EmergencyRequirement Adapter
// ============================================================================
// Maps a Docsahab Emergency into the engine's EmergencyRequirement contract.
// Reuses the SAME `capabilityKeywordRules` config the old ranking system used
// (single source of truth for the keyword→capability mapping), retargeted at
// the engine's capability vocabulary instead of the old 3-boolean shape.
//
// Kept deliberately conservative: only CARDIAC_EMERGENCY and TRAUMA are ever
// MANDATORY, because those are the only two capabilities the current Hospital
// schema can honestly represent (hasCardiology / hasTraumaCare). Requiring a
// capability no seeded hospital can ever have would make every ranking for
// that emergency type return zero eligible hospitals — this engine has no
// fallback, so that failure mode must not be manufactured by an over-eager
// requirement mapping.
//
// Allergy information is intentionally NOT read here — it is a critical
// alert surfaced to responders, never a hospital-ranking input.
// ============================================================================

import {
  EmergencyRequirement,
  createEmergencyId,
  createEmergencyRequirement,
  CommonCapabilities,
  CommonResources,
  Coordinates,
} from "hospital-decision-engine";
import { capabilityKeywordRules } from "../config/hospital-ranking.config";
import type { Severity } from "@prisma/client";

export interface EmergencyRequirementContext {
  emergencyId: string;
  emergencyType: string | null;
  severity: Severity | null;
  patientLocation: Coordinates;
  ambulanceLocation: Coordinates;
}

export function buildEmergencyRequirement(ctx: EmergencyRequirementContext): EmergencyRequirement {
  const text = (ctx.emergencyType ?? "").toLowerCase();

  let needsCardiology = false;
  let needsTrauma = false;
  let needsICU = false;

  for (const rule of capabilityKeywordRules) {
    if (rule.keywords.some((k) => text.includes(k))) {
      if (rule.capability === "cardiology") needsCardiology = true;
      if (rule.capability === "traumaCare") needsTrauma = true;
      if (rule.capability === "icu") needsICU = true;
    }
  }
  // RED (critical) triage always requires ICU capacity, mirroring the old system.
  if (ctx.severity === "RED") needsICU = true;

  const requiredCapabilities = [
    ...(needsCardiology ? [{ capability: CommonCapabilities.CARDIAC_EMERGENCY, requirementLevel: "MANDATORY" as const }] : []),
    ...(needsTrauma ? [{ capability: CommonCapabilities.TRAUMA, requirementLevel: "MANDATORY" as const }] : []),
  ];

  const requiredResources = needsICU
    ? [{ resourceType: CommonResources.ICU_BEDS, minimumQuantity: 1, requirementLevel: "MANDATORY" as const }]
    : [];

  return createEmergencyRequirement({
    emergencyId: createEmergencyId(ctx.emergencyId),
    probableEmergencyType: ctx.emergencyType ?? "Medical Emergency",
    requiredCapabilities,
    requiredResources,
    severity: mapSeverity(ctx.severity),
    patientLocation: ctx.patientLocation,
    ambulanceLocation: ctx.ambulanceLocation,
  });
}

function mapSeverity(severity: Severity | null): "CRITICAL" | "HIGH" | "MODERATE" | "LOW" {
  if (severity === "RED") return "CRITICAL";
  if (severity === "YELLOW") return "MODERATE";
  if (severity === "GREEN") return "LOW";
  // No severity selected yet (search starts on EN_ROUTE, before pickup/triage) — HIGH is a safe default,
  // consistent with "every emergency is urgent until triaged otherwise."
  return "HIGH";
}
