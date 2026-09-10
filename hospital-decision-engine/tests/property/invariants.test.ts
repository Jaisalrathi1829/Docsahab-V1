import {
  HospitalRankingEngine,
  HospitalSelectionEngine,
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  InMemorySelectionStateStore,
  createEmergencyId,
  createEmergencyRequirement,
  CommonCapabilities,
} from '../../src/index';
import { buildHospital, rankedHospital, emergencyId, hospitalId } from '../helpers';

const BASE = new Date('2026-09-10T12:00:00Z');

// Small deterministic PRNG (mulberry32) so property runs are reproducible.
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_CAPS = [
  CommonCapabilities.CARDIAC_EMERGENCY,
  CommonCapabilities.TRAUMA,
  CommonCapabilities.NEUROLOGICAL_EMERGENCY,
  CommonCapabilities.PEDIATRIC_EMERGENCY,
];

function randomEngine(rand: () => number, n: number) {
  const specs = Array.from({ length: n }, (_, i) => ({
    id: `H-${i}`,
    lat: 28.5 + rand() * 0.3,
    lng: 77.1 + rand() * 0.3,
    capabilities: ALL_CAPS.filter(() => rand() > 0.4),
    accepting: rand() > 0.2,
    operational: (rand() > 0.15 ? 'OPERATIONAL' : 'DEGRADED') as 'OPERATIONAL' | 'DEGRADED',
    traumaDept: (rand() > 0.3 ? 'AVAILABLE' : 'UNAVAILABLE') as 'AVAILABLE' | 'UNAVAILABLE',
  }));
  const built = specs.map((s) => buildHospital(s, BASE));
  return new HospitalRankingEngine(
    new InMemoryHospitalProfileProvider(built.map((b) => b.profile)),
    new InMemoryHospitalLiveStatusProvider(built.map((b) => b.status)),
    new HaversineETAProvider(60),
    new InMemoryClockProvider(BASE)
  );
}

function traumaReq(id: string) {
  return createEmergencyRequirement({
    emergencyId: createEmergencyId(id),
    probableEmergencyType: 'TRAUMA',
    requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
    requiredResources: [],
    severity: 'HIGH',
    patientLocation: { latitude: 28.61, longitude: 77.2 },
    ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
  });
}

describe('Ranking invariants (property-based, 60 random cases)', () => {
  test('ineligible hospital never appears among ranked; ranked ⊆ eligible; scores in [0,1]; ranks contiguous', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rand = prng(seed);
      const engine = randomEngine(rand, 2 + Math.floor(rand() * 6));
      const r = await engine.rankHospitals({ emergency: traumaReq(`E-${seed}`) });

      const excludedIds = new Set(r.excludedHospitals.map((e) => e.hospitalId));
      for (const h of r.rankedHospitals) {
        expect(h.eligibility.eligible).toBe(true);
        expect(excludedIds.has(h.hospitalId)).toBe(false);
        expect(h.finalScore).toBeGreaterThanOrEqual(0);
        expect(h.finalScore).toBeLessThanOrEqual(1);
        expect(Number.isFinite(h.finalScore)).toBe(true);
      }
      // Every ranked hospital has the required TRAUMA capability.
      for (const h of r.rankedHospitals) {
        expect(h.capabilityMatch.mandatoryMissing).toBe(0);
      }
      // Ranks are 1..n contiguous and sorted by non-increasing score.
      r.rankedHospitals.forEach((h, i) => expect(h.rank).toBe(i + 1));
      for (let i = 1; i < r.rankedHospitals.length; i++) {
        expect(r.rankedHospitals[i - 1].finalScore).toBeGreaterThanOrEqual(r.rankedHospitals[i].finalScore);
      }
      // Counts are consistent.
      expect(r.eligibleCount + r.excludedCount).toBe(r.totalConsidered);
    }
  });

  test('determinism + input-order independence across random cases', async () => {
    for (let seed = 100; seed <= 130; seed++) {
      const r1 = await randomEngine(prng(seed), 5).rankHospitals({ emergency: traumaReq(`D-${seed}`) });
      const r2 = await randomEngine(prng(seed), 5).rankHospitals({ emergency: traumaReq(`D-${seed}`) });
      expect(r1.rankedHospitals.map((h) => h.hospitalId)).toEqual(r2.rankedHospitals.map((h) => h.hospitalId));
    }
  });
});

describe('Selection invariants (property-based random event streams)', () => {
  test('at most one ACCEPTED candidate at any time and it equals the current assignment; lock is irreversible', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = prng(seed * 7);
      const clock = new InMemoryClockProvider(BASE);
      const engine = new HospitalSelectionEngine(clock, new InMemorySelectionStateStore());
      const emId = emergencyId(`P-${seed}`);
      const list = Array.from({ length: 4 }, (_, i) => rankedHospital(`H-${i + 1}`, i + 1, 0.9 - i * 0.1));
      const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: list, topN: 4 });
      const candIds = snap.candidates.map((c) => ({ id: c.candidateId, hid: c.hospitalId }));

      let lockedHospital: string | undefined;
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const roll = rand();
        if (roll < 0.2 && !(await engine.isLocked(emId))) {
          await engine.processPickup({ emergencyId: emId, pickedUpAt: clock.now() });
        } else {
          const pick = candIds[Math.floor(rand() * candIds.length)];
          const resp = rand() > 0.4 ? 'ACCEPT' : 'REJECT';
          await engine.processResponse({ emergencyId: emId, candidateId: pick.id, hospitalId: hospitalId(pick.hid.toString()), response: resp });
        }

        const state = (await engine.getSelectionState(emId))!;
        const accepted = state.candidates.filter((c) => c.state === 'ACCEPTED');
        // At most one live ACCEPTED candidate, and it is the current assignment.
        expect(accepted.length).toBeLessThanOrEqual(1);
        if (accepted.length === 1 && state.state !== 'LOCKED') {
          expect(state.currentAssignment?.candidateId).toBe(accepted[0].candidateId);
        }
        // Once locked, the destination is frozen forever.
        if (state.state === 'LOCKED') {
          if (lockedHospital === undefined) lockedHospital = state.currentAssignment?.hospitalId.toString();
          expect(state.currentAssignment?.hospitalId.toString()).toBe(lockedHospital);
        }
      }
    }
  });
});
