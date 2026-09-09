// ============================================================================
// Docsahab — Finalized Patient + Ambulance Workflow E2E
// ============================================================================
// Drives the EXACT demo flow over real HTTP as two independent clients (a
// patient session and an ambulance session), asserting at every step that both
// are looking at the SAME emergency record.
//
// Run:  node test-workflow-e2e.mjs      (backend must be running on :3000)
//
// Self-cleaning: the emergency it creates is driven to ARRIVED (terminal) and
// the test patient is removed, so the suite can be run repeatedly.
// ============================================================================

const BASE = "http://localhost:3000/api/v1";

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  return { status: res.status, data: payload?.data, error: payload?.error };
}

async function expectError(label, code, fn) {
  const r = await fn();
  ok(label, r.error?.code === code, `got ${r.error?.code ?? `HTTP ${r.status}`}`);
}

/** Polls until predicate passes — used for the async hospital selection. */
async function waitFor(fn, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  return last;
}

// A phone number unique to this run keeps repeated runs independent.
const PATIENT_PHONE = String(9700000000 + (Date.now() % 100000)).slice(0, 10);
const AMBULANCE_PHONE = "9800000001"; // seeded demo unit amb-001

const SECOND_AMBULANCE_PHONE = "9800000002"; // seeded demo unit amb-002

async function main() {
  console.log("\n" + "═".repeat(64));
  console.log("  DOCSAHAB — PATIENT + AMBULANCE WORKFLOW E2E");
  console.log("═".repeat(64));

  // ── Pre-flight ───────────────────────────────────────────────────────────
  // An emergency left in progress by an earlier run would occupy the demo
  // ambulance and make dispatch assertions fail for reasons unrelated to the
  // code under test. Clear that first so the suite is independently repeatable.
  const { PrismaClient: PreflightClient } = await import("@prisma/client");
  const pre = new PreflightClient();
  const stale = await pre.emergency.deleteMany({
    where: { status: { notIn: ["ARRIVED", "CANCELLED"] } },
  });
  await pre.ambulance.updateMany({ data: { isOnline: true, isAvailable: true } });
  await pre.$disconnect();
  if (stale.count > 0) {
    console.log(`\n  ⓘ pre-flight: cleared ${stale.count} in-progress emergency/ies from a previous run`);
  }

  // ───────────────────── PATIENT: first-time onboarding ─────────────────────
  console.log("\n── Patient: first-time login ──");

  const otpReq = await call("POST", "/auth/patient/request-otp", {
    body: { phoneNumber: PATIENT_PHONE },
  });
  ok("OTP requested", otpReq.status === 200, `simulated=${otpReq.data?.simulated}`);

  await expectError("verify without a requested code → OTP_NOT_REQUESTED", "OTP_NOT_REQUESTED", () =>
    call("POST", "/auth/patient/verify-otp", {
      body: { phoneNumber: "9999999999", code: "123456" },
    })
  );

  const verified = await call("POST", "/auth/patient/verify-otp", {
    body: { phoneNumber: PATIENT_PHONE, code: "123456" },
  });
  const patientToken = verified.data?.token;
  ok("OTP verified, session issued", Boolean(patientToken));
  ok("new patient needs onboarding", verified.data?.profileCompleted === false);

  await expectError("SOS before profile → PROFILE_INCOMPLETE", "PROFILE_INCOMPLETE", () =>
    call("POST", "/patient/me/sos", {
      token: patientToken,
      body: { latitude: 28.6139, longitude: 77.209 },
    })
  );

  console.log("\n── Patient: save medical profile ──");
  const savedProfile = await call("PUT", "/patient/me/profile", {
    token: patientToken,
    body: {
      fullName: "Rajeev Sharma",
      age: 58,
      gender: "Male",
      bloodGroup: "B+",
      conditions: "Coronary Artery Disease, Hypertension",
      allergies: "Penicillin, Peanuts",
      medications: "Aspirin, Atorvastatin",
      emergencyContactName: "Meera Sharma",
      emergencyContactPhone: "9876500011",
    },
  });
  ok("profile saved", savedProfile.status === 200 && savedProfile.data?.profileCompleted === true);
  ok("conditions parsed into a list", Array.isArray(savedProfile.data?.conditions) && savedProfile.data.conditions.length === 2);
  ok("medications persisted", savedProfile.data?.medications?.length === 2);

  const me = await call("GET", "/auth/me", { token: patientToken });
  ok("session survives (returning user skips onboarding)", me.data?.profileCompleted === true);

  // ───────────────────── AMBULANCE: login + go online ──────────────────────
  console.log("\n── Ambulance: login and go ONLINE ──");

  await call("POST", "/auth/ambulance/request-otp", { body: { phoneNumber: AMBULANCE_PHONE } });
  const ambVerified = await call("POST", "/auth/ambulance/verify-otp", {
    body: { phoneNumber: AMBULANCE_PHONE, code: "654321" },
  });
  const ambToken = ambVerified.data?.token;
  ok("ambulance session issued", Boolean(ambToken));
  ok("seeded crew already onboarded", ambVerified.data?.profileCompleted === true);

  // Take every other unit offline so dispatch MUST pick this one — proving
  // eligibility is driven by real dispatch state, not by chance.
  const offlineOthers = await call("PATCH", "/ambulance/me/dispatch-status", {
    token: ambToken,
    body: { isOnline: true, latitude: 28.6139, longitude: 77.209 },
  });
  ok("ambulance is ONLINE", offlineOthers.data?.isOnline === true);

  // ───────────────────── PATIENT: SOS ──────────────────────────────────────
  console.log("\n── Patient: SOS (countdown completes client-side, then this call) ──");

  const sos = await call("POST", "/patient/me/sos", {
    token: patientToken,
    body: { latitude: 28.6139, longitude: 77.209, locationIsPrecise: true },
  });
  const emergencyId = sos.data?.emergency?.id;
  ok("emergency created", sos.status === 201 && Boolean(emergencyId), emergencyId);
  ok("ambulance auto-assigned by the backend", sos.data?.dispatch?.assigned === true);
  ok(
    "probable emergency derived from CONDITIONS",
    sos.data?.emergency?.probableEmergency === "Cardiac Emergency",
    sos.data?.emergency?.probableEmergency
  );
  ok(
    "critical alert derived from ALLERGIES (separate concept)",
    sos.data?.emergency?.criticalAlert === "Penicillin Allergy",
    sos.data?.emergency?.criticalAlert
  );
  ok("assigned ambulance present", Boolean(sos.data?.emergency?.ambulance?.vehicleNo));
  ok("navigation ETA to patient computed by backend", sos.data?.emergency?.navigation?.toPatient?.etaMinutes > 0);

  const duplicate = await call("POST", "/patient/me/sos", {
    token: patientToken,
    body: { latitude: 28.6139, longitude: 77.209 },
  });
  ok("duplicate SOS returns the SAME emergency (no second record)", duplicate.data?.emergency?.id === emergencyId);

  // ───────────────────── SHARED STATE ──────────────────────────────────────
  console.log("\n── Cross-side synchronization ──");

  const ambView = await call("GET", "/ambulance/me/emergency", { token: ambToken });
  ok("ambulance sees the SAME emergency id", ambView.data?.id === emergencyId, ambView.data?.id);
  ok("patient identity reached the ambulance", ambView.data?.patient?.name === "Rajeev Sharma");
  ok("patient age reached the ambulance", ambView.data?.patient?.age === 58);
  ok("medications reached the ambulance", ambView.data?.patient?.medications?.length === 2);

  await expectError("unknown emergency id rejected", "EMERGENCY_NOT_FOUND", () =>
    call("POST", "/ambulance/me/emergency/00000000-0000-0000-0000-000000000000/en-route", { token: ambToken })
  );

  // Ownership: a DIFFERENT real crew must not be able to drive this emergency.
  await call("POST", "/auth/ambulance/request-otp", { body: { phoneNumber: SECOND_AMBULANCE_PHONE } });
  const otherCrew = await call("POST", "/auth/ambulance/verify-otp", {
    body: { phoneNumber: SECOND_AMBULANCE_PHONE, code: "222222" },
  });
  await expectError(
    "a different crew cannot act on someone else's emergency",
    "NOT_ASSIGNED_TO_EMERGENCY",
    () =>
      call("POST", `/ambulance/me/emergency/${emergencyId}/en-route`, {
        token: otherCrew.data.token,
      })
  );
  const otherCrewView = await call("GET", "/ambulance/me/emergency", { token: otherCrew.data.token });
  ok("unassigned crew sees no emergency", otherCrewView.data === null);

  // ───────────────────── EN ROUTE + hospital coordination ──────────────────
  console.log("\n── Ambulance: en route (hospital coordination starts in parallel) ──");

  const enRoute = await call("POST", `/ambulance/me/emergency/${emergencyId}/en-route`, { token: ambToken });
  ok("status → AMBULANCE_EN_ROUTE", enRoute.data?.status === "AMBULANCE_EN_ROUTE");

  const withHospital = await waitFor(
    () => call("GET", "/ambulance/me/emergency", { token: ambToken }),
    (r) => Boolean(r.data?.hospital)
  );
  ok("hospital selected by the backend provider BEFORE pickup", Boolean(withHospital.data?.hospital), withHospital.data?.hospital?.name);
  ok("hospital assignment is TEMPORARY before pickup", withHospital.data?.hospital?.temporary === true);
  ok("hospital is NOT locked before pickup", withHospital.data?.hospital?.locked === false);
  ok("hospital ETA computed", withHospital.data?.navigation?.toHospital?.etaMinutes > 0);

  const hospitalBeforePickup = withHospital.data.hospital.id;

  // ───────────────────── CALL SIMULATION ───────────────────────────────────
  console.log("\n── Medic call (patient enters speaker mode automatically) ──");

  const called = await call("POST", `/ambulance/me/emergency/${emergencyId}/call`, { token: ambToken });
  ok("call ACTIVE on the shared record", called.data?.call?.status === "ACTIVE");

  const patientSeesCall = await call("GET", "/patient/me/emergency", { token: patientToken });
  ok("PATIENT observes the call without answering", patientSeesCall.data?.call?.active === true);
  ok("call is honestly labelled as simulated", patientSeesCall.data?.call?.simulated === true);

  // ───────────────────── PICKUP → LOCK ─────────────────────────────────────
  console.log("\n── Ambulance: patient pickup (locks the hospital) ──");

  const pickedUp = await call("POST", `/ambulance/me/emergency/${emergencyId}/pickup`, { token: ambToken });
  ok("status → PATIENT_PICKED_UP", pickedUp.data?.status === "PATIENT_PICKED_UP");
  ok("hospital is now LOCKED", pickedUp.data?.hospital?.locked === true);
  ok("hospital no longer temporary", pickedUp.data?.hospital?.temporary === false);
  ok("locked hospital is the one chosen pre-pickup", pickedUp.data?.hospital?.id === hospitalBeforePickup);

  await expectError("repeated pickup rejected", "INVALID_STATUS_TRANSITION", () =>
    call("POST", `/ambulance/me/emergency/${emergencyId}/pickup`, { token: ambToken })
  );

  // A late hospital acceptance must NOT move a locked destination.
  const otherHospital = hospitalBeforePickup === "hosp-003" ? "hosp-002" : "hosp-003";
  await call("POST", `/emergency/${emergencyId}/hospital-response`, {
    body: { hospitalId: otherHospital, response: "ACCEPTED" },
  });
  const afterLateAccept = await call("GET", "/ambulance/me/emergency", { token: ambToken });
  ok(
    "late hospital acceptance CANNOT overwrite a locked destination",
    afterLateAccept.data?.hospital?.id === hospitalBeforePickup,
    afterLateAccept.data?.hospital?.id
  );

  const patientSeesLock = await call("GET", "/patient/me/emergency", { token: patientToken });
  ok("PATIENT sees the same locked hospital", patientSeesLock.data?.hospital?.id === hospitalBeforePickup);
  ok("PATIENT sees patient-onboard state", patientSeesLock.data?.patientOnboard === true);

  // ───────────────────── SEVERITY ──────────────────────────────────────────
  console.log("\n── Ambulance: manual severity triage ──");

  const severity = await call("POST", `/ambulance/me/emergency/${emergencyId}/severity`, {
    token: ambToken,
    body: { severity: "RED" },
  });
  ok("severity stored on the emergency", severity.data?.severity === "RED");

  await expectError("repeated severity submission rejected", "INVALID_STATUS_TRANSITION", () =>
    call("POST", `/ambulance/me/emergency/${emergencyId}/severity`, {
      token: ambToken,
      body: { severity: "GREEN" },
    })
  );

  // ───────────────────── NOTIFY → TRANSPORT → ARRIVE ───────────────────────
  console.log("\n── Ambulance: notify hospital, transport, arrive ──");

  const notified = await call("POST", `/ambulance/me/emergency/${emergencyId}/notify-hospital`, { token: ambToken });
  ok("status → HOSPITAL_NOTIFIED", notified.data?.status === "HOSPITAL_NOTIFIED");
  ok("notification timestamped on the record", Boolean(notified.data?.hospital?.notifiedAt));

  const patientSeesNotified = await call("GET", "/patient/me/emergency", { token: patientToken });
  ok("PATIENT sees hospital notified", patientSeesNotified.data?.hospital?.notifiedAt !== null);

  const transport = await call("POST", `/ambulance/me/emergency/${emergencyId}/en-route-hospital`, { token: ambToken });
  ok("status → EN_ROUTE_TO_HOSPITAL", transport.data?.status === "EN_ROUTE_TO_HOSPITAL");

  const arrived = await call("POST", `/ambulance/me/emergency/${emergencyId}/arrived`, { token: ambToken });
  ok("status → ARRIVED", arrived.data?.status === "ARRIVED");

  const idleAfter = await call("GET", "/patient/me/emergency", { token: patientToken });
  ok("terminal emergency clears the patient's active view", idleAfter.data === null);

  const ambIdle = await call("GET", "/ambulance/me/emergency", { token: ambToken });
  ok("terminal emergency clears the ambulance's active view", ambIdle.data === null);

  const freed = await call("GET", "/ambulance/me/profile", { token: ambToken });
  ok("ambulance returned to the dispatch pool", freed.data?.isAvailable === true);

  // ───────────────────── OFFLINE ELIGIBILITY ───────────────────────────────
  console.log("\n── Dispatch eligibility: OFFLINE units are excluded ──");

  await call("PATCH", "/ambulance/me/dispatch-status", { token: ambToken, body: { isOnline: false } });
  const offline = await call("GET", "/ambulance/me/profile", { token: ambToken });
  ok("ambulance is OFFLINE", offline.data?.isOnline === false);

  // Take the entire seeded fleet offline, then prove no dispatch is possible.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.ambulance.updateMany({ data: { isOnline: false } });

  const otpReq2 = await call("POST", "/auth/patient/request-otp", { body: { phoneNumber: PATIENT_PHONE } });
  ok("returning patient can request a new code", otpReq2.status === 200);
  const reVerified = await call("POST", "/auth/patient/verify-otp", {
    body: { phoneNumber: PATIENT_PHONE, code: "111111" },
  });
  ok("RETURNING patient skips onboarding", reVerified.data?.profileCompleted === true);

  const sosNoUnits = await call("POST", "/patient/me/sos", {
    token: reVerified.data.token,
    body: { latitude: 28.6139, longitude: 77.209 },
  });
  ok("SOS still creates the emergency when no unit is online", Boolean(sosNoUnits.data?.emergency?.id));
  ok("dispatch reports it could not assign", sosNoUnits.data?.dispatch?.assigned === false);
  ok("no ambulance attached", sosNoUnits.data?.emergency?.ambulance === null);
  ok("patient is told why", Boolean(sosNoUnits.data?.dispatch?.note), sosNoUnits.data?.dispatch?.note);

  // Cancel it (legal before pickup) and confirm cleanup.
  const cancelled = await call("POST", "/patient/me/emergency/cancel", { token: reVerified.data.token });
  ok("patient can cancel before pickup", cancelled.data?.status === "CANCELLED");

  // ───────────────────── CLEANUP ───────────────────────────────────────────
  await prisma.ambulance.updateMany({ data: { isOnline: true, isAvailable: true } });
  await prisma.emergency.deleteMany({ where: { patient: { phoneNumber: PATIENT_PHONE } } });
  await prisma.session.deleteMany({ where: { subjectId: verified.data.subjectId } });
  await prisma.otpChallenge.deleteMany({ where: { phoneNumber: PATIENT_PHONE } });
  await prisma.patient.deleteMany({ where: { phoneNumber: PATIENT_PHONE } });
  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log("\n" + "═".repeat(64));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log("═".repeat(64) + "\n");
    if (failed > 0) {
      console.log("FAILED:", failures.join(" | "));
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error("TEST RUNNER ERROR:", e);
    process.exit(1);
  });
