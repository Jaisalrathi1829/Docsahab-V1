// ============================================================================
// Hospital Ranking & Acceptance — Zod Validation Schemas (Person 3)
// ============================================================================
// Validates inbound requests for the Hospital module before they reach the
// controller. Reuses the shared emergency UUID param validator so the
// contract stays identical to the rest of the Emergency Core Service.
// ============================================================================

import { z } from "zod";
import { HospitalResponse } from "@prisma/client";

// Reuse the foundation's emergency id param validator (no duplication).
export { emergencyIdParamSchema } from "./emergency.validator";

// --------------------------------------------------------------------------
// POST /emergency/:id/hospital-response — accept / reject a request
// --------------------------------------------------------------------------
// Only ACCEPTED / REJECTED are valid responses (PENDING is the initial state,
// never a submitted answer).
// --------------------------------------------------------------------------

const submittableResponses = [
  HospitalResponse.ACCEPTED,
  HospitalResponse.REJECTED,
] as const;

export const hospitalResponseSchema = z.object({
  hospitalId: z
    .string({ required_error: "hospitalId is required" })
    .min(1, "hospitalId cannot be empty"),

  response: z.enum(
    submittableResponses as unknown as [string, ...string[]],
    {
      required_error: "response is required",
      invalid_type_error: `response must be one of: ${submittableResponses.join(", ")}`,
    }
  ) as z.ZodType<(typeof submittableResponses)[number]>,

  rejectionReason: z.string().optional(),
});

// --------------------------------------------------------------------------
// GET /hospital/:hospitalId/requests — hospital console inbox
// --------------------------------------------------------------------------
// Hospital IDs are seeded strings (e.g. "hosp-001"), not UUIDs.
// --------------------------------------------------------------------------

export const hospitalIdParamSchema = z.object({
  hospitalId: z
    .string({ required_error: "hospitalId is required" })
    .min(1, "hospitalId cannot be empty"),
});

export type HospitalResponseBody = z.infer<typeof hospitalResponseSchema>;
export type HospitalIdParams = z.infer<typeof hospitalIdParamSchema>;
