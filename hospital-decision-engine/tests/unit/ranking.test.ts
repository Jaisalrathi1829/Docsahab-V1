import {
  HospitalRankingEngine,
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createEmergencyId,
  createEmergencyRequirement,
  CommonCapabilities,
  CommonResources,
  ETAResult,
} from '../../src/index';
import { buildHospital } from '../helpers';

const BASE = new Date('2026-09-10T12:00:00Z');

function engineFrom(specs: Parameters<typeof buildHospital>[0][], etaSpeed = 60) {
  const built = specs.map((s) => buildHospital(s, BASE));
  const profileProvider = new InMemoryHospitalProfileProvider(built.map((b) => b.profile));
  const liveStatusProvider = new InMemoryHospitalLiveStatusProvider(built.map((b) => b.status));
  const clock = new InMemoryClockProvider(BASE);
  return new HospitalRankingEngine(profileProvider, liveStatusProvider, new HaversineETAProvider(etaSpeed), clock);
}

function traumaEmergency(id = 'EMG') {
  return createEmergencyRequirement({
    emergencyId: createEmergencyId(id),
    probableEmergencyType: 'TRAUMA',
    requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
    requiredResources: [],
    severity: 'HIGH',
    patientLocation: { latitude: 28.61, longitude: 77.20 },
    ambulanceLocation: { latitude: 28.60, longitude: 77.19 },
  });
}

describe('Ranking engine', () => {
  test('deterministic: identical inputs → identical output', async () => {
    const specs = [{ id: 'H-1' }, { id: 'H-2' }, { id: 'H-3' }];
    const e1 = engineFrom(specs);
    const e2 = engineFrom(specs);
    const r1 = await e1.rankHospitals({ emergency: traumaEmergency() });
    const r2 = await e2.rankHospitals({ emergency: traumaEmergency() });
    expect(r1.rankedHospitals).toEqual(r2.rankedHospitals);
  });

  test('hard filter before scoring: a missing mandatory capability is excluded, not scored', async () => {
    const engine = engineFrom([
      { id: 'H-cardiac', capabilities: [CommonCapabilities.CARDIAC_EMERGENCY] },
      { id: 'H-trauma', capabilities: [CommonCapabilities.TRAUMA] },
    ]);
    const r = await engine.rankHospitals({ emergency: traumaEmergency() });
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toEqual(['H-trauma']);
    expect(r.excludedHospitals.find((e) => e.hospitalId === 'H-cardiac')?.reasons[0].type).toBe('MISSING_MANDATORY_CAPABILITY');
  });

  test('50/30/20 weights and ETA decay produce the documented final score', async () => {
    // Single hospital, no required resources → capability=1, resource=1, eta = 1 - eta/maxEta.
    const engine = engineFrom([{ id: 'H-1', lat: 28.60, lng: 77.19 }]); // ~0km from ambulance → tiny ETA
    const r = await engine.rankHospitals({ emergency: traumaEmergency() });
    const h = r.rankedHospitals[0];
    const expectedEtaScore = 1 - (h.etaSeconds ?? 0) / (30 * 60);
    const expected = 1 * 0.5 + expectedEtaScore * 0.3 + 1 * 0.2;
    expect(h.finalScore).toBeCloseTo(expected, 6);
  });

  test('higher ETA never improves ETA score (monotonic)', async () => {
    const near = engineFrom([{ id: 'H-near', lat: 28.60, lng: 77.19 }]);
    const far = engineFrom([{ id: 'H-far', lat: 28.70, lng: 77.30 }]); // ~15km, still within range
    const rNear = await near.rankHospitals({ emergency: traumaEmergency() });
    const rFar = await far.rankHospitals({ emergency: traumaEmergency() });
    expect(rNear.rankedHospitals[0].factorScores.etaScore).toBeGreaterThan(rFar.rankedHospitals[0].factorScores.etaScore);
  });

  test('ranking is independent of hospital input order', async () => {
    const a = engineFrom([{ id: 'H-1', lat: 28.60 }, { id: 'H-2', lat: 28.62 }, { id: 'H-3', lat: 28.64 }]);
    const b = engineFrom([{ id: 'H-3', lat: 28.64 }, { id: 'H-1', lat: 28.60 }, { id: 'H-2', lat: 28.62 }]);
    const ra = await a.rankHospitals({ emergency: traumaEmergency() });
    const rb = await b.rankHospitals({ emergency: traumaEmergency() });
    expect(ra.rankedHospitals.map((h) => h.hospitalId)).toEqual(rb.rankedHospitals.map((h) => h.hospitalId));
  });

  test('resource requirement enforced: insufficient mandatory ICU beds excludes', async () => {
    const engine = engineFrom([
      { id: 'H-plenty', beds: { icu: 10 } },
      { id: 'H-none', beds: { icu: 0 } },
    ]);
    const emergency = createEmergencyRequirement({
      emergencyId: createEmergencyId('EMG-ICU'),
      probableEmergencyType: 'TRAUMA',
      requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
      requiredResources: [{ resourceType: CommonResources.ICU_BEDS, minimumQuantity: 2, requirementLevel: 'MANDATORY' }],
      severity: 'CRITICAL',
      patientLocation: { latitude: 28.61, longitude: 77.2 },
      ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
    });
    const r = await engine.rankHospitals({ emergency });
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toEqual(['H-plenty']);
    expect(r.excludedHospitals.find((e) => e.hospitalId === 'H-none')?.reasons.some((x) => x.type === 'MISSING_MANDATORY_RESOURCE')).toBe(true);
  });

  test('malformed ETA (NaN/negative/Infinity) excludes with INVALID_ETA_DATA, never a favorable score', async () => {
    const built = [buildHospital({ id: 'H-nan' }, BASE), buildHospital({ id: 'H-neg' }, BASE), buildHospital({ id: 'H-inf' }, BASE), buildHospital({ id: 'H-ok', lat: 28.6, lng: 77.19 }, BASE)];
    const profileProvider = new InMemoryHospitalProfileProvider(built.map((b) => b.profile));
    const liveStatusProvider = new InMemoryHospitalLiveStatusProvider(built.map((b) => b.status));
    const clock = new InMemoryClockProvider(BASE);
    // Malformed ETA provider: only H-ok gets a valid result; the rest get negatives.
    const byId: any = {
      async calculateETA(_o: any, dest: any) {
        if (dest.latitude === built[3].profile.location.latitude && dest.longitude === built[3].profile.location.longitude) {
          return { distanceKm: 2, etaSeconds: 200, timestamp: BASE, provider: 'ok' };
        }
        return { distanceKm: -1, etaSeconds: -1, timestamp: BASE, provider: 'bad' };
      },
    };
    const engine = new HospitalRankingEngine(profileProvider, liveStatusProvider, byId, clock);
    const r = await engine.rankHospitals({ emergency: traumaEmergency() });
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toEqual(['H-ok']);
    for (const e of r.excludedHospitals) {
      expect(e.reasons.some((x) => x.type === 'INVALID_ETA_DATA')).toBe(true);
    }
    expect(r.rankedHospitals.every((h) => Number.isFinite(h.finalScore))).toBe(true);
  });

  test('ETA provider failure excludes the hospital with ETA_UNAVAILABLE (not silently scored)', async () => {
    const built = [buildHospital({ id: 'H-fail' }, BASE), buildHospital({ id: 'H-ok', lat: 28.6, lng: 77.19 }, BASE)];
    const throwingEta = {
      async calculateETA(_o: any, dest: any): Promise<ETAResult> {
        if (dest.latitude === built[1].profile.location.latitude) return { distanceKm: 2, etaSeconds: 200, timestamp: BASE, provider: 'ok' };
        throw new Error('routing down');
      },
    };
    const engine = new HospitalRankingEngine(
      new InMemoryHospitalProfileProvider(built.map((b) => b.profile)),
      new InMemoryHospitalLiveStatusProvider(built.map((b) => b.status)),
      throwingEta,
      new InMemoryClockProvider(BASE)
    );
    const r = await engine.rankHospitals({ emergency: traumaEmergency() });
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toEqual(['H-ok']);
    expect(r.excludedHospitals.find((e) => e.hospitalId === 'H-fail')?.reasons.some((x) => x.type === 'ETA_UNAVAILABLE')).toBe(true);
  });
});
