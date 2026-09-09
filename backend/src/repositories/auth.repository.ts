// ============================================================================
// Auth Repository
// ============================================================================
// All Prisma access for OTP challenges and sessions. No business rules here —
// validity windows, code checking and session lifetimes live in the service.
// ============================================================================

import { SessionRole } from "@prisma/client";
import { prisma } from "../prisma/client";

// --------------------------------------------------------------------------
// OTP challenges
// --------------------------------------------------------------------------

export async function createOtpChallenge(params: {
  phoneNumber: string;
  role: SessionRole;
  expiresAt: Date;
}) {
  return prisma.otpChallenge.create({ data: params });
}

/**
 * The most recent unconsumed, unexpired challenge for this number+role.
 */
export async function findActiveOtpChallenge(
  phoneNumber: string,
  role: SessionRole
) {
  return prisma.otpChallenge.findFirst({
    where: {
      phoneNumber,
      role,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function consumeOtpChallenge(id: string) {
  return prisma.otpChallenge.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

// --------------------------------------------------------------------------
// Sessions
// --------------------------------------------------------------------------

export async function createSession(params: {
  token: string;
  role: SessionRole;
  subjectId: string;
  expiresAt: Date;
}) {
  return prisma.session.create({ data: params });
}

export async function findValidSession(token: string) {
  return prisma.session.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
  });
}

export async function deleteSession(token: string) {
  return prisma.session.deleteMany({ where: { token } });
}

// --------------------------------------------------------------------------
// Subject lookups (identity resolution after OTP verification)
// --------------------------------------------------------------------------

export async function findPatientByPhone(phoneNumber: string) {
  return prisma.patient.findUnique({ where: { phoneNumber } });
}

export async function findAmbulanceByPhone(phoneNumber: string) {
  return prisma.ambulance.findUnique({ where: { phoneNumber } });
}

export async function findPatientById(id: string) {
  return prisma.patient.findUnique({ where: { id } });
}

export async function findAmbulanceById(id: string) {
  return prisma.ambulance.findUnique({ where: { id } });
}

/**
 * Creates the shell Patient record that a freshly verified number owns.
 * The medical profile is filled in by the next onboarding step, so the
 * required scalar columns get neutral placeholders until then.
 */
export async function createPatientShell(phoneNumber: string) {
  return prisma.patient.create({
    data: {
      phoneNumber,
      fullName: "",
      age: 0,
      bloodGroup: "",
      profileCompleted: false,
    },
  });
}

/**
 * Creates the shell Ambulance record for a freshly verified crew number.
 * `vehicleNo` is unique and required, so a deterministic placeholder derived
 * from the phone number is used until the profile step supplies the real one.
 */
export async function createAmbulanceShell(phoneNumber: string) {
  return prisma.ambulance.create({
    data: {
      phoneNumber,
      vehicleNo: `UNREGISTERED-${phoneNumber}`,
      latitude: 0,
      longitude: 0,
      isOnline: false,
      isAvailable: true,
      profileCompleted: false,
    },
  });
}
