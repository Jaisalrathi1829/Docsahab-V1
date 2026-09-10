// ============================================================================
// Docsahab — Unified Database Seed
// ============================================================================
// Seeds Patient, Ambulance, and Hospital tables with realistic test data.
// Based on Person 5's seed logic, upgraded with realistic data and
// idempotent upsert operations.
//
// Usage:
//   npx prisma db seed
//   (or) npx tsx prisma/seed.ts
// ============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --------------------------------------------------------------------------
// Patients — Realistic profiles for SOS demo
// --------------------------------------------------------------------------

const patients = [
  {
    id: "patient-arjun-001",
    fullName: "Arjun Raghavan",
    age: 34,
    sex: "Male",
    bloodGroup: "O+",
    allergies: ["Penicillin", "Peanuts"],
    conditions: ["Asthma", "Hypertension"],
    phoneNumber: "9876543001",
  },
  {
    id: "patient-priya-002",
    fullName: "Priya Sharma",
    age: 28,
    sex: "Female",
    bloodGroup: "A+",
    allergies: ["Sulfa Drugs"],
    conditions: ["Diabetes Type 1"],
    phoneNumber: "9876543002",
  },
  {
    id: "patient-vikram-003",
    fullName: "Vikram Patel",
    age: 58,
    sex: "Male",
    bloodGroup: "B+",
    allergies: [],
    conditions: ["Coronary Artery Disease", "Hypertension"],
    phoneNumber: "9876543003",
  },
  {
    id: "patient-meera-004",
    fullName: "Meera Reddy",
    age: 42,
    sex: "Female",
    bloodGroup: "AB-",
    allergies: ["Ibuprofen", "Latex"],
    conditions: ["Epilepsy"],
    phoneNumber: "9876543004",
  },
  {
    id: "patient-rahul-005",
    fullName: "Rahul Gupta",
    age: 19,
    sex: "Male",
    bloodGroup: "O-",
    allergies: [],
    conditions: [],
    phoneNumber: "9876543005",
  },
];

// --------------------------------------------------------------------------
// Ambulances — Delhi NCR fleet
// --------------------------------------------------------------------------

// Each unit has a loggable crew mobile number (98000000NN) so the ambulance
// app can sign in as a real, fully-provisioned ambulance with no manual DB
// editing. Signing in with any OTHER number creates a fresh unregistered
// ambulance that must complete the profile step first.
const ambulances = [
  { id: "amb-001", vehicleNo: "DL-3C-AM-4521", latitude: 28.6139, longitude: 77.2090, phoneNumber: "9800000001", driverName: "Arjun Sharma", ambulanceType: "BLS" },
  { id: "amb-002", vehicleNo: "DL-3C-AM-4522", latitude: 28.6280, longitude: 77.2190, phoneNumber: "9800000002", driverName: "Ravi Kumar", ambulanceType: "ALS" },
  { id: "amb-003", vehicleNo: "DL-3C-AM-4523", latitude: 28.5900, longitude: 77.2000, phoneNumber: "9800000003", driverName: "Imran Khan", ambulanceType: "BLS" },
  { id: "amb-004", vehicleNo: "DL-3C-AM-4524", latitude: 28.6350, longitude: 77.2250, phoneNumber: "9800000004", driverName: "Sanjay Patel", ambulanceType: "BLS" },
  { id: "amb-005", vehicleNo: "DL-3C-AM-4525", latitude: 28.6500, longitude: 77.2300, phoneNumber: "9800000005", driverName: "Deepak Verma", ambulanceType: "ALS" },
  { id: "amb-006", vehicleNo: "DL-7B-AM-1101", latitude: 28.5700, longitude: 77.1900, phoneNumber: "9800000006", driverName: "Manoj Yadav", ambulanceType: "BLS" },
  { id: "amb-007", vehicleNo: "DL-7B-AM-1102", latitude: 28.6100, longitude: 77.2350, phoneNumber: "9800000007", driverName: "Vikas Singh", ambulanceType: "BLS" },
  { id: "amb-008", vehicleNo: "DL-7B-AM-1103", latitude: 28.6400, longitude: 77.2100, phoneNumber: "9800000008", driverName: "Rahul Mehra", ambulanceType: "ALS" },
  { id: "amb-009", vehicleNo: "DL-9A-AM-3301", latitude: 28.5800, longitude: 77.2150, phoneNumber: "9800000009", driverName: "Amit Joshi", ambulanceType: "BLS" },
  { id: "amb-010", vehicleNo: "DL-9A-AM-3302", latitude: 28.6200, longitude: 77.1950, phoneNumber: "9800000010", driverName: "Nitin Rao", ambulanceType: "BLS" },
];

// --------------------------------------------------------------------------
// Hospitals — Delhi NCR facilities with varied capabilities
// --------------------------------------------------------------------------

const hospitals = [
  {
    id: "hosp-001",
    name: "AIIMS Delhi",
    latitude: 28.5672,
    longitude: 77.2100,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: true,
    availableBeds: 12,
    phoneNumber: "9700000001",
    liveStatus: { icuBedsAvailable: 6, generalBedsAvailable: 12, erBaysAvailable: 8, traumaBaysAvailable: 5, ventilatorsAvailable: 4 },
  },
  {
    id: "hosp-002",
    name: "Safdarjung Hospital",
    latitude: 28.5683,
    longitude: 77.2067,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: false,
    availableBeds: 8,
    phoneNumber: "9700000002",
    liveStatus: { icuBedsAvailable: 3, generalBedsAvailable: 8, erBaysAvailable: 6, traumaBaysAvailable: 4, ventilatorsAvailable: 2 },
  },
  {
    id: "hosp-003",
    name: "Max Super Specialty — Saket",
    latitude: 28.5274,
    longitude: 77.2137,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: true,
    availableBeds: 15,
    phoneNumber: "9700000003",
    liveStatus: { icuBedsAvailable: 8, generalBedsAvailable: 15, erBaysAvailable: 10, traumaBaysAvailable: 6, ventilatorsAvailable: 5 },
  },
  {
    id: "hosp-004",
    name: "Sir Ganga Ram Hospital",
    latitude: 28.6383,
    longitude: 77.1900,
    hasICU: true,
    hasTraumaCare: false,
    hasCardiology: true,
    availableBeds: 6,
    phoneNumber: "9700000004",
    liveStatus: { icuBedsAvailable: 3, generalBedsAvailable: 6, erBaysAvailable: 4, traumaBaysAvailable: 0, ventilatorsAvailable: 2 },
  },
  {
    id: "hosp-005",
    name: "Fortis Escorts Heart Institute",
    latitude: 28.5535,
    longitude: 77.2230,
    hasICU: true,
    hasTraumaCare: false,
    hasCardiology: true,
    availableBeds: 10,
    phoneNumber: "9700000005",
    liveStatus: { icuBedsAvailable: 5, generalBedsAvailable: 10, erBaysAvailable: 6, traumaBaysAvailable: 0, ventilatorsAvailable: 4 },
  },
  {
    id: "hosp-006",
    name: "RML Hospital",
    latitude: 28.6263,
    longitude: 77.2042,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: false,
    availableBeds: 4,
    phoneNumber: "9700000006",
    liveStatus: { icuBedsAvailable: 1, generalBedsAvailable: 4, erBaysAvailable: 3, traumaBaysAvailable: 2, ventilatorsAvailable: 1 },
  },
  {
    id: "hosp-007",
    name: "Lok Nayak Hospital",
    latitude: 28.6372,
    longitude: 77.2398,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: true,
    availableBeds: 9,
    phoneNumber: "9700000007",
    liveStatus: { icuBedsAvailable: 4, generalBedsAvailable: 9, erBaysAvailable: 6, traumaBaysAvailable: 4, ventilatorsAvailable: 3 },
  },
  {
    id: "hosp-008",
    name: "Apollo Hospital — Indraprastha",
    latitude: 28.5580,
    longitude: 77.2835,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: true,
    availableBeds: 20,
    phoneNumber: "9700000008",
    liveStatus: { icuBedsAvailable: 10, generalBedsAvailable: 20, erBaysAvailable: 14, traumaBaysAvailable: 8, ventilatorsAvailable: 8 },
  },
  {
    id: "hosp-009",
    name: "BLK-Max Super Specialty",
    latitude: 28.6453,
    longitude: 77.1862,
    hasICU: true,
    hasTraumaCare: false,
    hasCardiology: true,
    availableBeds: 7,
    phoneNumber: "9700000009",
    liveStatus: { icuBedsAvailable: 3, generalBedsAvailable: 7, erBaysAvailable: 5, traumaBaysAvailable: 0, ventilatorsAvailable: 2 },
  },
  {
    id: "hosp-010",
    name: "GTB Hospital",
    latitude: 28.6860,
    longitude: 77.3105,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: false,
    availableBeds: 11,
    phoneNumber: "9700000010",
    liveStatus: { icuBedsAvailable: 5, generalBedsAvailable: 11, erBaysAvailable: 7, traumaBaysAvailable: 5, ventilatorsAvailable: 3 },
  },
  // Demo hospital (hackathon demo pair: patient 1111111111 -> ambulance
  // 2222222222 -> this hospital, 3333333333). A REAL seeded hospital, at the
  // demo ambulance's Connaught Place position for a genuinely strong ETA
  // score, with full capabilities/capacity so it is honestly eligible for
  // any emergency type — no fabricated eligibility, no special-cased data.
  {
    id: "hosp-demo-001",
    name: "Docsahab Demo Hospital",
    latitude: 28.6139,
    longitude: 77.2090,
    hasICU: true,
    hasTraumaCare: true,
    hasCardiology: true,
    availableBeds: 25,
    phoneNumber: "3333333333",
    liveStatus: { icuBedsAvailable: 12, generalBedsAvailable: 25, erBaysAvailable: 15, traumaBaysAvailable: 10, ventilatorsAvailable: 10 },
  },
];

// --------------------------------------------------------------------------
// Main seed function
// --------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding Docsahab database...\n");

  // Patients
  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }
  console.log(`  ✅ ${patients.length} patients seeded`);

  // Ambulances.
  //
  // The demo fleet is seeded ONLINE and available so a fresh database can run
  // the full workflow immediately — dispatch requires both flags. The update
  // branch resets those two dispatch flags on every seed so a re-seed reliably
  // returns the fleet to a clean, dispatchable state after a previous run
  // (crew profile fields entered through the app are intentionally preserved).
  for (const a of ambulances) {
    const provisioned = {
      ...a,
      isOnline: true,
      isAvailable: true,
      registrationNumber: a.vehicleNo,
      serviceArea: "Delhi",
      baseLocation: "Delhi NCR",
      profileCompleted: true,
    };
    // The update branch carries the SAME full payload as create. A partial
    // update here would leave rows seeded before these columns existed without
    // a crew phone number, so signing in with a demo number would silently
    // create a second, unregistered ambulance instead of matching the fleet.
    await prisma.ambulance.upsert({
      where: { id: a.id },
      update: provisioned,
      create: provisioned,
    });
  }
  console.log(`  ✅ ${ambulances.length} ambulances seeded`);

  // Hospitals — update branch carries the FULL payload so re-seeding an
  // existing row applies new fields (phoneNumber, etc.), not just creates.
  for (const h of hospitals) {
    const { liveStatus, ...hospitalFields } = h;
    await prisma.hospital.upsert({
      where: { id: h.id },
      update: hospitalFields,
      create: hospitalFields,
    });
    await prisma.hospitalLiveStatus.upsert({
      where: { hospitalId: h.id },
      update: { ...liveStatus, lastUpdated: new Date() },
      create: {
        hospitalId: h.id,
        acceptingEmergencyPatients: true,
        operationalStatus: "OPERATIONAL",
        emergencyDepartmentStatus: "AVAILABLE",
        traumaDepartmentStatus: h.hasTraumaCare ? "AVAILABLE" : "UNKNOWN",
        ...liveStatus,
        bloodProductsAvailable: true,
        dataSource: "SEED",
        lastUpdated: new Date(),
      },
    });
  }
  console.log(`  ✅ ${hospitals.length} hospitals seeded (with real live-status rows)`);

  console.log("\n🎉 Seed complete!\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
