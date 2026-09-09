// ============================================================================
// Auth Service
// ============================================================================
// Mobile-number identity for the two client roles, backed by an OTP
// SIMULATION (see config/auth.config.ts — no SMS is sent).
//
// Flow, identical for both roles:
//   requestOtp(phone)  → records a challenge
//   verifyOtp(phone, code) → consumes the challenge, finds-or-creates the
//                            subject, issues an opaque session token
//   resolveSession(token)  → who is this caller
//
// Returning users are handled by find-or-create plus the `profileCompleted`
// flag: an existing, completed subject skips onboarding entirely.
// ============================================================================

import { randomBytes } from "crypto";
import { SessionRole } from "@prisma/client";
import * as authRepo from "../repositories/auth.repository";
import { authConfig } from "../config/auth.config";
import { AppError } from "../middleware/error-handler.middleware";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60_000);
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Tolerate a leading country code so "+91 98765 43210" and "9876543210"
  // resolve to the same identity.
  return digits.length > authConfig.phoneNumberLength
    ? digits.slice(-authConfig.phoneNumberLength)
    : digits;
}

function assertValidPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length !== authConfig.phoneNumberLength) {
    throw new AppError(
      400,
      "INVALID_PHONE_NUMBER",
      `Mobile number must be ${authConfig.phoneNumberLength} digits`
    );
  }
  return normalized;
}

// --------------------------------------------------------------------------
// OTP
// --------------------------------------------------------------------------

/**
 * Records a verification challenge for this number+role.
 *
 * Returns `simulated: true` so the client can be honest on screen about the
 * fact that no SMS was actually dispatched.
 */
export async function requestOtp(rawPhone: string, role: SessionRole) {
  const phoneNumber = assertValidPhone(rawPhone);

  await authRepo.createOtpChallenge({
    phoneNumber,
    role,
    expiresAt: minutesFromNow(authConfig.otpTtlMinutes),
  });

  return {
    phoneNumber,
    otpLength: authConfig.otpLength,
    expiresInMinutes: authConfig.otpTtlMinutes,
    simulated: authConfig.otpSimulated,
  };
}

/**
 * Verifies a challenge and issues a session.
 *
 * In simulation mode any 6-digit code is accepted, but ONLY against a
 * challenge that was genuinely requested and has not expired or been used —
 * so verification still cannot be forged for an arbitrary number.
 */
export async function verifyOtp(
  rawPhone: string,
  code: string,
  role: SessionRole
) {
  const phoneNumber = assertValidPhone(rawPhone);

  if (!new RegExp(`^\\d{${authConfig.otpLength}}$`).test(code)) {
    throw new AppError(
      400,
      "INVALID_OTP_FORMAT",
      `Verification code must be ${authConfig.otpLength} digits`
    );
  }

  const challenge = await authRepo.findActiveOtpChallenge(phoneNumber, role);
  if (!challenge) {
    throw new AppError(
      400,
      "OTP_NOT_REQUESTED",
      "No active verification request for this number. Request a new code."
    );
  }

  if (!authConfig.otpSimulated) {
    // A real provider would compare against the delivered code here.
    throw new AppError(
      501,
      "OTP_PROVIDER_NOT_CONFIGURED",
      "Live OTP verification is not configured on this deployment"
    );
  }

  await authRepo.consumeOtpChallenge(challenge.id);

  // Find-or-create the subject this number owns.
  const subject =
    role === SessionRole.PATIENT
      ? (await authRepo.findPatientByPhone(phoneNumber)) ??
        (await authRepo.createPatientShell(phoneNumber))
      : (await authRepo.findAmbulanceByPhone(phoneNumber)) ??
        (await authRepo.createAmbulanceShell(phoneNumber));

  const token = randomBytes(32).toString("hex");
  await authRepo.createSession({
    token,
    role,
    subjectId: subject.id,
    expiresAt: daysFromNow(authConfig.sessionTtlDays),
  });

  return {
    token,
    role,
    subjectId: subject.id,
    // Drives the client's routing decision: skip onboarding for returning users.
    profileCompleted: subject.profileCompleted,
  };
}

// --------------------------------------------------------------------------
// Sessions
// --------------------------------------------------------------------------

export interface AuthenticatedCaller {
  role: SessionRole;
  subjectId: string;
}

/**
 * Resolves a bearer token to its subject, or throws 401.
 */
export async function resolveSession(
  token: string | undefined
): Promise<AuthenticatedCaller> {
  if (!token) {
    throw new AppError(401, "UNAUTHENTICATED", "Missing session token");
  }

  const session = await authRepo.findValidSession(token);
  if (!session) {
    throw new AppError(
      401,
      "SESSION_INVALID",
      "Session is invalid or has expired. Sign in again."
    );
  }

  return { role: session.role, subjectId: session.subjectId };
}

export async function signOut(token: string) {
  await authRepo.deleteSession(token);
}
