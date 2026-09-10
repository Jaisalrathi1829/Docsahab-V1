import {
  HospitalRankingEngine,
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createEmergencyId,
  createEmergencyRequirement,
  CommonCapabilities,
  DEFAULT_RANKING_CONFIGURATION,
  classifyFreshness,
} from '../../src/index';
import { buildHospital } from '../helpers';

const NOW = new Date('2026-09-10T12:00:00Z');
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 15 * 60 * 1000;

function emergency() {
  return createEmergencyRequirement({
    emergencyId: createEmergencyId('EMG-FRESH'),
    probableEmergencyType: 'TRAUMA',
    requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
    requiredResources: [],
    severity: 'HIGH',
    patientLocation: { latitude: 28.61, longitude: 77.2 },
    ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
  });
}

function rankOne(lastUpdated: Date, override = {}) {
  const built = buildHospital({ id: 'H-1', lat: 28.6, lng: 77.19, lastUpdated }, NOW);
  const clock = new InMemoryClockProvider(NOW);
  const engine = new HospitalRankingEngine(
    new InMemoryHospitalProfileProvider([built.profile]),
    new InMemoryHospitalLiveStatusProvider([built.status]),
    new HaversineETAProvider(60),
    clock,
    { ...DEFAULT_RANKING_CONFIGURATION, ...override }
  );
  return engine.rankHospitals({ emergency: emergency() });
}

describe('classifyFreshness (pure boundaries + clock skew)', () => {
  test('exactly at fresh boundary is FRESH; one ms past is STALE', () => {
    expect(classifyFreshness(new Date(NOW.getTime() - FRESH_MS), NOW, FRESH_MS, STALE_MS, 0).level).toBe('FRESH');
    expect(classifyFreshness(new Date(NOW.getTime() - FRESH_MS - 1), NOW, FRESH_MS, STALE_MS, 0).level).toBe('STALE');
  });
  test('exactly at stale boundary is STALE; one ms past is EXPIRED', () => {
    expect(classifyFreshness(new Date(NOW.getTime() - STALE_MS), NOW, FRESH_MS, STALE_MS, 0).level).toBe('STALE');
    expect(classifyFreshness(new Date(NOW.getTime() - STALE_MS - 1), NOW, FRESH_MS, STALE_MS, 0).level).toBe('EXPIRED');
  });
  test('future timestamp within skew is FRESH; beyond skew is EXPIRED+futureDated', () => {
    const skew = 60_000;
    expect(classifyFreshness(new Date(NOW.getTime() + 30_000), NOW, FRESH_MS, STALE_MS, skew).level).toBe('FRESH');
    const far = classifyFreshness(new Date(NOW.getTime() + 3_600_000), NOW, FRESH_MS, STALE_MS, skew);
    expect(far.level).toBe('EXPIRED');
    expect(far.futureDated).toBe(true);
  });
});

describe('freshness policy in ranking', () => {
  test('FRESH data → eligible, full confidence', async () => {
    const r = await rankOne(NOW);
    expect(r.rankedHospitals[0].freshness).toBe('FRESH');
    expect(r.rankedHospitals[0].confidenceMultiplier).toBe(1);
  });

  test('EXPIRED data → hard excluded (DATA_EXPIRED)', async () => {
    const r = await rankOne(new Date(NOW.getTime() - STALE_MS - 1));
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'DATA_EXPIRED')).toBe(true);
  });

  test('future-dated beyond skew → excluded (DATA_TIMESTAMP_IN_FUTURE)', async () => {
    const r = await rankOne(new Date(NOW.getTime() + 3_600_000));
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'DATA_TIMESTAMP_IN_FUTURE')).toBe(true);
  });

  test('STALE + DEGRADE (default): eligible but resource confidence reduced', async () => {
    const r = await rankOne(new Date(NOW.getTime() - 10 * 60 * 1000)); // 10 min → STALE
    expect(r.rankedHospitals[0].freshness).toBe('STALE');
    expect(r.rankedHospitals[0].usedStaleData).toBe(true);
    expect(r.rankedHospitals[0].confidenceMultiplier).toBe(0.6);
  });

  test('STALE + DEGRADE scores strictly lower than FRESH for equal hospitals', async () => {
    const fresh = await rankOne(NOW);
    const stale = await rankOne(new Date(NOW.getTime() - 10 * 60 * 1000));
    expect(stale.rankedHospitals[0].finalScore).toBeLessThan(fresh.rankedHospitals[0].finalScore);
  });

  test('STALE + EXCLUDE policy hard-excludes stale hospitals', async () => {
    const r = await rankOne(new Date(NOW.getTime() - 10 * 60 * 1000), {
      freshnessPolicy: { ...DEFAULT_RANKING_CONFIGURATION.freshnessPolicy, staleBehavior: 'EXCLUDE' },
    });
    expect(r.rankedHospitals.length).toBe(0);
    expect(r.excludedHospitals[0].reasons.some((x) => x.type === 'DATA_STALE')).toBe(true);
  });

  test('STALE + ALLOW policy trusts stale data at full confidence', async () => {
    const r = await rankOne(new Date(NOW.getTime() - 10 * 60 * 1000), {
      freshnessPolicy: { ...DEFAULT_RANKING_CONFIGURATION.freshnessPolicy, staleBehavior: 'ALLOW' },
    });
    expect(r.rankedHospitals[0].freshness).toBe('STALE');
    expect(r.rankedHospitals[0].confidenceMultiplier).toBe(1);
    expect(r.rankedHospitals[0].usedStaleData).toBe(true);
  });
});
