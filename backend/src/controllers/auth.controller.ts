// ============================================================================
// Auth Controller
// ============================================================================
// Thin HTTP glue for the OTP-simulation login used by both client roles.
// ============================================================================

import { Request, Response, NextFunction } from "express";
import { SessionRole } from "@prisma/client";
import * as authService from "../services/auth.service";
import * as patientService from "../services/patient.service";
import * as crewService from "../services/ambulance-crew.service";
import { getRequestToken } from "../middleware/auth.middleware";
import { successResponse } from "../utils/api-response";

/** Builds a role-specific request-OTP handler. */
function requestOtpFor(role: SessionRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.requestOtp(req.body.phoneNumber, role);
      res
        .status(200)
        .json(
          successResponse(
            result,
            result.simulated
              ? "Verification code requested (simulated — enter any 6 digits)"
              : "Verification code sent"
          )
        );
    } catch (error) {
      next(error);
    }
  };
}

/** Builds a role-specific verify-OTP handler that issues the session. */
function verifyOtpFor(role: SessionRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await authService.verifyOtp(
        req.body.phoneNumber,
        req.body.code,
        role
      );
      res
        .status(200)
        .json(successResponse(session, "Verified"));
    } catch (error) {
      next(error);
    }
  };
}

export const requestPatientOtp = requestOtpFor(SessionRole.PATIENT);
export const verifyPatientOtp = verifyOtpFor(SessionRole.PATIENT);
export const requestAmbulanceOtp = requestOtpFor(SessionRole.AMBULANCE);
export const verifyAmbulanceOtp = verifyOtpFor(SessionRole.AMBULANCE);

/**
 * GET /auth/me — who is this session, and does onboarding still need doing.
 *
 * This is what makes a refresh non-destructive: the client restores its whole
 * routing decision from here rather than from local state.
 */
export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { role, subjectId } = req.auth!;

    const subject =
      role === SessionRole.PATIENT
        ? await patientService.getProfile(subjectId)
        : await crewService.getProfile(subjectId);

    res.status(200).json(
      successResponse(
        {
          role,
          id: subject.id,
          phoneNumber: subject.phoneNumber,
          profileCompleted: subject.profileCompleted,
          profile: subject,
        },
        "Session valid"
      )
    );
  } catch (error) {
    next(error);
  }
}

export async function signOut(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = getRequestToken(req);
    if (token) await authService.signOut(token);
    res.status(200).json(successResponse(null, "Signed out"));
  } catch (error) {
    next(error);
  }
}
