// ============================================================================
// Hospital Ranking & Acceptance — Routes (Person 3)
// ============================================================================
// Mounted under /api/v1 alongside the Emergency Core Service routes. These
// are the ONLY new routes the module adds; lifecycle changes flow through the
// existing Emergency Core Service.
//
// New routes & justification:
//   POST /emergency/:id/find-hospitals
//     Discovery + ranking + candidate generation + parallel requests is a NEW
//     capability not covered by any existing API. (The same search also runs
//     automatically on AMBULANCE_EN_ROUTE via the emergencyEvents seam.)
//
//   POST /emergency/:id/hospital-response
//     Accept/Reject belongs on the HospitalCandidate workflow (frozen design:
//     rejection is NOT an emergency status). PATCH /emergency/:id/status
//     cannot express candidate responses, idempotency, or the atomic
//     first-acceptance claim. This endpoint replaces the Hospital frontend's
//     broken `HOSPITAL_REJECTED` status write.
//
//   POST /emergency/:id/notify-hospital
//     Post-severity notification of the locked hospital: computes the updated
//     transport ETA and drives HOSPITAL_NOTIFIED through the Emergency Core.
//
//   GET /hospital/:hospitalId/requests
//     A hospital console's pending-request inbox (poll-based today; Person 4
//     will push the same payload over sockets).
// ============================================================================

import { Router } from "express";
import * as hospitalController from "../controllers/hospital.controller";
import { validate } from "../middleware/validate.middleware";
import {
  emergencyIdParamSchema,
  hospitalResponseSchema,
  hospitalIdParamSchema,
} from "../validators/hospital.validator";

const router = Router();

router.post(
  "/emergency/:id/find-hospitals",
  validate({ params: emergencyIdParamSchema }),
  hospitalController.findHospitals
);

router.post(
  "/emergency/:id/hospital-response",
  validate({ params: emergencyIdParamSchema, body: hospitalResponseSchema }),
  hospitalController.respondToRequest
);

router.post(
  "/emergency/:id/notify-hospital",
  validate({ params: emergencyIdParamSchema }),
  hospitalController.notifyHospital
);

router.get(
  "/hospital/:hospitalId/requests",
  validate({ params: hospitalIdParamSchema }),
  hospitalController.listHospitalRequests
);

export default router;
