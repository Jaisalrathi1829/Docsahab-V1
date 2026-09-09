// ============================================================================
// Ambulance Matching Module — Unit + Integration Tests
// ============================================================================
// Run:  node_modules/.bin/tsx test-ambulance.ts
//
// Unit tests cover the pure logic (haversine, ETA, nearest selection).
// Integration tests exercise the real Prisma DB: assignment, transactions,
// status updates, events, error paths, and concurrency protection.
// Self-cleaning: created emergencies are deleted and ambulance availability is
// restored to its pre-test snapshot.
// ============================================================================

import "dotenv/config";
import { EmergencyStatus, type Ambulance } from "@prisma/client";
import { prisma } from "./src/prisma/client";
import { AppError } from "./src/middleware/error-handler.middleware";
import { haversineDistanceKm } from "./src/utils/haversine";
import {
  selectNearestAmbulance,
  estimateEtaMinutes,
  assignNearestAmbulance,
  listAmbulances,
} from "./src/services/ambulance.service";
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

async function expectCode(label: string, code: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(label, false, "no error thrown");
  } catch (e) {
    const actual = e instanceof AppError ? e.code : (e as Error).message;
    ok(label, e instanceof AppError && e.code === code, `got ${actual}`);
  }
}

const fakeAmbulance = (id: string, lat: number, lng: number): Ambulance => ({
  id,
  vehicleNo: `TEST-${id}`,
  latitude: lat,
  longitude: lng,
  isAvailable: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createdEmergencyIds: string[] = [];

async function makeEmergency(lat: number, lng: number) {
  const em = await createEmergency({
    patientId: "patient-arjun-001",
    patientLatitude: lat,
    patientLongitude: lng,
    emergencyType: "Cardiac Emergency",
  });
  createdEmergencyIds.push(em.id);
  return em;
}

async function main() {
  // ───────────────────────── UNIT ─────────────────────────
  console.log("\n── Unit: haversine ──");
  ok("same point = 0 km", haversineDistanceKm(28.6, 77.2, 28.6, 77.2) === 0);
  {
    const d = haversineDistanceKm(0, 0, 1, 0); // 1° latitude ≈ 111.19 km
    ok("1° latitude ≈ 111 km", d > 110 && d < 112, `${d.toFixed(2)} km`);
  }

  console.log("\n── Unit: ETA ──");
  ok("10 km @ 30 km/h = 20 min", estimateEtaMinutes(10) === 20);
  ok("0 km clamps to floor (1)", estimateEtaMinutes(0) === 1);
  ok(
    "configurable speed (10 km @ 60 km/h = 10 min)",
    estimateEtaMinutes(10, { averageSpeedKmph: 60, minimumEtaMinutes: 1 }) === 10
  );

  console.log("\n── Unit: nearest selection ──");
  {
    const fleet = [
      fakeAmbulance("far", 28.9, 77.5),
      fakeAmbulance("near", 28.61, 77.21),
      fakeAmbulance("mid", 28.7, 77.3),
    ];
    const sel = selectNearestAmbulance(fleet, 28.61, 77.21);
    ok("picks closest unit", sel?.ambulance.id === "near", sel?.ambulance.id);
  }
  ok("empty fleet → null", selectNearestAmbulance([], 28.6, 77.2) === null);
  await expectCode("invalid target coords → INVALID_COORDINATES", "INVALID_COORDINATES", async () =>
    selectNearestAmbulance([fakeAmbulance("a", 1, 1)], 999, 77)
  );

  // ───────────────────────── INTEGRATION SETUP ─────────────────────────
  const snapshot = await prisma.ambulance.findMany({
    select: { id: true, isAvailable: true },
  });
  ok("fleet is seeded (>0 ambulances)", snapshot.length > 0, `${snapshot.length} units`);

  // ───────────────────────── INTEGRATION ─────────────────────────
  console.log("\n── Integration: happy-path assignment ──");
  {
    // Capture events for this assignment.
    const events: Record<string, any> = {};
    const cap = (name: string) => (p: any) => (events[name] = p);
    const onAssigned = cap("ambulanceAssigned");
    const onEta = cap("etaUpdated");
    const onStatus = cap("statusChanged");
    emergencyEvents.on("ambulanceAssigned", onAssigned);
    emergencyEvents.on("etaUpdated", onEta);
    emergencyEvents.on("statusChanged", onStatus);

    const em = await makeEmergency(28.6139, 77.209); // Delhi center
    const available = await prisma.ambulance.findMany({ where: { isAvailable: true } });
    const expectedNearest = selectNearestAmbulance(available, 28.6139, 77.209);

    const result: any = await assignNearestAmbulance(em.id);

    ok("status → AMBULANCE_ASSIGNED", result.status === "AMBULANCE_ASSIGNED");
    ok("assignedAmbulanceId is set", !!result.assignedAmbulanceId, result.assignedAmbulanceId);
    ok(
      "nearest unit selected",
      result.assignedAmbulanceId === expectedNearest?.ambulance.id,
      `expected ${expectedNearest?.ambulance.id}`
    );
    ok(
      "etaMinutes is a positive integer",
      Number.isInteger(result.etaMinutes) && result.etaMinutes > 0,
      `${result.etaMinutes} min`
    );
    ok(
      "timeline has AMBULANCE_ASSIGNED event",
      result.timelineEvents.some((t: any) => t.status === "AMBULANCE_ASSIGNED")
    );

    const dbAmb = await prisma.ambulance.findUnique({
      where: { id: result.assignedAmbulanceId },
    });
    ok("assigned ambulance is now isAvailable=false", dbAmb?.isAvailable === false);

    ok("event: ambulanceAssigned emitted", events.ambulanceAssigned?.emergencyId === em.id);
    ok("event: ambulanceAssigned carries vehicleNo", !!events.ambulanceAssigned?.vehicleNo);
    ok("event: etaUpdated emitted", events.etaUpdated?.etaMinutes === result.etaMinutes);
    ok(
      "event: statusChanged → AMBULANCE_ASSIGNED",
      events.statusChanged?.newStatus === "AMBULANCE_ASSIGNED"
    );

    emergencyEvents.off("ambulanceAssigned", onAssigned);
    emergencyEvents.off("etaUpdated", onEta);
    emergencyEvents.off("statusChanged", onStatus);

    // Double assignment guard.
    console.log("\n── Integration: error paths ──");
    await expectCode("double assign → 409 ALREADY_HAS_AMBULANCE", "EMERGENCY_ALREADY_HAS_AMBULANCE", () =>
      assignNearestAmbulance(em.id)
    );
  }

  await expectCode("unknown emergency → 404", "EMERGENCY_NOT_FOUND", () =>
    assignNearestAmbulance("00000000-0000-0000-0000-000000000000")
  );

  {
    // Invalid status transition: cancel first, then try to assign.
    const em = await makeEmergency(28.6, 77.2);
    await updateEmergencyStatus(em.id, { status: EmergencyStatus.CANCELLED });
    await expectCode("assign on CANCELLED → 400 INVALID_TRANSITION", "INVALID_STATUS_TRANSITION", () =>
      assignNearestAmbulance(em.id)
    );
  }

  console.log("\n── Integration: no ambulances available ──");
  {
    await prisma.ambulance.updateMany({ data: { isAvailable: false } });
    try {
      const em = await makeEmergency(28.6, 77.2);
      await expectCode("all busy → 503 NO_AMBULANCE_AVAILABLE", "NO_AMBULANCE_AVAILABLE", () =>
        assignNearestAmbulance(em.id)
      );
    } finally {
      // restore availability from snapshot for the concurrency test
      for (const a of snapshot) {
        await prisma.ambulance.update({
          where: { id: a.id },
          data: { isAvailable: a.isAvailable },
        });
      }
    }
  }

  console.log("\n── Integration: concurrency / no double assignment ──");
  {
    const N = 5;
    const ems = await Promise.all(
      Array.from({ length: N }, () => makeEmergency(28.6139, 77.209)) // identical location → max contention
    );
    const results = await Promise.allSettled(ems.map((e) => assignNearestAmbulance(e.id)));

    const assigned = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value.assignedAmbulanceId as string);
    const uniqueAssigned = new Set(assigned);

    ok(`all ${N} concurrent assignments succeeded`, assigned.length === N, `${assigned.length}/${N}`);
    ok(
      "no ambulance assigned to two emergencies",
      uniqueAssigned.size === assigned.length,
      `${uniqueAssigned.size} unique`
    );
  }

  console.log("\n── Integration: discovery endpoint logic ──");
  {
    const all = await listAmbulances();
    const avail = await listAmbulances(true);
    ok("listAmbulances() returns fleet", all.length === snapshot.length);
    ok("listAmbulances(true) ⊆ fleet", avail.every((a) => a.isAvailable));
  }
}

main()
  .then(async () => {
    // Cleanup: delete created emergencies + restore ambulance availability.
    for (const id of createdEmergencyIds) {
      await prisma.emergency.delete({ where: { id } }).catch(() => {});
    }
    const snap = await prisma.ambulance.findMany({ select: { id: true } });
    for (const a of snap) {
      await prisma.ambulance.update({ where: { id: a.id }, data: { isAvailable: true } });
    }
    await prisma.$disconnect();

    console.log("\n" + "═".repeat(56));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═".repeat(56));
    if (failed > 0) {
      console.log("FAILED:", failures.join(", "));
      process.exit(1);
    }
  })
  .catch(async (e) => {
    console.error("TEST RUNNER ERROR:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
