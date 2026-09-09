// ============================================================================
// Realtime Synchronization Module — Unit + Integration Tests (Person 4)
// ============================================================================
// Run:  node_modules/.bin/tsx test-realtime.ts   (or npm run test:realtime)
//
// Boots the REAL Express app + Socket.IO gateway on an ephemeral port and
// exercises it with real socket.io-client connections. Lifecycle events are
// produced by the real Emergency Core service (DB-backed); Person 2/3 bridge
// contracts are exercised by emitting on the real `emergencyEvents` emitter
// (the bridge consumes the emitter contract — provenance is irrelevant).
//
// Covers: connection lifecycle, room join/leave, ack error handling, event
// broadcasting, event ordering (seq), multiple clients, room isolation,
// duplicate-delivery prevention, duplicate joins, reconnection + snapshot
// synchronization, event filtering, connection cleanup, and high-frequency
// event handling.
//
// Self-cleaning: created emergencies are deleted; the socket server is shut
// down; no Person 3 event handlers are registered (deterministic streams).
// ============================================================================

import "dotenv/config";
import http from "http";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { EmergencyStatus } from "@prisma/client";
import app from "./src/app";
import { prisma } from "./src/prisma/client";
import {
  initRealtime,
  shutdownRealtime,
  getIo,
  isValidRoomName,
  toEmergencyStatePayload,
  rooms,
} from "./src/services/realtime.service";
import {
  createEmergency,
  updateEmergencyStatus,
  emergencyEvents,
} from "./src/services/emergency.service";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits until fn() is truthy (poll @25ms) or times out. */
async function until(fn: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await sleep(25);
  }
  return fn();
}

const createdEmergencyIds: string[] = [];

async function makeEmergency() {
  const em = await createEmergency({
    patientId: "patient-arjun-001",
    patientLatitude: 28.6139,
    patientLongitude: 77.209,
    emergencyType: "Realtime Test [P4-TEST]",
    patientAge: 34,
    patientAllergies: ["Penicillin"],
  });
  createdEmergencyIds.push(em.id);
  return em;
}

// --------------------------------------------------------------------------
// Client helpers
// --------------------------------------------------------------------------

let PORT = 0;

function connectClient(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioc(`http://localhost:${PORT}`, {
      transports: ["websocket"],
      reconnection: false,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

function emitAck<T = any>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

/** Collects every delivery of the named events into arrays. */
function collect(socket: ClientSocket, events: string[]) {
  const bag: Record<string, any[]> = {};
  for (const e of events) {
    bag[e] = [];
    socket.on(e, (p: any) => bag[e].push(p));
  }
  return bag;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  // ───────────────────────── UNIT ─────────────────────────
  console.log("\n── Unit: room name validation ──");
  ok("emergency room valid", isValidRoomName("emergency:a37af471-0f71-4a2a"));
  ok("patient room valid", isValidRoomName("patient:patient-arjun-001"));
  ok("hospital room valid", isValidRoomName("hospital:hosp-001"));
  ok("dispatch valid", isValidRoomName("dispatch"));
  ok("unknown kind invalid", !isValidRoomName("admin:1"));
  ok("missing id invalid", !isValidRoomName("emergency:"));
  ok("non-string invalid", !isValidRoomName(42));
  ok("injection-ish name invalid", !isValidRoomName("emergency:*"));

  console.log("\n── Unit: payload contract mapping ──");
  {
    const raw: any = {
      id: "em-1",
      status: EmergencyStatus.SOS_TRIGGERED,
      severity: null,
      emergencyType: "Cardiac",
      etaMinutes: 5,
      assignedAmbulanceId: null,
      assignedHospitalId: null,
      patientId: "p-1",
      patientName: "A",
      patientAge: 30,
      patientSex: "M",
      patientBloodGroup: "O+",
      patientAllergies: ["X"],
      patientConditions: [],
      criticalAlert: "X Allergy",
      patientLatitude: 1,
      patientLongitude: 2,
      patientAddress: null,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      // raw Prisma noise that must NOT leak onto the wire:
      patient: { fullName: "A", phoneNumber: "123" },
      timelineEvents: [{}],
      hospitalCandidates: [{}],
      createdAt: new Date(),
    };
    const dto: any = toEmergencyStatePayload(raw, 7);
    ok("DTO carries contract fields", dto.emergencyId === "em-1" && dto.seq === 7 && dto.patient.criticalAlert === "X Allergy");
    ok("DTO does not leak raw relations", dto.timelineEvents === undefined && dto.hospitalCandidates === undefined && dto.patient.phoneNumber === undefined);
    ok("timestamps are ISO strings", dto.updatedAt === "2026-01-01T00:00:00.000Z");
  }

  // ───────────────────────── BOOT ─────────────────────────
  console.log("\n── Integration: boot gateway on ephemeral port ──");
  const server = http.createServer(app);
  initRealtime(server);
  ok("initRealtime is idempotent (same instance)", initRealtime(server) === getIo());
  await new Promise<void>((r) => server.listen(0, r));
  PORT = (server.address() as any).port;
  ok("gateway listening", PORT > 0, `port ${PORT}`);

  // ─────────────────── CONNECTION + ROOM VALIDATION ───────────────────
  console.log("\n── Integration: connection + subscription validation ──");
  const patientClient = await connectClient();
  ok("client connects", patientClient.connected);

  ok("invalid room → INVALID_ROOM", (await emitAck(patientClient, "subscribe", { room: "bogus" })).error?.code === "INVALID_ROOM");
  ok("malformed payload → INVALID_ROOM", (await emitAck(patientClient, "subscribe", null)).error?.code === "INVALID_ROOM");
  ok("unknown emergency room → EMERGENCY_NOT_FOUND", (await emitAck(patientClient, "subscribe", { room: "emergency:00000000-0000-0000-0000-000000000000" })).error?.code === "EMERGENCY_NOT_FOUND");
  ok("unknown hospital room → HOSPITAL_NOT_FOUND", (await emitAck(patientClient, "subscribe", { room: "hospital:no-such" })).error?.code === "HOSPITAL_NOT_FOUND");
  ok("valid patient room join", (await emitAck(patientClient, "subscribe", { room: "patient:patient-arjun-001" })).success === true);

  // ─────────────────── CREATE + SNAPSHOT ON JOIN ───────────────────
  console.log("\n── Integration: emergencyCreated + snapshot on join ──");
  const patientBag = collect(patientClient, ["emergency:created", "emergency:status", "emergency:snapshot"]);
  const em1 = await makeEmergency();
  ok("patient room receives emergency:created", await until(() => patientBag["emergency:created"].length === 1));
  ok("created payload is the stable DTO", patientBag["emergency:created"][0]?.emergencyId === em1.id && patientBag["emergency:created"][0]?.patient?.patientId === "patient-arjun-001");

  const joinAck = await emitAck(patientClient, "subscribe", { room: rooms.emergency(em1.id) });
  ok("emergency room join acked", joinAck.success === true && joinAck.data?.alreadyJoined === false);
  ok("snapshot delivered on join", await until(() => patientBag["emergency:snapshot"].length === 1));
  const snap0 = patientBag["emergency:snapshot"][0];
  ok("snapshot carries state + timeline + candidates", snap0?.status === "SOS_TRIGGERED" && Array.isArray(snap0?.timeline) && snap0?.timeline.length === 1 && Array.isArray(snap0?.hospitalCandidates));

  // ─────────────────── BROADCAST, ORDERING, DUPLICATES ───────────────────
  console.log("\n── Integration: broadcasting, ordering, duplicate prevention ──");
  const dispatcher = await connectClient();
  await emitAck(dispatcher, "subscribe", { room: "dispatch" });
  // dispatcher ALSO joins the emergency room — must still get each event once
  await emitAck(dispatcher, "subscribe", { room: rooms.emergency(em1.id) });
  const dispatchBag = collect(dispatcher, ["emergency:status", "emergency:severity", "emergency:completed", "emergency:eta", "ambulance:assigned"]);

  // isolation control: a client watching a DIFFERENT emergency
  const em2 = await makeEmergency();
  const outsider = await connectClient();
  await emitAck(outsider, "subscribe", { room: rooms.emergency(em2.id) });
  const outsiderBag = collect(outsider, ["emergency:status", "emergency:eta", "emergency:created"]);

  await updateEmergencyStatus(em1.id, { status: EmergencyStatus.AMBULANCE_ASSIGNED });
  await updateEmergencyStatus(em1.id, { status: EmergencyStatus.AMBULANCE_EN_ROUTE });
  await updateEmergencyStatus(em1.id, { status: EmergencyStatus.PATIENT_PICKED_UP });
  await updateEmergencyStatus(em1.id, { status: EmergencyStatus.SEVERITY_SELECTED, severity: "RED" });

  ok("all status events delivered", await until(() => dispatchBag["emergency:status"].length === 4));
  {
    const seqs = dispatchBag["emergency:status"].map((p: any) => p.seq);
    ok("events arrive in lifecycle order", dispatchBag["emergency:status"].map((p: any) => p.status).join(",") === "AMBULANCE_ASSIGNED,AMBULANCE_EN_ROUTE,PATIENT_PICKED_UP,SEVERITY_SELECTED");
    ok("seq strictly increasing", seqs.every((s: number, i: number) => i === 0 || s > seqs[i - 1]), seqs.join(","));
    ok("exactly ONE copy per event despite dual-room membership", dispatchBag["emergency:status"].length === 4);
  }
  ok("severity alias emitted on SEVERITY_SELECTED", await until(() => dispatchBag["emergency:severity"].length === 1) && dispatchBag["emergency:severity"][0]?.severity === "RED");
  ok("room isolation: outsider saw none of em1's events", outsiderBag["emergency:status"].length === 0);

  // ─────────────────── P2/P3 BRIDGE CONTRACTS (synthetic) ───────────────────
  console.log("\n── Integration: ambulance + hospital event bridging ──");
  const crew = await connectClient();
  await emitAck(crew, "subscribe", { room: "ambulance:amb-001" });
  const crewBag = collect(crew, ["ambulance:assigned"]);

  const hospA = await connectClient();
  await emitAck(hospA, "subscribe", { room: "hospital:hosp-001" });
  const hospABag = collect(hospA, ["hospital:requestSent", "hospital:reassigned", "hospital:accepted"]);
  const hospB = await connectClient();
  await emitAck(hospB, "subscribe", { room: "hospital:hosp-002" });
  const hospBBag = collect(hospB, ["hospital:requestSent", "hospital:reassigned"]);

  emergencyEvents.emit("ambulanceAssigned", { emergencyId: em1.id, ambulanceId: "amb-001", vehicleNo: "DL-3C-AM-4521", distanceKm: 1.2, etaMinutes: 3, emergency: { patientId: "patient-arjun-001" } });
  ok("crew room receives ambulance:assigned", await until(() => crewBag["ambulance:assigned"].length === 1) && crewBag["ambulance:assigned"][0]?.vehicleNo === "DL-3C-AM-4521");

  emergencyEvents.emit("hospitalRequestSent", { emergencyId: em1.id, hospitalId: "hosp-001", rank: 1, emergencyType: "X", severity: null, patientAge: 34, criticalAlert: null, estimatedArrivalMinutes: 9, requiredServices: ["ICU"] });
  ok("hospital inbox push received", await until(() => hospABag["hospital:requestSent"].length === 1) && hospABag["hospital:requestSent"][0]?.rank === 1);
  ok("event filtering: other hospital got no request", hospBBag["hospital:requestSent"].length === 0);

  emergencyEvents.emit("hospitalReassigned", { emergencyId: em1.id, hospitalId: "hosp-001", hospitalName: "AIIMS", rank: 1, previousHospitalId: "hosp-002", emergency: null });
  ok("displaced hospital notified of reassignment", await until(() => hospBBag["hospital:reassigned"].length === 1) && hospBBag["hospital:reassigned"][0]?.previousHospitalId === "hosp-002");
  ok("new hospital notified of reassignment", await until(() => hospABag["hospital:reassigned"].length === 1));

  // ─────────────────── DUPLICATE JOIN ───────────────────
  console.log("\n── Integration: duplicate join is idempotent ──");
  {
    const again = await emitAck(patientClient, "subscribe", { room: rooms.emergency(em1.id) });
    ok("re-join acked with alreadyJoined=true", again.success === true && again.data?.alreadyJoined === true);
    const before = patientBag["emergency:status"].length;
    await updateEmergencyStatus(em1.id, { status: EmergencyStatus.HOSPITAL_SEARCHING });
    await until(() => patientBag["emergency:status"].length > before);
    ok("still exactly one delivery per event", patientBag["emergency:status"].length === before + 1);
  }

  // ─────────────────── UNSUBSCRIBE / EVENT FILTERING ───────────────────
  console.log("\n── Integration: unsubscribe stops delivery ──");
  {
    ok("unsubscribe acked", (await emitAck(dispatcher, "unsubscribe", { room: "dispatch" })).success === true);
    await emitAck(dispatcher, "unsubscribe", { room: rooms.emergency(em1.id) });
    const before = dispatchBag["emergency:status"].length;
    await updateEmergencyStatus(em1.id, { status: EmergencyStatus.HOSPITAL_ACCEPTANCE_REQUESTED });
    await sleep(300);
    ok("no events after leaving all rooms", dispatchBag["emergency:status"].length === before);
  }

  // ─────────────────── RECONNECTION + STATE SYNC ───────────────────
  console.log("\n── Integration: reconnection recovers current state ──");
  {
    patientClient.disconnect();
    await until(() => !patientClient.connected);
    // Emergency progresses while the client is offline:
    await updateEmergencyStatus(em1.id, { status: EmergencyStatus.HOSPITAL_ACCEPTED, assignedHospitalId: "hosp-001" });

    const reconnected = await connectClient(); // fresh connection = real reconnect
    const reconBag = collect(reconnected, ["emergency:snapshot"]);
    await emitAck(reconnected, "subscribe", { room: rooms.emergency(em1.id) });
    ok("snapshot on re-join reflects state missed offline", await until(() => reconBag["emergency:snapshot"][0]?.status === "HOSPITAL_ACCEPTED"), reconBag["emergency:snapshot"][0]?.status);
    ok("snapshot carries assigned hospital", reconBag["emergency:snapshot"][0]?.assignedHospitalId === "hosp-001");

    const syncAck = await emitAck(reconnected, "sync", { emergencyId: em1.id });
    ok("explicit sync returns the authoritative snapshot", syncAck.success === true && syncAck.data?.status === "HOSPITAL_ACCEPTED");
    ok("sync for unknown emergency → EMERGENCY_NOT_FOUND", (await emitAck(reconnected, "sync", { emergencyId: "00000000-0000-0000-0000-000000000000" })).error?.code === "EMERGENCY_NOT_FOUND");
    reconnected.disconnect();
  }

  // ─────────────────── COMPLETION ALIAS ───────────────────
  console.log("\n── Integration: completion alias ──");
  {
    const watcher = await connectClient();
    const wBag = collect(watcher, ["emergency:completed", "emergency:status"]);
    await emitAck(watcher, "subscribe", { room: rooms.emergency(em1.id) });
    await updateEmergencyStatus(em1.id, { status: EmergencyStatus.HOSPITAL_NOTIFIED });
    await updateEmergencyStatus(em1.id, { status: EmergencyStatus.EN_ROUTE_TO_HOSPITAL });
    await updateEmergencyStatus(em1.id, { status: EmergencyStatus.ARRIVED });
    ok("emergency:completed fired on ARRIVED", await until(() => wBag["emergency:completed"].length === 1) && wBag["emergency:completed"][0]?.outcome === "ARRIVED");
    watcher.disconnect();
  }

  // ─────────────────── HIGH-FREQUENCY EVENTS ───────────────────
  console.log("\n── Integration: high-frequency event handling ──");
  {
    const heavy = await connectClient();
    const hBag = collect(heavy, ["emergency:eta"]);
    await emitAck(heavy, "subscribe", { room: rooms.emergency(em2.id) });
    const N = 200;
    for (let i = 1; i <= N; i++) {
      emergencyEvents.emit("etaUpdated", { emergencyId: em2.id, etaMinutes: i, previousEtaMinutes: i - 1 });
    }
    ok(`all ${N} rapid events delivered`, await until(() => hBag["emergency:eta"].length === N, 6000), `${hBag["emergency:eta"].length}/${N}`);
    const etas = hBag["emergency:eta"].map((p: any) => p.etaMinutes);
    ok("high-frequency events preserved order", etas.every((v: number, i: number) => v === i + 1));
    const seqs = hBag["emergency:eta"].map((p: any) => p.seq);
    ok("seq strictly increasing under load", seqs.every((s: number, i: number) => i === 0 || s > seqs[i - 1]));
    heavy.disconnect();
  }

  // ─────────────────── CONNECTION CLEANUP ───────────────────
  console.log("\n── Integration: connection cleanup ──");
  {
    const io = getIo()!;
    const temp = await connectClient();
    await emitAck(temp, "subscribe", { room: rooms.emergency(em2.id) });
    const withTemp = io.engine.clientsCount;
    temp.disconnect();
    ok("disconnect removes the client", await until(() => io.engine.clientsCount === withTemp - 1), `${io.engine.clientsCount} clients`);
    const inRoom = await io.in(rooms.emergency(em2.id)).fetchSockets();
    ok("disconnected socket left its rooms", !inRoom.some((s) => s.id === temp.id));
  }

  // teardown clients
  for (const c of [patientClient, dispatcher, outsider, crew, hospA, hospB]) c.disconnect();
  await new Promise<void>((r) => server.close(() => r()));
}

main()
  .then(async () => {
    await shutdownRealtime();
    for (const id of createdEmergencyIds) {
      await prisma.emergency.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("\n" + "═".repeat(56));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═".repeat(56));
    if (failed > 0) {
      console.log("FAILED:", failures.join(", "));
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("TEST RUNNER ERROR:", e);
    await shutdownRealtime().catch(() => {});
    for (const id of createdEmergencyIds) {
      await prisma.emergency.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
    process.exit(1);
  });
