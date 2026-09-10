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
  CommonResources,
  ETAResult,
} from '../../src/index';
import { buildHospital, abcdRanked, emergencyId, hospitalId } from '../helpers';

const BASE = new Date('2026-09-10T12:00:00Z');

function traumaReq(id = 'ADV') {
  return createEmergencyRequirement({
    emergencyId: createEmergencyId(id),
    probableEmergencyType: 'TRAUMA',
    requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
    requiredResources: [{ resourceType: CommonResources.ICU_BEDS, minimumQuantity: 1, requirementLevel: 'MANDATORY' }],
    severity: 'CRITICAL',
    patientLocation: { latitude: 28.61, longitude: 77.2 },
    ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
  });
}

function rankingEngine(built: ReturnType<typeof buildHospital>[], eta = new HaversineETAProvider(60)) {
  return new HospitalRankingEngine(
    new InMemoryHospitalProfileProvider(built.map((b) => b.profile)),
    new InMemoryHospitalLiveStatusProvider(built.map((b) => b.status)),
    eta,
    new InMemoryClockProvider(BASE)
  );
}

describe('Adversarial: ranking never crashes or produces invalid scores', () => {
  test('empty hospital universe → explicit noEligibleHospitals, no throw', async () => {
    const engine = rankingEngine([]);
    const r = await engine.rankHospitals({ emergency: traumaReq() });
    expect(r.noEligibleHospitals).toBe(true);
    expect(r.rankedHospitals).toEqual([]);
    expect(r.totalConsidered).toBe(0);
  });

  test('NaN / Infinity / huge resource counts never inflate a score or crash', async () => {
    const built = [
      buildHospital({ id: 'H-nan', beds: { icu: NaN as unknown as number } }, BASE),
      buildHospital({ id: 'H-inf', beds: { icu: Infinity } }, BASE),
      buildHospital({ id: 'H-huge', beds: { icu: 1e12 } }, BASE),
      buildHospital({ id: 'H-neg', beds: { icu: -5 } }, BASE),
    ];
    const engine = rankingEngine(built);
    const r = await engine.rankHospitals({ emergency: traumaReq() });
    for (const h of r.rankedHospitals) {
      expect(Number.isFinite(h.finalScore)).toBe(true);
      expect(h.finalScore).toBeLessThanOrEqual(1);
      expect(h.finalScore).toBeGreaterThanOrEqual(0);
    }
    // NaN and negative ICU beds must fail the mandatory-resource check (treated as 0).
    const nanH = r.excludedHospitals.find((e) => e.hospitalId === 'H-nan');
    const negH = r.excludedHospitals.find((e) => e.hospitalId === 'H-neg');
    expect(nanH?.reasons.some((x) => x.type === 'MISSING_MANDATORY_RESOURCE')).toBe(true);
    expect(negH?.reasons.some((x) => x.type === 'MISSING_MANDATORY_RESOURCE')).toBe(true);
    // Huge finite count is valid and can be eligible.
    expect(r.rankedHospitals.some((h) => h.hospitalId === 'H-huge')).toBe(true);
  });

  test('negative distance + negative ETA are excluded as invalid, never favorable', async () => {
    const built = [buildHospital({ id: 'H-bad' }, BASE)];
    const negEta = { async calculateETA(): Promise<ETAResult> { return { distanceKm: -10, etaSeconds: -600, timestamp: BASE, provider: 'bad' }; } };
    const engine = rankingEngine(built, negEta as any);
    const r = await engine.rankHospitals({ emergency: traumaReq() });
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'INVALID_ETA_DATA')).toBe(true);
  });

  test('contradictory provider data (accepting but OFFLINE) is excluded, deterministically', async () => {
    const built = [buildHospital({ id: 'H-x', accepting: true, operational: 'OFFLINE' }, BASE)];
    const engine = rankingEngine(built);
    const r = await engine.rankHospitals({ emergency: traumaReq() });
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'HOSPITAL_NOT_OPERATIONAL')).toBe(true);
  });

  test('all hospitals invalid → every one reported with a reason, none ranked', async () => {
    const built = [
      buildHospital({ id: 'H-1', accepting: false }, BASE),
      buildHospital({ id: 'H-2', operational: 'MAINTENANCE' }, BASE),
      buildHospital({ id: 'H-3', capabilities: [CommonCapabilities.CARDIAC_EMERGENCY] }, BASE),
    ];
    const engine = rankingEngine(built);
    const r = await engine.rankHospitals({ emergency: traumaReq() });
    expect(r.eligibleCount).toBe(0);
    expect(r.excludedCount).toBe(3);
    for (const e of r.excludedHospitals) expect(e.reasons.length).toBeGreaterThan(0);
  });
});

describe('Adversarial: selection never corrupts state', () => {
  test('malformed / wrong-emergency / duplicate callbacks cannot mutate a locked assignment', async () => {
    const clock = new InMemoryClockProvider(BASE);
    const engine = new HospitalSelectionEngine(clock, new InMemorySelectionStateStore());
    const emId = emergencyId('ADV-LOCK');
    const { A, B, C } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B, C], topN: 3 });
    const cand = (r: number) => snap.candidates.find((c) => c.rank === r)!;
    await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    await engine.processPickup({ emergencyId: emId, pickedUpAt: clock.now() });

    // Barrage of adversarial post-lock inputs.
    const attacks = [
      engine.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: B.hospitalId, response: 'ACCEPT' }),
      engine.processResponse({ emergencyId: emId, candidateId: cand(3).candidateId, hospitalId: C.hospitalId, response: 'ACCEPT' }),
      engine.processResponse({ emergencyId: emId, candidateId: 'garbage-id', hospitalId: hospitalId('H-zzz'), response: 'ACCEPT' }),
      engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'REJECT' }),
      engine.processPickup({ emergencyId: emId, pickedUpAt: clock.now() }),
    ];
    await Promise.all(attacks);
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(A.hospitalId);
    expect(await engine.isLocked(emId)).toBe(true);
  });

  test('response with a candidateId from a different emergency is rejected as unknown', async () => {
    const engine = new HospitalSelectionEngine(new InMemoryClockProvider(BASE), new InMemorySelectionStateStore());
    const emA = emergencyId('ADV-A');
    const emB = emergencyId('ADV-B');
    const a = abcdRanked();
    const snapA = await engine.initializeSelection({ emergencyId: emA, rankedHospitals: a.list, topN: 2 });
    await engine.initializeSelection({ emergencyId: emB, rankedHospitals: abcdRanked().list, topN: 2 });
    const foreign = snapA.candidates[0];
    const d = await engine.processResponse({ emergencyId: emB, candidateId: foreign.candidateId, hospitalId: foreign.hospitalId, response: 'ACCEPT' });
    expect(d.reason.type).toBe('RESPONSE_REJECTED_UNKNOWN_CANDIDATE');
    expect(await engine.getCurrentAssignment(emB)).toBeUndefined();
  });
});
