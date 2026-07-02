// ============================================================================
// Realtime Synchronization Service (Person 4)
// ============================================================================
// The communication layer of Docsahab: a Socket.IO gateway attached to the
// EXISTING Express HTTP server that consumes the foundation's
// `emergencyEvents` emitter and broadcasts stable payload contracts to
// logical rooms.
//
// This module is intentionally dumb:
//   - It owns NO business logic and NO lifecycle transitions.
//   - It never writes to the database (reads only, for room validation and
//     reconnection snapshots).
//   - It subscribes to the same event seam Person 1/2/3 already emit on —
//     no second event bus, no polling of the DB.
//
// Rooms:
//   emergency:{emergencyId}  — everyone following one emergency
//   patient:{patientId}      — a patient's own channel (learns of new SOS)
//   ambulance:{ambulanceId}  — a crew's own channel (learns of assignment)
//   hospital:{hospitalId}    — a hospital console (receives request pushes)
//   dispatch                 — dispatcher overview (every emergency)
//
// Delivery guarantees:
//   - Broadcasts use Socket.IO room-union semantics (`io.to([rooms]).emit`):
//     a socket subscribed to several target rooms receives each event ONCE.
//   - Every emergency-scoped payload carries a per-emergency monotonic `seq`;
//     clients drop anything older than what they have and re-baseline from
//     the `emergency:snapshot` they receive on (re)joining a room.
//   - Node's EventEmitter is synchronous, so broadcast order matches domain
//     emission order within this process. (Multi-instance ordering later
//     comes from the Redis adapter + `seq` — see scalability notes.)
//
// Redis / multi-instance readiness: all fan-out goes through `io.to(...)`,
// which is exactly the surface the official @socket.io/redis-adapter
// replaces. Attach the adapter in initRealtime() and move the seq counter to
// a shared store — no other change is required.
//
// Future authentication: `canJoinRoom()` is the single integration point.
// JWT middleware can decorate the socket during the handshake
// (socket.handshake.auth) and this hook can then restrict room access.
// ============================================================================

import type { Server as HttpServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { EmergencyStatus } from "../enums/emergency-status.enum";
import { emergencyEvents } from "./emergency.service";
import * as emergencyRepo from "../repositories/emergency.repository";
import * as ambulanceRepo from "../repositories/ambulance.repository";
import * as hospitalRepo from "../repositories/hospital.repository";
import { realtimeConfig } from "../config/realtime.config";
import {
  REALTIME_EVENTS,
  type Ack,
  type EmergencySnapshotPayload,
  type EmergencyStatePayload,
  type TimelineEventPayload,
} from "../types/realtime.types";

const log = (message: string, meta?: unknown) =>
  console.log(`[realtime] ${message}`, meta ?? "");

// --------------------------------------------------------------------------
// Module state
// --------------------------------------------------------------------------

let io: SocketIOServer | null = null;

/** Per-emergency monotonic sequence counters (single-instance; move to a
 *  shared store when the Redis adapter is attached). */
const seqCounters = new Map<string, number>();

/** Bridge handler refs so shutdownRealtime() can detach them cleanly. */
const bridgeHandlers: Array<{ event: string; handler: (p: any) => void }> = [];

function nextSeq(emergencyId: string): number {
  const next = (seqCounters.get(emergencyId) ?? 0) + 1;
  seqCounters.set(emergencyId, next);
  return next;
}

function currentSeq(emergencyId: string): number {
  return seqCounters.get(emergencyId) ?? 0;
}

// --------------------------------------------------------------------------
// Room naming + validation
// --------------------------------------------------------------------------

const ROOM_PATTERN = /^(emergency|patient|ambulance|hospital):[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const rooms = {
  emergency: (id: string) => `emergency:${id}` as const,
  patient: (id: string) => `patient:${id}` as const,
  ambulance: (id: string) => `ambulance:${id}` as const,
  hospital: (id: string) => `hospital:${id}` as const,
  dispatch: "dispatch" as const,
};

/** Pure: is this a syntactically valid room name? (exported for unit tests) */
export function isValidRoomName(room: unknown): room is string {
  if (typeof room !== "string") return false;
  return room === rooms.dispatch || ROOM_PATTERN.test(room);
}

/**
 * FUTURE-AUTH SEAM. Once JWT middleware authenticates the handshake, this is
 * the single place to restrict access (e.g. a patient token may only join its
 * own patient/emergency rooms). Today: allow all (no auth exists anywhere in
 * Docsahab yet — documented platform gap, not a Person 4 decision).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function canJoinRoom(_socket: Socket, _room: string): boolean {
  return true;
}

/** Existence check for the entity a room refers to (reads via repositories). */
async function roomEntityExists(room: string): Promise<boolean> {
  if (room === rooms.dispatch) return true;
  const [kind, id] = room.split(":", 2);
  switch (kind) {
    case "emergency":
      return (await emergencyRepo.findEmergencyById(id)) !== null;
    case "patient":
      return (await emergencyRepo.findPatientById(id)) !== null;
    case "ambulance":
      return (await ambulanceRepo.findAmbulanceById(id)) !== null;
    case "hospital":
      return (await hospitalRepo.findHospitalById(id)) !== null;
    default:
      return false;
  }
}

// --------------------------------------------------------------------------
// Payload mapping (raw domain objects → stable wire contracts)
// --------------------------------------------------------------------------

type RawEmergency = NonNullable<
  Awaited<ReturnType<typeof emergencyRepo.findEmergencyById>>
>;

/** Maps a (fully-included) emergency to the stable state DTO. Never leaks
 *  raw Prisma relations onto the wire. (exported for unit tests) */
export function toEmergencyStatePayload(
  emergency: RawEmergency,
  seq: number
): EmergencyStatePayload {
  return {
    emergencyId: emergency.id,
    status: emergency.status,
    severity: emergency.severity,
    emergencyType: emergency.emergencyType,
    etaMinutes: emergency.etaMinutes,
    assignedAmbulanceId: emergency.assignedAmbulanceId,
    assignedHospitalId: emergency.assignedHospitalId,
    patient: {
      patientId: emergency.patientId,
      name: emergency.patientName,
      age: emergency.patientAge,
      sex: emergency.patientSex,
      bloodGroup: emergency.patientBloodGroup,
      allergies: emergency.patientAllergies,
      conditions: emergency.patientConditions,
      criticalAlert: emergency.criticalAlert,
    },
    location: {
      latitude: emergency.patientLatitude,
      longitude: emergency.patientLongitude,
      address: emergency.patientAddress,
    },
    updatedAt: emergency.updatedAt.toISOString(),
    seq,
  };
}

function toTimelinePayload(t: {
  status: EmergencyStatus;
  label: string;
  description: string | null;
  createdAt: Date;
}): TimelineEventPayload {
  return {
    status: t.status,
    label: t.label,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  };
}

async function buildSnapshot(
  emergencyId: string
): Promise<EmergencySnapshotPayload | null> {
  const emergency = await emergencyRepo.findEmergencyById(emergencyId);
  if (!emergency) return null;
  return {
    ...toEmergencyStatePayload(emergency, currentSeq(emergencyId)),
    timeline: emergency.timelineEvents.map(toTimelinePayload),
    hospitalCandidates: emergency.hospitalCandidates.map((c) => ({
      hospitalId: c.hospitalId,
      hospitalName: c.hospitalName,
      rank: c.rank,
      response: c.response,
      respondedAt: c.respondedAt ? c.respondedAt.toISOString() : null,
    })),
  };
}

// --------------------------------------------------------------------------
// Broadcasting
// --------------------------------------------------------------------------

/**
 * Emits one event to the union of the given rooms. Socket.IO deduplicates
 * across rooms, so a dispatcher who also joined the emergency room still
 * receives the event exactly once. Payload is serialized once by Socket.IO.
 */
function broadcast(targetRooms: string[], event: string, payload: unknown) {
  if (!io) return;
  const targets = targetRooms.filter(Boolean);
  if (targets.length === 0) return;
  io.to(targets).emit(event, payload);
}

/** Standard room set for anything scoped to one emergency. */
function emergencyRooms(emergency: {
  id: string;
  patientId: string;
  assignedAmbulanceId: string | null;
  assignedHospitalId: string | null;
}): string[] {
  const targets: string[] = [
    rooms.emergency(emergency.id),
    rooms.patient(emergency.patientId),
    rooms.dispatch,
  ];
  if (emergency.assignedAmbulanceId)
    targets.push(rooms.ambulance(emergency.assignedAmbulanceId));
  if (emergency.assignedHospitalId)
    targets.push(rooms.hospital(emergency.assignedHospitalId));
  return targets;
}

// --------------------------------------------------------------------------
// Domain-event bridge (emergencyEvents → Socket.IO rooms)
// --------------------------------------------------------------------------

function on(event: string, handler: (payload: any) => void) {
  // Every handler is wrapped: a realtime failure must never propagate back
  // into the lifecycle write that emitted the event.
  const safe = (payload: any) => {
    try {
      handler(payload);
    } catch (e) {
      log(`bridge handler for '${event}' failed: ${(e as Error).message}`);
    }
  };
  emergencyEvents.on(event, safe);
  bridgeHandlers.push({ event, handler: safe });
}

function registerBridge() {
  // ---- Person 1: Emergency Core ----
  on("emergencyCreated", ({ emergency }) => {
    if (!emergency) return;
    const payload = toEmergencyStatePayload(emergency, nextSeq(emergency.id));
    broadcast(
      emergencyRooms(emergency),
      REALTIME_EVENTS.EMERGENCY_CREATED,
      payload
    );
  });

  on("statusChanged", ({ emergency, previousStatus, newStatus, timelineEvent }) => {
    if (!emergency) return;
    const seq = nextSeq(emergency.id);
    const targets = emergencyRooms(emergency);
    const payload = {
      ...toEmergencyStatePayload(emergency, seq),
      previousStatus: previousStatus ?? null,
      timelineEvent: timelineEvent ? toTimelinePayload(timelineEvent) : null,
    };

    broadcast(targets, REALTIME_EVENTS.EMERGENCY_STATUS, payload);

    // Semantic aliases required by the realtime contract.
    if (newStatus === EmergencyStatus.SEVERITY_SELECTED) {
      broadcast(targets, REALTIME_EVENTS.EMERGENCY_SEVERITY, payload);
    }
    if (
      newStatus === EmergencyStatus.ARRIVED ||
      newStatus === EmergencyStatus.CANCELLED
    ) {
      broadcast(targets, REALTIME_EVENTS.EMERGENCY_COMPLETED, {
        ...payload,
        outcome: newStatus,
      });
      seqCounters.delete(emergency.id); // terminal — release the counter
    }
  });

  // ---- Person 2: Ambulance Matching ----
  on("ambulanceAssigned", (p) => {
    const targets: string[] = [
      rooms.emergency(p.emergencyId),
      rooms.ambulance(p.ambulanceId),
      rooms.dispatch,
    ];
    if (p.emergency?.patientId) targets.push(rooms.patient(p.emergency.patientId));
    broadcast(targets, REALTIME_EVENTS.AMBULANCE_ASSIGNED, {
      emergencyId: p.emergencyId,
      ambulanceId: p.ambulanceId,
      vehicleNo: p.vehicleNo,
      distanceKm: p.distanceKm,
      etaMinutes: p.etaMinutes,
      seq: nextSeq(p.emergencyId),
    });
  });

  on("etaUpdated", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.dispatch],
      REALTIME_EVENTS.EMERGENCY_ETA,
      {
        emergencyId: p.emergencyId,
        etaMinutes: p.etaMinutes,
        previousEtaMinutes: p.previousEtaMinutes ?? null,
        seq: nextSeq(p.emergencyId),
      }
    );
  });

  // ---- Person 3: Hospital Ranking & Acceptance ----
  on("hospitalSearchStarted", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_SEARCH_STARTED,
      { ...p, seq: nextSeq(p.emergencyId) }
    );
  });

  on("hospitalCandidatesRanked", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_CANDIDATES_RANKED,
      { ...p, seq: nextSeq(p.emergencyId) }
    );
  });

  on("hospitalRequestSent", (p) => {
    // The hospital console's push notification — the reason hospital rooms exist.
    broadcast(
      [rooms.hospital(p.hospitalId), rooms.emergency(p.emergencyId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_REQUEST_SENT,
      { ...p, seq: nextSeq(p.emergencyId) }
    );
  });

  on("hospitalAccepted", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.hospital(p.hospitalId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_ACCEPTED,
      {
        emergencyId: p.emergencyId,
        hospitalId: p.hospitalId,
        hospitalName: p.hospitalName ?? null,
        rank: p.rank,
        seq: nextSeq(p.emergencyId),
      }
    );
  });

  on("hospitalRejected", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.hospital(p.hospitalId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_REJECTED,
      { ...p, seq: nextSeq(p.emergencyId) }
    );
  });

  on("hospitalAssigned", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.hospital(p.hospitalId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_ASSIGNED,
      {
        emergencyId: p.emergencyId,
        hospitalId: p.hospitalId,
        hospitalName: p.hospitalName ?? null,
        rank: p.rank,
        seq: nextSeq(p.emergencyId),
      }
    );
  });

  on("hospitalReassigned", (p) => {
    const targets: string[] = [
      rooms.emergency(p.emergencyId),
      rooms.hospital(p.hospitalId),
      rooms.dispatch,
    ];
    // The displaced hospital must learn it lost the assignment.
    if (p.previousHospitalId) targets.push(rooms.hospital(p.previousHospitalId));
    broadcast(targets, REALTIME_EVENTS.HOSPITAL_REASSIGNED, {
      emergencyId: p.emergencyId,
      hospitalId: p.hospitalId,
      hospitalName: p.hospitalName ?? null,
      rank: p.rank,
      previousHospitalId: p.previousHospitalId,
      seq: nextSeq(p.emergencyId),
    });
  });

  on("hospitalAssignmentLocked", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.hospital(p.hospitalId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_LOCKED,
      { ...p, seq: nextSeq(p.emergencyId) }
    );
  });

  on("hospitalNotified", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.hospital(p.hospitalId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_NOTIFIED,
      {
        emergencyId: p.emergencyId,
        hospitalId: p.hospitalId,
        severity: p.severity ?? null,
        patientOnboard: true,
        etaMinutes: p.etaMinutes,
        criticalAlert: p.criticalAlert ?? null,
        seq: nextSeq(p.emergencyId),
      }
    );
  });

  on("hospitalSearchExhausted", (p) => {
    broadcast(
      [rooms.emergency(p.emergencyId), rooms.dispatch],
      REALTIME_EVENTS.HOSPITAL_SEARCH_EXHAUSTED,
      { ...p, seq: nextSeq(p.emergencyId) }
    );
  });

  log(`domain-event bridge registered (${bridgeHandlers.length} events)`);
}

// --------------------------------------------------------------------------
// Connection lifecycle
// --------------------------------------------------------------------------

function ackError<T = never>(code: string, message: string): Ack<T> {
  return { success: false, error: { code, message } };
}

function handleConnection(socket: Socket) {
  log(`connected ${socket.id} (transport=${socket.conn.transport.name}, clients=${io?.engine.clientsCount})`);

  // ---- subscribe { room } → ack; emergency rooms also get a snapshot ----
  socket.on("subscribe", async (payload: unknown, ack?: (a: Ack<{ room: string; alreadyJoined: boolean }>) => void) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const room = (payload as { room?: unknown })?.room;
      if (!isValidRoomName(room)) {
        reply(ackError("INVALID_ROOM", "Room must be 'dispatch' or '<kind>:<id>' with kind ∈ emergency|patient|ambulance|hospital"));
        return;
      }
      if (!canJoinRoom(socket, room)) {
        reply(ackError("ROOM_FORBIDDEN", `Not authorized to join ${room}`));
        return;
      }
      if (socket.rooms.size - 1 >= realtimeConfig.maxRoomsPerSocket) {
        reply(ackError("ROOM_LIMIT_EXCEEDED", `A client may join at most ${realtimeConfig.maxRoomsPerSocket} rooms`));
        return;
      }
      if (!(await roomEntityExists(room))) {
        const kind = room.split(":")[0].toUpperCase();
        reply(ackError(`${kind}_NOT_FOUND`, `No such ${room.split(":")[0]} for room ${room}`));
        return;
      }

      const alreadyJoined = socket.rooms.has(room);
      await socket.join(room); // idempotent — never duplicates delivery
      log(`join ${socket.id} → ${room}${alreadyJoined ? " (already joined)" : ""}`);

      // Reconnection recovery: an emergency-room join always delivers the
      // authoritative current state to THIS socket only. Clients re-baseline
      // from the snapshot instead of trusting missed events.
      if (room.startsWith("emergency:")) {
        const snapshot = await buildSnapshot(room.slice("emergency:".length));
        if (snapshot) {
          socket.emit(REALTIME_EVENTS.EMERGENCY_SNAPSHOT, snapshot);
        }
      }

      reply({ success: true, data: { room, alreadyJoined } });
    } catch (e) {
      log(`subscribe failed for ${socket.id}: ${(e as Error).message}`);
      reply(ackError("INTERNAL_ERROR", "Subscription failed"));
    }
  });

  // ---- unsubscribe { room } → ack ----
  socket.on("unsubscribe", async (payload: unknown, ack?: (a: Ack<{ room: string }>) => void) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const room = (payload as { room?: unknown })?.room;
      if (!isValidRoomName(room)) {
        reply(ackError("INVALID_ROOM", "Invalid room name"));
        return;
      }
      await socket.leave(room);
      log(`leave ${socket.id} ← ${room}`);
      reply({ success: true, data: { room } });
    } catch (e) {
      reply(ackError("INTERNAL_ERROR", "Unsubscribe failed"));
    }
  });

  // ---- sync { emergencyId } → ack carries the snapshot ----
  socket.on("sync", async (payload: unknown, ack?: (a: Ack<EmergencySnapshotPayload>) => void) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const emergencyId = (payload as { emergencyId?: unknown })?.emergencyId;
      if (typeof emergencyId !== "string" || emergencyId.length === 0) {
        reply(ackError("INVALID_REQUEST", "emergencyId is required"));
        return;
      }
      const snapshot = await buildSnapshot(emergencyId);
      if (!snapshot) {
        reply(ackError("EMERGENCY_NOT_FOUND", `Emergency ${emergencyId} not found`));
        return;
      }
      reply({ success: true, data: snapshot });
    } catch (e) {
      log(`sync failed for ${socket.id}: ${(e as Error).message}`);
      reply(ackError("INTERNAL_ERROR", "Sync failed"));
    }
  });

  socket.on("disconnect", (reason) => {
    // Socket.IO removes the socket from all rooms automatically — no manual
    // cleanup, no leaked subscriptions.
    log(`disconnected ${socket.id} (${reason}, clients=${io?.engine.clientsCount})`);
  });
}

// --------------------------------------------------------------------------
// Lifecycle: init / accessor / shutdown
// --------------------------------------------------------------------------

/**
 * Attaches Socket.IO to the existing HTTP server and wires the domain-event
 * bridge. Idempotent — calling twice returns the existing instance (no
 * duplicate listeners, no duplicate delivery).
 *
 * Multi-instance deployment: attach the Redis adapter here —
 *   io.adapter(createAdapter(pubClient, subClient))
 * — and replace the in-memory seq counter with a shared one. Nothing else
 * in this module changes.
 */
export function initRealtime(httpServer: HttpServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: realtimeConfig.path,
    cors: {
      origin: realtimeConfig.corsOrigin,
      methods: ["GET", "POST"],
    },
    pingInterval: realtimeConfig.pingIntervalMs,
    pingTimeout: realtimeConfig.pingTimeoutMs,
  });

  io.on("connection", handleConnection);
  registerBridge();

  log(`Socket.IO attached (path=${realtimeConfig.path})`);
  return io;
}

/** The live Socket.IO server (null before initRealtime). */
export function getIo(): SocketIOServer | null {
  return io;
}

/**
 * Detaches the bridge and closes the Socket.IO server. Used by tests and
 * graceful shutdown; safe to call when never initialized.
 */
export async function shutdownRealtime(): Promise<void> {
  for (const { event, handler } of bridgeHandlers) {
    emergencyEvents.off(event, handler);
  }
  bridgeHandlers.length = 0;
  seqCounters.clear();
  if (io) {
    await io.close();
    io = null;
    log("Socket.IO server closed");
  }
}
