// ============================================================================
// Ambulance Matching — Zod Validation Schemas
// ============================================================================
// Validates inbound requests for the Ambulance Matching module before they
// reach the controller. Reuses the shared emergency UUID param validator so
// the contract stays identical to the rest of the Emergency Core Service.
// ============================================================================

import { z } from "zod";

// Reuse the foundation's emergency id param validator (no duplication).
export { emergencyIdParamSchema } from "./emergency.validator";

// --------------------------------------------------------------------------
// GET /ambulances — optional availability filter
// --------------------------------------------------------------------------

export const listAmbulancesQuerySchema = z.object({
  available: z
    .enum(["true", "false"], {
      invalid_type_error: "available must be 'true' or 'false'",
    })
    .optional(),
});

export type ListAmbulancesQuery = z.infer<typeof listAmbulancesQuerySchema>;
