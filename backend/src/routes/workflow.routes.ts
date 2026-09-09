// ============================================================================
// Workflow Routes — Authentication, Patient app, Ambulance app
// ============================================================================
// Mounted under /api/v1 alongside the existing emergency/ambulance/hospital
// routes. These are the endpoints the two finalized frontends actually call.
//
// Everything below /patient/me and /ambulance/me is session-scoped: the
// authenticated subject comes from the bearer token, never from the body, so
// one client cannot drive another's emergency.
// ============================================================================

import { Router } from "express";
import { z } from "zod";
import { SessionRole, Severity } from "@prisma/client";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import * as authController from "../controllers/auth.controller";
import * as patientController from "../controllers/patient.controller";
import * as crewController from "../controllers/ambulance-crew.controller";
import {
  requestOtpSchema,
  verifyOtpSchema,
  patientProfileSchema,
  triggerSosSchema,
  ambulanceProfileSchema,
  dispatchStatusSchema,
  locationSchema,
} from "../validators/auth.validator";
import { emergencyIdParamSchema } from "../validators/emergency.validator";

const router = Router();

// ---------------------------------------------------------------------------
// Authentication (OTP simulation — see config/auth.config.ts)
// ---------------------------------------------------------------------------

router.post(
  "/auth/patient/request-otp",
  validate({ body: requestOtpSchema }),
  authController.requestPatientOtp
);
router.post(
  "/auth/patient/verify-otp",
  validate({ body: verifyOtpSchema }),
  authController.verifyPatientOtp
);

router.post(
  "/auth/ambulance/request-otp",
  validate({ body: requestOtpSchema }),
  authController.requestAmbulanceOtp
);
router.post(
  "/auth/ambulance/verify-otp",
  validate({ body: verifyOtpSchema }),
  authController.verifyAmbulanceOtp
);

router.get("/auth/me", requireAuth(), authController.getCurrentUser);
router.post("/auth/sign-out", requireAuth(), authController.signOut);

// ---------------------------------------------------------------------------
// Patient app
// ---------------------------------------------------------------------------

router.get(
  "/patient/me/profile",
  requireAuth(SessionRole.PATIENT),
  patientController.getProfile
);
router.put(
  "/patient/me/profile",
  requireAuth(SessionRole.PATIENT),
  validate({ body: patientProfileSchema }),
  patientController.saveProfile
);

router.get(
  "/patient/me/emergency",
  requireAuth(SessionRole.PATIENT),
  patientController.getActiveEmergency
);
router.post(
  "/patient/me/sos",
  requireAuth(SessionRole.PATIENT),
  validate({ body: triggerSosSchema }),
  patientController.triggerSos
);
router.post(
  "/patient/me/emergency/cancel",
  requireAuth(SessionRole.PATIENT),
  patientController.cancelEmergency
);

// ---------------------------------------------------------------------------
// Ambulance app — profile & dispatch state
// ---------------------------------------------------------------------------

router.get(
  "/ambulance/me/profile",
  requireAuth(SessionRole.AMBULANCE),
  crewController.getProfile
);
router.put(
  "/ambulance/me/profile",
  requireAuth(SessionRole.AMBULANCE),
  validate({ body: ambulanceProfileSchema }),
  crewController.saveProfile
);
router.patch(
  "/ambulance/me/dispatch-status",
  requireAuth(SessionRole.AMBULANCE),
  validate({ body: dispatchStatusSchema }),
  crewController.setDispatchStatus
);
router.patch(
  "/ambulance/me/location",
  requireAuth(SessionRole.AMBULANCE),
  validate({ body: locationSchema }),
  crewController.updateLocation
);
router.get(
  "/ambulance/me/emergency",
  requireAuth(SessionRole.AMBULANCE),
  crewController.getActiveEmergency
);

// ---------------------------------------------------------------------------
// Ambulance app — crew actions on the assigned emergency
// ---------------------------------------------------------------------------

const severityBodySchema = z.object({
  severity: z.enum(
    Object.values(Severity) as [string, ...string[]]
  ) as z.ZodType<Severity>,
});

const crewAction = [
  requireAuth(SessionRole.AMBULANCE),
  validate({ params: emergencyIdParamSchema }),
] as const;

router.post(
  "/ambulance/me/emergency/:id/en-route",
  ...crewAction,
  crewController.startEnRoute
);
router.post(
  "/ambulance/me/emergency/:id/call",
  ...crewAction,
  crewController.startCall
);
router.post(
  "/ambulance/me/emergency/:id/call/end",
  ...crewAction,
  crewController.endCall
);
router.post(
  "/ambulance/me/emergency/:id/pickup",
  ...crewAction,
  crewController.pickUpPatient
);
router.post(
  "/ambulance/me/emergency/:id/severity",
  requireAuth(SessionRole.AMBULANCE),
  validate({ params: emergencyIdParamSchema, body: severityBodySchema }),
  crewController.selectSeverity
);
router.post(
  "/ambulance/me/emergency/:id/notify-hospital",
  ...crewAction,
  crewController.notifyHospital
);
router.post(
  "/ambulance/me/emergency/:id/en-route-hospital",
  ...crewAction,
  crewController.enRouteToHospital
);
router.post(
  "/ambulance/me/emergency/:id/arrived",
  ...crewAction,
  crewController.markArrived
);

export default router;
