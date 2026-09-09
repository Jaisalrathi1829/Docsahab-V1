/**
 * Docsahab — Test Data Seeder
 * 
 * Creates a test emergency and advances it through the lifecycle.
 * Stores the emergency ID so frontends can use it.
 */

const BASE = "http://localhost:3000/api/v1";

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `API ${res.status}`);
  return data.data;
}

async function main() {
  console.log("🌱 Seeding test data...\n");

  // 1. Create emergency
  const emergency = await req("POST", "/sos", {
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
  console.log(`✅ Emergency created: ${emergency.id}`);

  // 2. Ambulance assigned
  await req("PATCH", `/emergency/${emergency.id}/status`, {
    status: "AMBULANCE_ASSIGNED",
    assignedAmbulanceId: "amb-002",
    etaMinutes: 6,
    description: "BLS unit DL-3C-AM-4522 dispatched",
  });
  console.log("✅ AMBULANCE_ASSIGNED");

  // 3. Ambulance en route
  await req("PATCH", `/emergency/${emergency.id}/status`, {
    status: "AMBULANCE_EN_ROUTE",
    etaMinutes: 4,
    description: "Ambulance en route to patient",
  });
  console.log("✅ AMBULANCE_EN_ROUTE");

  console.log(`\n🆔 Emergency ID: ${emergency.id}`);
  console.log(`\n📋 Use this ID in the frontend apps.`);
  console.log(`   The emergency is at AMBULANCE_EN_ROUTE status.`);
  console.log(`   Frontend screens can display the current state and`);
  console.log(`   advance the lifecycle via API calls.\n`);

  // Write the ID to a file for frontend apps to read
  const fs = require("fs");
  const path = require("path");
  const outFile = path.join(__dirname, "active-emergency.json");
  fs.writeFileSync(
    outFile,
    JSON.stringify({ emergencyId: emergency.id, status: emergency.status }, null, 2)
  );
  console.log(`📁 Emergency ID saved to ${outFile}`);
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  process.exit(1);
});
