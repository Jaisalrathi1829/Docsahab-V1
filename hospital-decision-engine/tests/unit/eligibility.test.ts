import {
  HospitalRankingEngine,
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createEmergencyId,
  createEmergencyRequirement,
  CommonCapabilities,
} from '../../src/index';
import { buildHospital } from '../helpers';

const BASE = new Date('2026-09-10T12:00:00Z');

function engineFrom(specs: Parameters<typeof buildHospital>[0][]) {
  const built = specs.map((s) => buildHospital(s, BASE));
  return new HospitalRankingEngine(
    new InMemoryHospitalProfileProvider(built.map((b) => b.profile)),
    new InMemoryHospitalLiveStatusProvider(built.map((b) => b.status)),
    new HaversineETAProvider(60),
    new InMemoryClockProvider(BASE)
  );
}

function requirement(caps: Array<{ capability: any; requirementLevel: 'MANDATORY' | 'PREFERRED' }>, id = 'EMG') {
  return createEmergencyRequirement({
    emergencyId: createEmergencyId(id),
    probableEmergencyType: 'X',
    requiredCapabilities: caps,
    requiredResources: [],
    severity: 'HIGH',
    patientLocation: { latitude: 28.61, longitude: 77.2 },
    ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
  });
}

describe('Eligibility filtering', () => {
  test('P1-4 REGRESSION: unrelated trauma-dept-unavailable does NOT exclude a cardiac hospital in a cardiac emergency', async () => {
    const engine = engineFrom([
      { id: 'H-cardiac', capabilities: [CommonCapabilities.CARDIAC_EMERGENCY], traumaDept: 'UNAVAILABLE' },
    ]);
    const r = await engine.rankHospitals({
      emergency: requirement([{ capability: CommonCapabilities.CARDIAC_EMERGENCY, requirementLevel: 'MANDATORY' }]),
    });
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toEqual(['H-cardiac']);
  });

  test('trauma-dept-unavailable DOES exclude when the emergency requires TRAUMA', async () => {
    const engine = engineFrom([
      { id: 'H-trauma', capabilities: [CommonCapabilities.TRAUMA], traumaDept: 'UNAVAILABLE' },
    ]);
    const r = await engine.rankHospitals({
      emergency: requirement([{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }]),
    });
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'DEPARTMENT_UNAVAILABLE')).toBe(true);
  });

  test('not accepting emergency patients → excluded', async () => {
    const engine = engineFrom([{ id: 'H-closed', accepting: false }]);
    const r = await engine.rankHospitals({ emergency: requirement([{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }]) });
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'NOT_ACCEPTING_EMERGENCY_PATIENTS')).toBe(true);
  });

  test('non-operational hospital → excluded', async () => {
    const engine = engineFrom([{ id: 'H-degraded', operational: 'DEGRADED' }]);
    const r = await engine.rankHospitals({ emergency: requirement([{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }]) });
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'HOSPITAL_NOT_OPERATIONAL')).toBe(true);
  });

  test('P1-7: missing live status is reported (MISSING_LIVE_STATUS), not silently dropped, and counted', async () => {
    const withProfile = buildHospital({ id: 'H-nostatus' }, BASE);
    const withBoth = buildHospital({ id: 'H-full', lat: 28.6, lng: 77.19 }, BASE);
    const engine = new HospitalRankingEngine(
      new InMemoryHospitalProfileProvider([withProfile.profile, withBoth.profile]),
      new InMemoryHospitalLiveStatusProvider([withBoth.status]), // H-nostatus has NO live status
      new HaversineETAProvider(60),
      new InMemoryClockProvider(BASE)
    );
    const r = await engine.rankHospitals({ emergency: requirement([{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }]) });
    expect(r.totalConsidered).toBe(2);
    expect(r.excludedHospitals.find((e) => e.hospitalId === 'H-nostatus')?.reasons[0].type).toBe('MISSING_LIVE_STATUS');
  });

  test('Phase 6: zero eligible hospitals → explicit deterministic result, not an unexplained empty array', async () => {
    const engine = engineFrom([
      { id: 'H-1', accepting: false },
      { id: 'H-2', operational: 'OFFLINE' },
    ]);
    const r = await engine.rankHospitals({ emergency: requirement([{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }]) });
    expect(r.noEligibleHospitals).toBe(true);
    expect(r.eligibleCount).toBe(0);
    expect(r.excludedCount).toBe(2);
    expect(r.totalConsidered).toBe(2);
    expect(r.excludedHospitals.length).toBe(2);
  });

  test('explicitly excluded hospital id is filtered with EXPLICITLY_EXCLUDED', async () => {
    const engine = engineFrom([{ id: 'H-x' }, { id: 'H-y', lat: 28.6, lng: 77.19 }]);
    const emergency = createEmergencyRequirement({
      emergencyId: createEmergencyId('EMG-EXC'),
      probableEmergencyType: 'TRAUMA',
      requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
      requiredResources: [],
      severity: 'HIGH',
      patientLocation: { latitude: 28.61, longitude: 77.2 },
      ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
      constraints: { excludedHospitalIds: [buildHospital({ id: 'H-x' }, BASE).profile.hospitalId] },
    });
    const r = await engine.rankHospitals({ emergency });
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toEqual(['H-y']);
  });
});
