// ============================================================================
// Ambulance Matching — Routes (Person 2)
// ============================================================================
// Mounted under /api/v1 alongside the Emergency Core Service routes. These are
// the ONLY new routes the module adds; everything else reuses existing
// Emergency APIs.
//
// New routes & justification:
//   POST /emergency/:id/assign-ambulance
//     Discovery + nearest-unit selection + ETA + atomic assignment is a NEW
//     capability not covered by the existing API. PATCH /emergency/:id/status
//     only SETS a caller-supplied ambulance; it does not find one, compute an
//     ETA, claim availability, or guarantee atomicity. Hence a dedicated route.
//
//   GET /ambulances
//     Read-only ambulance discovery (optionally filtered by availability),
//     replacing the prototype's port-5000 GET /ambulances. No write, no
//     conflict with the Emergency Core Service.
// ============================================================================

import { Router } from "express";
import * as ambulanceController from "../controllers/ambulance.controller";
import { validate } from "../middleware/validate.middleware";
import {
  emergencyIdParamSchema,
  listAmbulancesQuerySchema,
} from "../validators/ambulance.validator";

const router = Router();

router.post(
  "/emergency/:id/assign-ambulance",
  validate({ params: emergencyIdParamSchema }),
  ambulanceController.assignAmbulance
);

router.get(
  "/ambulances",
  validate({ query: listAmbulancesQuerySchema }),
  ambulanceController.listAmbulances
);

export default router;
