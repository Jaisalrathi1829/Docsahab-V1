// ============================================================================
// Medic ↔ Patient Call Service
// ============================================================================
// SIMULATION. There is no PSTN, no WebRTC and no audio anywhere in Docsahab.
// What this module provides is the *call state machine* the real product
// would have, stored on the emergency so both apps agree on it:
//
//   NONE → INITIATED → ACTIVE → ENDED
//
// The medic initiates. The patient app observes `callStatus` and enters its
// speakerphone view automatically — the patient is never asked to answer,
// which is the intended product behaviour for someone who may be injured.
//
// Because the state lives on the shared Emergency row, "the medic called me"
// survives a page refresh on either side.
// ============================================================================

import { CallStatus } from "@prisma/client";
import { prisma } from "../prisma/client";
import { emergencyEvents } from "./emergency.service";
import * as emergencyRepo from "../repositories/emergency.repository";
import { AppError } from "../middleware/error-handler.middleware";

const log = (message: string) => console.log(`[call] ${message}`);

/** Call states from which a new call may be started. */
const STARTABLE: ReadonlySet<CallStatus> = new Set([
  CallStatus.NONE,
  CallStatus.ENDED,
]);

/**
 * Medic taps "Patient on Call".
 *
 * Transitions INITIATED → ACTIVE immediately: with no real network to wait
 * for, an artificial ringing delay would be theatre. The two states are kept
 * distinct in the enum so a real telephony integration can sit between them
 * later without a schema change.
 */
export async function startCall(emergencyId: string) {
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(404, "EMERGENCY_NOT_FOUND", "Emergency not found");
  }

  if (emergency.callStatus === CallStatus.ACTIVE) {
    // Idempotent: tapping twice keeps the existing call rather than restarting
    // the timer both clients are rendering.
    return emergency;
  }

  if (!STARTABLE.has(emergency.callStatus)) {
    throw new AppError(
      409,
      "CALL_ALREADY_IN_PROGRESS",
      `Cannot start a call while the current call is ${emergency.callStatus}`
    );
  }

  await prisma.emergency.update({
    where: { id: emergencyId },
    data: {
      callStatus: CallStatus.ACTIVE,
      callStartedAt: new Date(),
      callEndedAt: null,
    },
  });

  const updated = await emergencyRepo.findEmergencyById(emergencyId);

  log(`emergency ${emergencyId}: call ACTIVE (simulated)`);
  emergencyEvents.emit("callStatusChanged", {
    emergencyId,
    callStatus: CallStatus.ACTIVE,
    emergency: updated,
  });

  return updated!;
}

/**
 * Either side hangs up. Idempotent — ending an already-ended call is a no-op
 * rather than an error, because both clients may send it.
 */
export async function endCall(emergencyId: string) {
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) {
    throw new AppError(404, "EMERGENCY_NOT_FOUND", "Emergency not found");
  }

  if (emergency.callStatus !== CallStatus.ACTIVE) {
    return emergency;
  }

  await prisma.emergency.update({
    where: { id: emergencyId },
    data: { callStatus: CallStatus.ENDED, callEndedAt: new Date() },
  });

  const updated = await emergencyRepo.findEmergencyById(emergencyId);

  log(`emergency ${emergencyId}: call ENDED`);
  emergencyEvents.emit("callStatusChanged", {
    emergencyId,
    callStatus: CallStatus.ENDED,
    emergency: updated,
  });

  return updated!;
}
