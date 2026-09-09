// ============================================================================
// Demo Reset
// ============================================================================
// Returns the system to a clean, dispatchable state so the workflow demo can
// be run repeatedly without hand-editing the database.
//
//   npm run demo:reset
//
// WHAT IT DOES
//   - deletes every Emergency (and, by cascade, its timeline + hospital
//     candidates). Emergencies are demo/simulation data in this MVP.
//   - clears OTP challenges and sessions, so sign-in flows start fresh.
//   - returns the whole ambulance fleet to ONLINE + available.
//
// WHAT IT DOES NOT DO
//   - it never drops tables, never runs migrations, and never touches the
//     Patient / Ambulance / Hospital records themselves beyond dispatch flags.
//     Re-run `prisma/seed.ts` if you want the reference fleet reprovisioned.
//
// This is deliberately an explicit, separately-invoked script rather than
// something that runs automatically on boot — silently wiping state would be
// far worse than a stale row.
// ============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Resetting Docsahab demo state...\n");

  const staleEmergencies = await prisma.emergency.count({
    where: { status: { notIn: ["ARRIVED", "CANCELLED"] } },
  });

  const deleted = await prisma.emergency.deleteMany({});
  console.log(
    `  ✅ ${deleted.count} emergencies removed (${staleEmergencies} were still in progress)`
  );

  const sessions = await prisma.session.deleteMany({});
  console.log(`  ✅ ${sessions.count} sessions cleared`);

  const challenges = await prisma.otpChallenge.deleteMany({});
  console.log(`  ✅ ${challenges.count} OTP challenges cleared`);

  // Any unit left mid-job is handed back to dispatch.
  const fleet = await prisma.ambulance.updateMany({
    data: { isOnline: true, isAvailable: true },
  });
  console.log(`  ✅ ${fleet.count} ambulances returned to ONLINE + available`);

  // Shell records created by signing in with a number that is not part of the
  // seeded fleet — safe to drop, they hold no demo value.
  const shells = await prisma.ambulance.deleteMany({
    where: { vehicleNo: { startsWith: "UNREGISTERED-" } },
  });
  if (shells.count > 0) {
    console.log(`  ✅ ${shells.count} unregistered ambulance shells removed`);
  }

  console.log("\n🎉 Demo reset complete — run the workflow from a clean slate.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Reset failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
