// ============================================================================
// READ-ONLY Integration Harness (Phase 24) — run with:  npx tsx examples/integration-harness.ts
// ============================================================================
// Demonstrates the full Docsahab → engine → decision → persistence flow using
// the REAL Docsahab hospital seed shapes (copied verbatim from
// backend/prisma/seed.ts) and the reference adapters. It touches NOTHING in the
// main app. Every fabricated field is labelled SIMULATED in the adapter and
// summarized at the end of this run.
// ============================================================================

import {
  HospitalRankingEngine,
  HospitalSelectionEngine,
  InMemoryClockProvider,
  InMemorySelectionStateStore,
  createHospitalId,
} from '../src/index';
import {
  DocsahabHospitalRow,
  DocsahabProfileProvider,
  DocsahabSimulatedLiveProvider,
  DocsahabNavigationETAProvider,
  deriveRequirement,
  FIELD_PROVENANCE,
} from './docsahab-reference-adapter';

// REAL Docsahab seed rows (verbatim from backend/prisma/seed.ts).
const ROWS: DocsahabHospitalRow[] = [
  { id: 'hosp-001', name: 'AIIMS Delhi', latitude: 28.5672, longitude: 77.21, hasICU: true, hasTraumaCare: true, hasCardiology: true, availableBeds: 12 },
  { id: 'hosp-002', name: 'Safdarjung Hospital', latitude: 28.5683, longitude: 77.2067, hasICU: true, hasTraumaCare: true, hasCardiology: false, availableBeds: 8 },
  { id: 'hosp-003', name: 'Max Super Specialty — Saket', latitude: 28.5274, longitude: 77.2137, hasICU: true, hasTraumaCare: true, hasCardiology: true, availableBeds: 15 },
  { id: 'hosp-004', name: 'Sir Ganga Ram Hospital', latitude: 28.6383, longitude: 77.19, hasICU: true, hasTraumaCare: false, hasCardiology: true, availableBeds: 6 },
  { id: 'hosp-005', name: 'Fortis Escorts Heart Institute', latitude: 28.5535, longitude: 77.223, hasICU: true, hasTraumaCare: false, hasCardiology: true, availableBeds: 10 },
];

async function main() {
  const now = new Date('2026-09-10T12:00:00Z');
  const clock = new InMemoryClockProvider(now);

  // A REAL Docsahab-shaped emergency (patient SOS → cardiac emergency).
  const requirement = deriveRequirement({
    emergencyId: 'emg-harness-001',
    probableEmergencyType: 'Cardiac Emergency — chest pain', // REAL: Docsahab probableEmergency string
    severity: 'CRITICAL',
    patientLocation: { latitude: 28.56, longitude: 77.21 },
    ambulanceLocation: { latitude: 28.55, longitude: 77.20 },
  });

  const ranking = new HospitalRankingEngine(
    new DocsahabProfileProvider(ROWS),
    new DocsahabSimulatedLiveProvider(ROWS, now),
    new DocsahabNavigationETAProvider(40),
    clock
  );

  const result = await ranking.rankHospitals({ emergency: requirement });

  console.log('\n=== RANKING RESULT (cardiac emergency) ===');
  console.log(`considered=${result.totalConsidered} eligible=${result.eligibleCount} excluded=${result.excludedCount} noEligible=${result.noEligibleHospitals}`);
  for (const h of result.rankedHospitals) {
    console.log(`  #${h.rank} ${h.hospitalId}  score=${h.finalScore.toFixed(4)}  eta=${Math.round((h.etaSeconds ?? 0) / 60)}min  cap=${h.factorScores.capabilityScore} res=${h.factorScores.resourceScore.toFixed(2)} freshness=${h.freshness}`);
  }
  for (const e of result.excludedHospitals) {
    console.log(`  x ${e.hospitalId}  excluded: ${e.reasons.map((r) => r.type).join(', ')}`);
  }

  // Selection: initialize, simulate out-of-order acceptances, replacement, pickup lock.
  const store = new InMemorySelectionStateStore();
  const selection = new HospitalSelectionEngine(clock, store);
  const emergencyId = result.emergencyId;
  const snap = await selection.initializeSelection({ emergencyId, rankedHospitals: result.rankedHospitals, topN: 3 });

  console.log('\n=== SELECTION FLOW ===');
  console.log(`invited top-${snap.candidates.length}: ${snap.candidates.map((c) => `#${c.rank} ${c.hospitalId}`).join(', ')}`);

  const byRank = (r: number) => snap.candidates.find((c) => c.rank === r)!;
  if (snap.candidates.length >= 3) {
    const d3 = await selection.processResponse({ emergencyId, candidateId: byRank(3).candidateId, hospitalId: byRank(3).hospitalId, response: 'ACCEPT' });
    console.log(`#3 accepts → ${d3.reason.type}; assignment=${(await selection.getCurrentAssignment(emergencyId))?.hospitalId}`);
    const d1 = await selection.processResponse({ emergencyId, candidateId: byRank(1).candidateId, hospitalId: byRank(1).hospitalId, response: 'ACCEPT' });
    console.log(`#1 accepts → ${d1.reason.type} (replacement=${d1.replacementOccurred}); assignment=${(await selection.getCurrentAssignment(emergencyId))?.hospitalId}; state=${(await selection.getSelectionState(emergencyId))?.state}`);
    const d2 = await selection.processResponse({ emergencyId, candidateId: byRank(2).candidateId, hospitalId: byRank(2).hospitalId, response: 'ACCEPT' });
    console.log(`#2 accepts (worse than #1) → ${d2.reason.type}; assignment stays ${(await selection.getCurrentAssignment(emergencyId))?.hospitalId}`);
  }

  const pickup = await selection.processPickup({ emergencyId, pickedUpAt: clock.now() });
  console.log(`pickup → ${pickup.reason.type}; locked=${await selection.isLocked(emergencyId)}; destination=${(await selection.getCurrentAssignment(emergencyId))?.hospitalId}`);

  const late = await selection.processResponse({ emergencyId, candidateId: byRank(2).candidateId, hospitalId: byRank(2).hospitalId, response: 'ACCEPT' });
  console.log(`late #2 accept after lock → ${late.reason.type}; destination unchanged=${(await selection.getCurrentAssignment(emergencyId))?.hospitalId}`);

  // Persistence-compatible result: what Docsahab would persist.
  const finalState = await selection.getSelectionState(emergencyId);
  const versioned = await store.load(emergencyId);
  console.log('\n=== PERSISTENCE-COMPATIBLE RESULT ===');
  console.log(`state=${finalState?.state} version=${versioned?.version} lockedAt=${finalState?.lockedAt?.toISOString()}`);
  console.log(`assignedHospitalId (→ Docsahab Emergency.assignedHospitalId) = ${finalState?.currentAssignment?.hospitalId}`);

  console.log('\n=== DATA PROVENANCE (honesty report) ===');
  console.log('REAL (from Docsahab Hospital table):', FIELD_PROVENANCE.REAL_FROM_HOSPITAL_TABLE.join(', '));
  console.log('SIMULATED (fabricated — require a HospitalLiveStatus migration before production):');
  console.log('  ', FIELD_PROVENANCE.SIMULATED_UNTIL_MIGRATION.join(', '));
  console.log('\nCONCLUSION: pipeline runs end-to-end on REAL Docsahab hospital shapes, but the');
  console.log('freshness/eligibility model depends on SIMULATED live fields. Integration is');
  console.log('CONTRACT COMPATIBLE; it is NOT production-real until the live-status table exists.');
}

main().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(1);
});
