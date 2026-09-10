// ============================================================================
// Hospital Console — Zod Validation Schemas
// ============================================================================

import { z } from "zod";

export const candidateIdParamSchema = z.object({
  candidateId: z.string({ required_error: "candidateId is required" }).uuid(),
});

export const respondSchema = z.object({
  response: z.enum(["ACCEPTED", "REJECTED"], {
    required_error: "response is required",
    invalid_type_error: "response must be ACCEPTED or REJECTED",
  }),
});

/** Hospital-operated live-status update — every field optional (partial patch). */
export const liveStatusUpdateSchema = z.object({
  acceptingEmergencyPatients: z.boolean().optional(),
  operationalStatus: z.enum(["OPERATIONAL", "DEGRADED", "OFFLINE", "MAINTENANCE"]).optional(),
  emergencyDepartmentStatus: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE", "UNKNOWN"]).optional(),
  traumaDepartmentStatus: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE", "UNKNOWN"]).optional(),
  icuBedsAvailable: z.coerce.number().int().min(0).optional(),
  generalBedsAvailable: z.coerce.number().int().min(0).optional(),
  erBaysAvailable: z.coerce.number().int().min(0).optional(),
  traumaBaysAvailable: z.coerce.number().int().min(0).optional(),
  ventilatorsAvailable: z.coerce.number().int().min(0).optional(),
  bloodProductsAvailable: z.boolean().optional(),
});
