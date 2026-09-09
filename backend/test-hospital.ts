// ============================================================================
// Hospital Ranking & Acceptance Module — Unit + Integration Tests (Person 3)
// ============================================================================
// Run:  node_modules/.bin/tsx test-hospital.ts   (or npm run test:hospital)
//
// Unit tests cover the pure ranking engine (capability derivation, capability
// filtering, transport ETA, scoring/ordering). Integration tests exercise the
// real Prisma DB: discovery, candidate generation, parallel requests, accept /
// reject flows, temporary assignment, dynamic reassignment, assignment
// locking, idempotency, fallback radius expansion, search exhaustion, the
// classic post-severity path, notification, event emission, transaction
// rollback, and concurrent-acceptance race safety.
//
// Self-cleaning: test emergencies (marker emergencyType) and test hospitals
// (id prefix "test-hosp-") are created in an isolated geography (Bengaluru —
// far outside every Delhi-NCR seed hospital's search radius) and deleted at
// the end. Emergencies are deleted FIRST (candidates cascade), then hospitals
// (HospitalCandidate→Hospital is RESTRICT). No timeline pollution reaches the
// Emergency Core E2E suite's data.
// ============================================================================

import "dotenv/config";
import { EmergencyStatus, HospitalResponse, type Hospital } from "@prisma/client";
import { prisma } from "./src/prisma/client";
import { AppError } from "./src/middleware/error-handler.middleware";
import {
  deriveRequiredCapabilities,
  isHospitalCapable,
  estimateTransportEtaMinutes,
  requiredServiceLabels,
  rankHospitals,
  startHospitalSearch,
  respondToHospitalRequest,
  notifyAssignedHospital,
  getHospitalRequests,
  registerHospitalEventHandlers,
} from "./src/services/hospital.service";
import * as hospitalRepo from "./src/repositories/hospital.repository";
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

/** Polls until `fn` returns truthy or the timeout elapses. */
async function waitFor<T>(fn: () => Promise<T>, timeoutMs = 4000): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

// ----------------------------------------------------------------------------
// Isolated test geography (Bengaluru — ~1700 km from every Delhi seed hospital,
// far outside the 60 km max radius, so seeded data can never enter a ranking).
// ----------------------------------------------------------------------------

const PT = { lat: 12.97, lng: 77.59 };
const TEST_TYPE = "Cardiac Emergency [P3-TEST]"; // marker for self-cleaning

const testHospitals = [
  // ~1.6 km — full capabilities, full beds → expected rank 1
  { id: "test-hosp-a", name: "P3TEST Alpha Heart Institute", latitude: 12.98, longitude: 77.6, hasICU: true, hasTraumaCare: true, hasCardiology: true, availableBeds: 12 },
  // ~7.8 km — cardiology but NO ICU → rank 2 initially, excluded once severity=RED
  { id: "test-hosp-b", name: "P3TEST Bravo Cardiac Clinic", latitude: 13.02, longitude: 77.64, hasICU: false, hasTraumaCare: false, hasCardiology: true, availableBeds: 8 },
  // ~12.4 km — ICU + cardiology → rank 3
  { id: "test-hosp-c", name: "P3TEST Charlie General", latitude: 13.04, longitude: 77.68, hasICU: true, hasTraumaCare: false, hasCardiology: true, availableBeds: 5 },
  // ~26.5 km — inside the EXPANDED radius only (fallback round)
  { id: "test-hosp-d", name: "P3TEST Delta Regional", latitude: 13.15, longitude: 77.75, hasICU: true, hasTraumaCare: false, hasCardiology: true, availableBeds: 6 },
  // 0 beds — not accepting, must never be a candidate
  { id: "test-hosp-nobed", name: "P3TEST NoBeds Medical", latitude: 12.99, longitude: 77.61, hasICU: true, hasTraumaCare: true, hasCardiology: true, availableBeds: 0 },
  // no cardiology — incapable for a cardiac emergency
  { id: "test-hosp-nocardio", name: "P3TEST Ortho Center", latitude: 12.985, longitude: 77.605, hasICU: true, hasTraumaCare: true, hasCardiology: false, availableBeds: 9 },
  // ~130 km — outside even the max radius, used for the rollback test
  { id: "test-hosp-far", name: "P3TEST Faraway Hospital", latitude: 13.9, longitude: 78.5, hasICU: true, hasTraumaCare: true, hasCardiology: true, availableBeds: 10 },
];

const createdEmergencyIds: string[] = [];

async function makeEmergency(overrides: { emergencyType?: string } = {}) {
  const em = await createEmergency({
    patientId: "patient-arjun-001",
    patientLatitude: PT.lat,
    patientLongitude: PT.lng,
    emergencyType: overrides.emergencyType ?? TEST_TYPE,
    patientAge: 34,
    patientAllergies: ["Penicillin"],
  });
  createdEmergencyIds.push(em.id);
  return em;
}

async function driveToEnRoute(emergencyId: string) {
  await updateEmergencyStatus(emergencyId, { status: EmergencyStatus.AMBULANCE_ASSIGNED });
  await updateEmergencyStatus(emergencyId, { status: EmergencyStatus.AMBULANCE_EN_ROUTE });
}

async function timelineCount(emergencyId: string) {
  return prisma.timelineEvent.count({ where: { emergencyId } });
}

async function getEm(emergencyId: string) {
  return prisma.emergency.findUnique({ where: { id: emergencyId } });
}

/** Capture emitted events by name into arrays. Returns an unsubscribe fn. */
function captureEvents(names: string[]) {
  const captured: Record<string, any[]> = {};
  const handlers: Record<string, (p: any) => void> = {};
  for (const name of names) {
    captured[name] = [];
    handlers[name] = (p: any) => captured[name].push(p);
    emergencyEvents.on(name, handlers[name]);
  }
  return {
    captured,
    off: () => {
      for (const name of names) emergencyEvents.off(name, handlers[name]);
    },
  };
}

const fakeHospital = (
  id: string,
  lat: number,
  lng: number,
  caps: Partial<Pick<Hospital, "hasICU" | "hasTraumaCare" | "hasCardiology">>,
  beds: number
): Hospital => ({
  id,
  name: `FAKE-${id}`,
  latitude: lat,
  longitude: lng,
  hasICU: caps.hasICU ?? false,
  hasTraumaCare: caps.hasTraumaCare ?? false,
  hasCardiology: caps.hasCardiology ?? false,
  availableBeds: beds,
  createdAt: new Date(),
  updatedAt: new Date(),
});

async function cleanup() {
  // Emergencies first (TimelineEvent + HospitalCandidate cascade with them),
  // then the test hospitals (candidate FK is RESTRICT).
  await prisma.emergency.deleteMany({
    where: { emergencyType: { contains: "[P3-TEST]" } },
  });
  await prisma.hospital.deleteMany({
    where: { id: { startsWith: "test-hosp-" } },
  });
}

async function main() {
  // ───────────────────────── UNIT ─────────────────────────
  console.log("\n── Unit: required capability derivation ──");
  {
    const cardiac = deriveRequiredCapabilities("Cardiac Emergency", null);
    ok("cardiac → cardiology required", cardiac.needsCardiology && !cardiac.needsICU && !cardiac.needsTraumaCare);
    const trauma = deriveRequiredCapabilities("Severe Trauma — RTA", null);
    ok("trauma/RTA → trauma care required", trauma.needsTraumaCare);
    const red = deriveRequiredCapabilities("Unknown Complaint", "RED");
    ok("severity RED → ICU required", red.needsICU);
    const none = deriveRequiredCapabilities(null, null);
    ok("no type/severity → no hard requirements", !none.needsICU && !none.needsTraumaCare && !none.needsCardiology);
    ok(
      "required service labels",
      JSON.stringify(requiredServiceLabels({ needsICU: true, needsTraumaCare: false, needsCardiology: true })) ===
        '["ICU","Cardiology"]'
    );
  }

  console.log("\n── Unit: capability filter ──");
  {
    const req = { needsICU: true, needsTraumaCare: false, needsCardiology: true };
    ok("hospital with all required caps is capable", isHospitalCapable(fakeHospital("x", 0, 0, { hasICU: true, hasCardiology: true }, 5), req));
    ok("hospital missing a required cap is incapable", !isHospitalCapable(fakeHospital("y", 0, 0, { hasICU: true }, 5), req));
  }

  console.log("\n── Unit: transport ETA ──");
  ok("40 km @ 40 km/h = 60 min", estimateTransportEtaMinutes(40) === 60);
  ok("0 km clamps to floor (1)", estimateTransportEtaMinutes(0) === 1);
  ok(
    "configurable speed (20 km @ 80 km/h = 15 min)",
    estimateTransportEtaMinutes(20, { ...({} as any), transportSpeedKmph: 80, minimumEtaMinutes: 1, goldenHourMaxEtaMinutes: 60 } as any) === 15
  );

  console.log("\n── Unit: ranking engine ──");
  {
    const req = { needsICU: false, needsTraumaCare: false, needsCardiology: true };
    const pool = [
      fakeHospital("near-full", 12.98, 77.6, { hasICU: true, hasTraumaCare: true, hasCardiology: true }, 12),
      fakeHospital("mid", 13.02, 77.64, { hasCardiology: true }, 8),
      fakeHospital("zero-beds", 12.98, 77.6, { hasCardiology: true }, 0),
      fakeHospital("no-cardio", 12.98, 77.6, { hasICU: true, hasTraumaCare: true }, 12),
      fakeHospital("outside-radius", 13.5, 78.2, { hasCardiology: true }, 12), // ~85 km
    ];
    const ranked = rankHospitals(pool, PT.lat, PT.lng, req, 15);
    ok("ranking excludes 0-bed / incapable / out-of-radius", ranked.length === 2, `${ranked.length} eligible`);
    ok("nearest+richest hospital ranks first", ranked[0]?.hospital.id === "near-full");
    ok("scores are in [0,1] and ordered", ranked.every((r) => r.totalScore >= 0 && r.totalScore <= 1) && ranked[0].totalScore >= ranked[1].totalScore);
    const wide = rankHospitals(pool, PT.lat, PT.lng, req, 500);
    ok("golden-hour ETA cap excludes distant hospitals even in-radius", !wide.some((r) => r.hospital.id === "outside-radius"), `~85 km ⇒ ETA > 60 min`);
  }

  // ───────────────────────── INTEGRATION SETUP ─────────────────────────
  console.log("\n── Integration setup ──");
  await cleanup(); // clear leftovers from any previous failed run
  for (const h of testHospitals) {
    await prisma.hospital.create({ data: h });
  }
  ok("isolated test hospitals created", (await prisma.hospital.count({ where: { id: { startsWith: "test-hosp-" } } })) === testHospitals.length);

  // ───────────────────────── DISCOVERY / CANDIDATES / PARALLEL REQUESTS ────
  console.log("\n── Integration: discovery, ranking, candidate generation ──");
  const em1 = await makeEmergency();
  {
    const cap = captureEvents(["hospitalSearchStarted", "hospitalCandidatesRanked", "hospitalRequestSent"]);
    await driveToEnRoute(em1.id);
    const before = await timelineCount(em1.id);

    const round = await startHospitalSearch(em1.id);

    ok("3 candidates generated (A, B, C in radius)", round.candidates.length === 3, round.candidates.map((c) => c.hospitalId).join(","));
    const byRank = [...round.candidates].sort((a, b) => a.rank - b.rank);
    ok("rank 1 = nearest full-capability hospital", byRank[0]?.hospitalId === "test-hosp-a");
    ok("ranks are 1..3", byRank.map((c) => c.rank).join(",") === "1,2,3");
    ok("all candidates start PENDING", round.candidates.every((c) => c.response === HospitalResponse.PENDING));
    ok("0-bed hospital never a candidate", !round.candidates.some((c) => c.hospitalId === "test-hosp-nobed"));
    ok("incapable hospital never a candidate", !round.candidates.some((c) => c.hospitalId === "test-hosp-nocardio"));
    ok("out-of-radius hospital not in round 1", !round.candidates.some((c) => c.hospitalId === "test-hosp-d"));

    ok("event: hospitalSearchStarted", cap.captured.hospitalSearchStarted.length === 1);
    ok("event: hospitalCandidatesRanked", cap.captured.hospitalCandidatesRanked[0]?.candidates?.length === 3);
    ok("event: hospitalRequestSent ×3 (parallel requests)", cap.captured.hospitalRequestSent.length === 3);
    const payload = cap.captured.hospitalRequestSent[0];
    ok(
      "request payload carries age/alert/ETA/services",
      payload.patientAge === 34 && payload.criticalAlert === "Penicillin Allergy" && payload.estimatedArrivalMinutes > 0 && Array.isArray(payload.requiredServices)
    );

    ok("search wrote NO timeline events (auto-path E2E safety)", (await timelineCount(em1.id)) === before);
    ok("search changed NO status", (await getEm(em1.id))?.status === EmergencyStatus.AMBULANCE_EN_ROUTE);

    ok("re-running search adds no duplicate candidates", (await startHospitalSearch(em1.id)).candidates.length === 0);
    cap.off();
  }

  console.log("\n── Integration: hospital console inbox ──");
  {
    const requests = await getHospitalRequests("test-hosp-a");
    ok("pending request visible to hospital", requests.some((r) => r.emergencyId === em1.id));
    await expectCode("unknown hospital inbox → 404", "HOSPITAL_NOT_FOUND", () => getHospitalRequests("no-such-hospital"));
  }

  // ───────────────────────── ACCEPT / TEMPORARY ASSIGNMENT ─────────────────
  console.log("\n── Integration: acceptance → temporary assignment ──");
  {
    const cap = captureEvents(["hospitalAccepted", "hospitalAssigned", "statusChanged"]);
    const result = await respondToHospitalRequest(em1.id, "test-hosp-a", "ACCEPTED");
    ok("assignmentChanged = true", result.assignmentChanged === true);
    const em = await getEm(em1.id);
    ok("assignedHospitalId set (temporary)", em?.assignedHospitalId === "test-hosp-a");
    ok("status → HOSPITAL_ACCEPTED (early-acceptance edge)", em?.status === EmergencyStatus.HOSPITAL_ACCEPTED);
    ok("candidate marked ACCEPTED", result.candidate.response === HospitalResponse.ACCEPTED);
    const events = await prisma.timelineEvent.findMany({ where: { emergencyId: em1.id } });
    ok("timeline records the acceptance", events.some((t) => t.label === "Hospital Accepted"));
    ok("event: hospitalAccepted + hospitalAssigned + statusChanged", cap.captured.hospitalAccepted.length === 1 && cap.captured.hospitalAssigned.length === 1 && cap.captured.statusChanged.some((e: any) => e.newStatus === EmergencyStatus.HOSPITAL_ACCEPTED));
    cap.off();
  }

  console.log("\n── Integration: idempotency & conflicting responses ──");
  {
    const before = await timelineCount(em1.id);
    const replay = await respondToHospitalRequest(em1.id, "test-hosp-a", "ACCEPTED");
    ok("duplicate ACCEPT replays idempotently", replay.idempotent === true && replay.assignmentChanged === false);
    ok("idempotent replay writes no timeline events", (await timelineCount(em1.id)) === before);
    await expectCode("ACCEPT→REJECT flip → 409 HOSPITAL_ALREADY_RESPONDED", "HOSPITAL_ALREADY_RESPONDED", () =>
      respondToHospitalRequest(em1.id, "test-hosp-a", "REJECTED")
    );
    const late = await respondToHospitalRequest(em1.id, "test-hosp-b", "ACCEPTED");
    ok("worse-ranked late ACCEPT recorded without reassignment", late.assignmentChanged === false && late.candidate.response === HospitalResponse.ACCEPTED);
    ok("assignment unchanged", (await getEm(em1.id))?.assignedHospitalId === "test-hosp-a");
  }

  await expectCode("response for unknown emergency → 404", "EMERGENCY_NOT_FOUND", () =>
    respondToHospitalRequest("00000000-0000-0000-0000-000000000000", "test-hosp-a", "ACCEPTED")
  );
  await expectCode("response from non-candidate hospital → 404", "HOSPITAL_CANDIDATE_NOT_FOUND", () =>
    respondToHospitalRequest(em1.id, "test-hosp-far", "ACCEPTED")
  );

  // ───────────────────────── DYNAMIC REASSIGNMENT ─────────────────────────
  console.log("\n── Integration: dynamic reassignment (rare, pre-pickup) ──");
  const em2 = await makeEmergency();
  {
    await driveToEnRoute(em2.id);
    await startHospitalSearch(em2.id);

    const cap = captureEvents(["hospitalReassigned"]);
    await respondToHospitalRequest(em2.id, "test-hosp-b", "ACCEPTED"); // rank 2 accepts first
    ok("rank-2 acceptance holds the temporary assignment", (await getEm(em2.id))?.assignedHospitalId === "test-hosp-b");

    const reassign = await respondToHospitalRequest(em2.id, "test-hosp-a", "ACCEPTED"); // rank 1 accepts later
    ok("better-ranked late acceptor triggers reassignment", reassign.assignmentChanged === true);
    ok("assignment switched to rank 1", (await getEm(em2.id))?.assignedHospitalId === "test-hosp-a");
    ok("status remains HOSPITAL_ACCEPTED (no lifecycle churn)", (await getEm(em2.id))?.status === EmergencyStatus.HOSPITAL_ACCEPTED);
    ok("event: hospitalReassigned", cap.captured.hospitalReassigned.length === 1 && cap.captured.hospitalReassigned[0].previousHospitalId === "test-hosp-b");
    const events = await prisma.timelineEvent.findMany({ where: { emergencyId: em2.id } });
    ok("timeline records the reassignment", events.some((t) => t.label === "Hospital Reassigned"));
    cap.off();
  }

  // ───────────────────────── ASSIGNMENT LOCKING ─────────────────────────
  console.log("\n── Integration: assignment locking at PATIENT_PICKED_UP ──");
  {
    await updateEmergencyStatus(em2.id, { status: EmergencyStatus.PATIENT_PICKED_UP }); // HOSPITAL_ACCEPTED → PICKED_UP (P3 edge)
    ok("pickup after early acceptance is a legal transition", (await getEm(em2.id))?.status === EmergencyStatus.PATIENT_PICKED_UP);

    const late = await respondToHospitalRequest(em2.id, "test-hosp-c", "ACCEPTED"); // rank 3 tries after lock
    ok("post-pickup ACCEPT is ignored (locked)", late.locked === true && late.assignmentChanged === false);
    ok("locked assignment untouched", (await getEm(em2.id))?.assignedHospitalId === "test-hosp-a");
    const cand = await hospitalRepo.findCandidate(em2.id, "test-hosp-c");
    ok("ignored candidate stays PENDING (no false acceptance recorded)", cand?.response === HospitalResponse.PENDING);
  }

  // ───────────────── OFFICIAL PATH: SEVERITY → NOTIFICATION ────────────────
  console.log("\n── Integration: severity → hospital notification (official path) ──");
  {
    const cap = captureEvents(["hospitalNotified"]);
    await updateEmergencyStatus(em2.id, { status: EmergencyStatus.SEVERITY_SELECTED, severity: "RED" });
    const notified: any = await notifyAssignedHospital(em2.id);
    ok("SEVERITY_SELECTED → HOSPITAL_NOTIFIED (locked-hospital edge)", notified.status === EmergencyStatus.HOSPITAL_NOTIFIED);
    ok("updated transport ETA stored", Number.isInteger(notified.etaMinutes) && notified.etaMinutes > 0, `${notified.etaMinutes} min`);
    const evt = cap.captured.hospitalNotified[0];
    ok(
      "notification payload: severity + onboard + ETA + critical alert",
      evt?.severity === "RED" && evt?.patientOnboard === true && evt?.etaMinutes > 0 && evt?.criticalAlert === "Penicillin Allergy"
    );
    cap.off();

    await expectCode("second notify → 400 INVALID_STATUS_TRANSITION", "INVALID_STATUS_TRANSITION", () => notifyAssignedHospital(em2.id));
  }
  {
    const emNoHosp = await makeEmergency();
    await expectCode("notify without an assigned hospital → 400", "NO_HOSPITAL_ASSIGNED", () => notifyAssignedHospital(emNoHosp.id));
  }

  // ───────────────────── FALLBACK: ALL REJECT → EXPAND ─────────────────────
  console.log("\n── Integration: rejection flow + fallback radius expansion ──");
  const em4 = await makeEmergency();
  {
    await driveToEnRoute(em4.id);
    await startHospitalSearch(em4.id);
    const cap = captureEvents(["hospitalRejected", "hospitalSearchExhausted"]);

    await respondToHospitalRequest(em4.id, "test-hosp-a", "REJECTED", "ICU at capacity");
    await respondToHospitalRequest(em4.id, "test-hosp-b", "REJECTED");
    const candA = await hospitalRepo.findCandidate(em4.id, "test-hosp-a");
    ok("rejection stored with reason", candA?.response === HospitalResponse.REJECTED && candA?.rejectionReason === "ICU at capacity");
    ok("rejection does not change emergency status (frozen design)", (await getEm(em4.id))?.status === EmergencyStatus.AMBULANCE_EN_ROUTE);

    await respondToHospitalRequest(em4.id, "test-hosp-c", "REJECTED"); // last of round 1 → fallback fires
    const cands = await prisma.hospitalCandidate.findMany({ where: { emergencyId: em4.id }, orderBy: { rank: "asc" } });
    ok("fallback expanded the radius and added the next hospital", cands.some((c) => c.hospitalId === "test-hosp-d"), cands.map((c) => c.hospitalId).join(","));
    ok("fallback candidate rank continues globally (rank 4)", cands.find((c) => c.hospitalId === "test-hosp-d")?.rank === 4);
    ok("events: hospitalRejected ×3", cap.captured.hospitalRejected.length === 3);

    await respondToHospitalRequest(em4.id, "test-hosp-d", "REJECTED"); // exhausts the search
    ok("event: hospitalSearchExhausted after final rejection", cap.captured.hospitalSearchExhausted.length === 1);
    ok("no assignment after exhaustion", (await getEm(em4.id))?.assignedHospitalId === null);
    cap.off();
  }

  // ───────────────── CLASSIC POST-SEVERITY PATH (backward compat) ──────────
  console.log("\n── Integration: classic post-severity path still works ──");
  const em5 = await makeEmergency();
  {
    await driveToEnRoute(em5.id);
    await updateEmergencyStatus(em5.id, { status: EmergencyStatus.PATIENT_PICKED_UP });
    await updateEmergencyStatus(em5.id, { status: EmergencyStatus.SEVERITY_SELECTED, severity: "RED" });
    await updateEmergencyStatus(em5.id, { status: EmergencyStatus.HOSPITAL_SEARCHING });
    await updateEmergencyStatus(em5.id, { status: EmergencyStatus.HOSPITAL_ACCEPTANCE_REQUESTED });

    const round = await startHospitalSearch(em5.id);
    ok("RED severity requires ICU → non-ICU hospital excluded", round.candidates.length === 2 && !round.candidates.some((c) => c.hospitalId === "test-hosp-b"), round.candidates.map((c) => c.hospitalId).join(","));

    const accept = await respondToHospitalRequest(em5.id, "test-hosp-a", "ACCEPTED");
    ok("first acceptance after pickup still assigns (nothing was locked)", accept.assignmentChanged === true);
    ok("classic edge HOSPITAL_ACCEPTANCE_REQUESTED → HOSPITAL_ACCEPTED", (await getEm(em5.id))?.status === EmergencyStatus.HOSPITAL_ACCEPTED);

    const notified: any = await notifyAssignedHospital(em5.id);
    ok("classic edge HOSPITAL_ACCEPTED → HOSPITAL_NOTIFIED", notified.status === EmergencyStatus.HOSPITAL_NOTIFIED);

    await updateEmergencyStatus(em5.id, { status: EmergencyStatus.EN_ROUTE_TO_HOSPITAL });
    await updateEmergencyStatus(em5.id, { status: EmergencyStatus.ARRIVED });
    ok("lifecycle completes to ARRIVED", (await getEm(em5.id))?.status === EmergencyStatus.ARRIVED);
  }

  // ───────────────────── CONCURRENCY / RACE SAFETY ─────────────────────────
  console.log("\n── Integration: concurrent acceptances converge on best rank ──");
  const em7 = await makeEmergency();
  {
    await driveToEnRoute(em7.id);
    await startHospitalSearch(em7.id);

    const results = await Promise.allSettled([
      respondToHospitalRequest(em7.id, "test-hosp-a", "ACCEPTED"),
      respondToHospitalRequest(em7.id, "test-hosp-b", "ACCEPTED"),
      respondToHospitalRequest(em7.id, "test-hosp-c", "ACCEPTED"),
    ]);
    ok("all 3 concurrent responses succeed (no corruption)", results.every((r) => r.status === "fulfilled"));
    ok("exactly the best-ranked acceptor holds the assignment", (await getEm(em7.id))?.assignedHospitalId === "test-hosp-a");
    const cands = await prisma.hospitalCandidate.findMany({ where: { emergencyId: em7.id } });
    ok("every acceptance recorded truthfully", cands.every((c) => c.response === HospitalResponse.ACCEPTED));
    ok("status advanced exactly once to HOSPITAL_ACCEPTED", (await getEm(em7.id))?.status === EmergencyStatus.HOSPITAL_ACCEPTED);
  }

  // ───────────────────── TRANSACTION ROLLBACK ─────────────────────────────
  console.log("\n── Integration: transaction rollback ──");
  const em8 = await makeEmergency();
  {
    await driveToEnRoute(em8.id);
    // No candidate row exists for test-hosp-far → the candidate update inside
    // the transaction throws AFTER the assignment claim succeeded. The whole
    // transaction must roll back, leaving the emergency unassigned.
    let threw = false;
    try {
      await hospitalRepo.acceptHospitalAtomically({
        emergencyId: em8.id,
        hospitalId: "test-hosp-far",
        timelineDescription: "should roll back",
        metadata: {},
      });
    } catch {
      threw = true;
    }
    ok("failed acceptance throws", threw);
    ok("assignment claim rolled back with the transaction", (await getEm(em8.id))?.assignedHospitalId === null);
    ok("no timeline event leaked from the rolled-back transaction", !(await prisma.timelineEvent.findFirst({ where: { emergencyId: em8.id, description: "should roll back" } })));
  }

  // ───────────── EVENT-DRIVEN AUTO-SEARCH + LOCK (runs LAST) ───────────────
  console.log("\n── Integration: auto-search on AMBULANCE_EN_ROUTE + lock event ──");
  {
    registerHospitalEventHandlers();
    const cap = captureEvents(["hospitalAssignmentLocked"]);
    const em9 = await makeEmergency();
    await driveToEnRoute(em9.id); // statusChanged(AMBULANCE_EN_ROUTE) → auto-search fires

    const autoCands = await waitFor(async () => {
      const c = await prisma.hospitalCandidate.findMany({ where: { emergencyId: em9.id } });
      return c.length >= 3 ? c : null;
    });
    ok("hospital discovery auto-started on AMBULANCE_EN_ROUTE", autoCands !== null, `${autoCands?.length ?? 0} candidates`);
    ok("auto path wrote no timeline events (E2E contract safe)", (await timelineCount(em9.id)) === 3);

    await respondToHospitalRequest(em9.id, "test-hosp-a", "ACCEPTED");
    await updateEmergencyStatus(em9.id, { status: EmergencyStatus.PATIENT_PICKED_UP });
    ok("event: hospitalAssignmentLocked on pickup", cap.captured.hospitalAssignmentLocked.some((e: any) => e.emergencyId === em9.id && e.hospitalId === "test-hosp-a"));
    ok("full official-path timeline: SOS+ASSIGN+ENROUTE+ACCEPT+PICKUP = 5", (await timelineCount(em9.id)) === 5);
    cap.off();
  }
}

main()
  .then(async () => {
    await cleanup();
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
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
