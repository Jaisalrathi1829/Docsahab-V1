/**
 * Docsahab Emergency Core Service — End-to-End Integration Test
 * 
 * Tests the complete emergency lifecycle:
 * SOS_TRIGGERED → AMBULANCE_ASSIGNED → AMBULANCE_EN_ROUTE → PATIENT_PICKED_UP
 * → SEVERITY_SELECTED → HOSPITAL_SEARCHING → HOSPITAL_ACCEPTANCE_REQUESTED
 * → HOSPITAL_ACCEPTED → HOSPITAL_NOTIFIED → EN_ROUTE_TO_HOSPITAL → ARRIVED
 * 
 * Also tests validation errors and invalid transitions.
 */

const BASE = "http://localhost:3000/api/v1";
let emergencyId = null;
let passed = 0;
let failed = 0;
const results = [];

function log(label, ok, detail) {
  const icon = ok ? "✅" : "❌";
  if (ok) passed++; else failed++;
  const msg = `${icon} ${label}${detail ? ": " + detail : ""}`;
  console.log(msg);
  results.push({ label, ok, detail });
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  DOCSAHAB EMERGENCY CORE SERVICE — E2E TEST");
  console.log("═".repeat(60) + "\n");

  // ─── 1. HEALTH CHECK ───
  console.log("── 1. Health Check ──");
  {
    const { status, data } = await req("GET", "/health");
    log("Health endpoint returns 200", status === 200);
    log("Service name correct", data?.data?.service === "docsahab-emergency-core");
  }

  // ─── 2. POST /sos — CREATE EMERGENCY ───
  console.log("\n── 2. POST /sos — Create Emergency ──");
  {
    const { status, data } = await req("POST", "/sos", {
      patientId: "patient-arjun-001",
      patientLatitude: 28.6139,
      patientLongitude: 77.2090,
      patientAddress: "Connaught Place, Delhi NCR",
      emergencyType: "Cardiac Emergency",
      patientName: "Arjun Raghavan",
      patientAge: 34,
      patientSex: "Male",
      patientBloodGroup: "O+",
      patientAllergies: ["Penicillin", "Peanuts"],
      patientConditions: ["Asthma", "Hypertension"],
    });
    log("SOS returns 201", status === 201);
    log("Status is SOS_TRIGGERED", data?.data?.status === "SOS_TRIGGERED");
    log("PatientId stored", data?.data?.patientId === "patient-arjun-001");
    log("Location stored", data?.data?.patientLatitude === 28.6139);
    log("Patient name stored", data?.data?.patientName === "Arjun Raghavan");
    log("Blood group stored", data?.data?.patientBloodGroup === "O+");
    log("Allergies stored", JSON.stringify(data?.data?.patientAllergies) === '["Penicillin","Peanuts"]');
    log("Conditions stored", JSON.stringify(data?.data?.patientConditions) === '["Asthma","Hypertension"]');
    log("Critical alert auto-derived", data?.data?.criticalAlert === "Penicillin Allergy");
    log("Timeline has initial event", data?.data?.timelineEvents?.length === 1);
    log("Timeline event label", data?.data?.timelineEvents?.[0]?.label === "SOS Triggered");
    emergencyId = data?.data?.id;
    log("Emergency ID generated", !!emergencyId, emergencyId);
  }

  // ─── 3. VALIDATION ERRORS ───
  console.log("\n── 3. Validation Errors ──");
  {
    const { status, data } = await req("POST", "/sos", {});
    log("Missing required fields returns 400", status === 400);
    log("Error code is VALIDATION_ERROR", data?.error?.code === "VALIDATION_ERROR");
  }
  {
    const { status, data } = await req("POST", "/sos", {
      patientId: "x",
      patientLatitude: 999,
      patientLongitude: 77.2,
    });
    log("Invalid latitude returns 400", status === 400);
  }

  // ─── 4. GET /emergency/:id ───
  console.log("\n── 4. GET /emergency/:id ──");
  {
    const { status, data } = await req("GET", `/emergency/${emergencyId}`);
    log("Get emergency returns 200", status === 200);
    log("Full emergency returned", data?.data?.id === emergencyId);
    log("Includes timeline", Array.isArray(data?.data?.timelineEvents));
    log("Includes hospital candidates", Array.isArray(data?.data?.hospitalCandidates));
  }
  {
    const { status } = await req("GET", "/emergency/00000000-0000-0000-0000-000000000000");
    log("Non-existent emergency returns 404", status === 404);
  }
  {
    const { status } = await req("GET", "/emergency/not-a-uuid");
    log("Invalid UUID returns 400", status === 400);
  }

  // ─── 5. INVALID STATUS TRANSITIONS ───
  console.log("\n── 5. Invalid Status Transitions ──");
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "ARRIVED",
    });
    log("SOS→ARRIVED rejected (400)", status === 400);
    log("Error code is INVALID_STATUS_TRANSITION", data?.error?.code === "INVALID_STATUS_TRANSITION");
  }
  {
    const { status } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "PATIENT_PICKED_UP",
    });
    log("SOS→PATIENT_PICKED_UP rejected (400)", status === 400);
  }

  // ─── 6. FULL LIFECYCLE WALKTHROUGH ───
  console.log("\n── 6. Full Lifecycle — Status Transitions ──");

  // 6a. AMBULANCE_ASSIGNED
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "AMBULANCE_ASSIGNED",
      assignedAmbulanceId: "AMB-204",
      etaMinutes: 6,
      description: "BLS unit AMB-204 dispatched",
    });
    log("→ AMBULANCE_ASSIGNED (200)", status === 200);
    log("  Ambulance ID stored", data?.data?.assignedAmbulanceId === "AMB-204");
    log("  ETA stored", data?.data?.etaMinutes === 6);
    log("  Timeline count = 2", data?.data?.timelineEvents?.length === 2);
  }

  // 6b. AMBULANCE_EN_ROUTE
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "AMBULANCE_EN_ROUTE",
      etaMinutes: 4,
    });
    log("→ AMBULANCE_EN_ROUTE (200)", status === 200);
    log("  ETA updated to 4", data?.data?.etaMinutes === 4);
  }

  // 6c. PATIENT_PICKED_UP
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "PATIENT_PICKED_UP",
      description: "Patient onboarded",
    });
    log("→ PATIENT_PICKED_UP (200)", status === 200);
  }

  // 6d. SEVERITY_SELECTED
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "SEVERITY_SELECTED",
      severity: "RED",
    });
    log("→ SEVERITY_SELECTED (200)", status === 200);
    log("  Severity set to RED", data?.data?.severity === "RED");
  }

  // 6e. HOSPITAL_SEARCHING
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "HOSPITAL_SEARCHING",
    });
    log("→ HOSPITAL_SEARCHING (200)", status === 200);
  }

  // 6f. HOSPITAL_ACCEPTANCE_REQUESTED
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "HOSPITAL_ACCEPTANCE_REQUESTED",
    });
    log("→ HOSPITAL_ACCEPTANCE_REQUESTED (200)", status === 200);
  }

  // 6g. HOSPITAL_ACCEPTED
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "HOSPITAL_ACCEPTED",
      assignedHospitalId: "hosp-st-mary",
      etaMinutes: 8,
      description: "St. Mary Hospital accepted",
    });
    log("→ HOSPITAL_ACCEPTED (200)", status === 200);
    log("  Hospital ID stored", data?.data?.assignedHospitalId === "hosp-st-mary");
    log("  ETA updated to 8", data?.data?.etaMinutes === 8);
  }

  // 6h. HOSPITAL_NOTIFIED
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "HOSPITAL_NOTIFIED",
    });
    log("→ HOSPITAL_NOTIFIED (200)", status === 200);
  }

  // 6i. EN_ROUTE_TO_HOSPITAL
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "EN_ROUTE_TO_HOSPITAL",
      etaMinutes: 5,
    });
    log("→ EN_ROUTE_TO_HOSPITAL (200)", status === 200);
  }

  // 6j. ARRIVED
  {
    const { status, data } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "ARRIVED",
    });
    log("→ ARRIVED (200)", status === 200);
    log("  Final status is ARRIVED", data?.data?.status === "ARRIVED");
    log("  Total timeline events = 11", data?.data?.timelineEvents?.length === 11);
  }

  // ─── 7. TERMINAL STATE — NO FURTHER TRANSITIONS ───
  console.log("\n── 7. Terminal State ──");
  {
    const { status } = await req("PATCH", `/emergency/${emergencyId}/status`, {
      status: "SOS_TRIGGERED",
    });
    log("ARRIVED→SOS_TRIGGERED rejected (400)", status === 400);
  }

  // ─── 8. TIMELINE ───
  console.log("\n── 8. GET /emergency/:id/timeline ──");
  {
    const { status, data } = await req("GET", `/emergency/${emergencyId}/timeline`);
    log("Timeline returns 200", status === 200);
    log("Timeline has 11 events", data?.data?.length === 11);

    if (data?.data?.length > 0) {
      const labels = data.data.map((e) => e.label);
      console.log("  Timeline events:");
      data.data.forEach((e) => {
        const time = new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        console.log(`    ${time}  ${e.label}${e.description ? " — " + e.description : ""}`);
      });

      log("First event is SOS Triggered", labels[0] === "SOS Triggered");
      log("Last event is Arrived at Hospital", labels[labels.length - 1] === "Arrived at Hospital");
    }
  }

  // ─── 9. 404 ENDPOINT ───
  console.log("\n── 9. 404 Handler ──");
  {
    const { status, data } = await req("GET", "/nonexistent");
    log("Unknown route returns 404", status === 404);
    log("Error code is NOT_FOUND", data?.error?.code === "NOT_FOUND");
  }

  // ─── SUMMARY ───
  console.log("\n" + "═".repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("═".repeat(60) + "\n");

  if (failed > 0) {
    console.log("FAILED TESTS:");
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.label}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test runner failed:", e.message);
  process.exit(1);
});
