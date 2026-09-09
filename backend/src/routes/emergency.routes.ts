// ============================================================================
// Emergency Routes
// ============================================================================
// Route definitions for the Emergency Core Service.
// Each route applies Zod validation middleware BEFORE the controller.
// ============================================================================

import { Router } from "express";
import * as emergencyController from "../controllers/emergency.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createEmergencySchema,
  updateStatusSchema,
  emergencyIdParamSchema,
} from "../validators/emergency.validator";

const router = Router();

// --------------------------------------------------------------------------
// POST /sos — Create a new emergency
// --------------------------------------------------------------------------
router.post(
  "/sos",
  validate({ body: createEmergencySchema }),
  emergencyController.createEmergency
);

// --------------------------------------------------------------------------
// GET /emergencies/active — Emergency currently in progress (responder consoles)
// Declared BEFORE /emergency/:id so it is never shadowed by the UUID route.
// --------------------------------------------------------------------------
router.get("/emergencies/active", emergencyController.getActiveEmergency);

// --------------------------------------------------------------------------
// GET /emergency/:id — Get complete emergency information
// --------------------------------------------------------------------------
router.get(
  "/emergency/:id",
  validate({ params: emergencyIdParamSchema }),
  emergencyController.getEmergencyById
);

// --------------------------------------------------------------------------
// PATCH /emergency/:id/status — Update emergency status
// --------------------------------------------------------------------------
router.patch(
  "/emergency/:id/status",
  validate({
    params: emergencyIdParamSchema,
    body: updateStatusSchema,
  }),
  emergencyController.updateEmergencyStatus
);

// --------------------------------------------------------------------------
// GET /emergency/:id/timeline — Get emergency timeline
// --------------------------------------------------------------------------
router.get(
  "/emergency/:id/timeline",
  validate({ params: emergencyIdParamSchema }),
  emergencyController.getEmergencyTimeline
);

export default router;
