// Contract compatibility (Phase 25): can CURRENT Docsahab data SHAPES map into
// the engine contracts, and which fields are genuinely MISSING / REQUIRE SCHEMA?
import {
  HospitalRankingEngine,
  InMemoryClockProvider,
  CommonCapabilities,
} from '../../src/index';
import {
  DocsahabHospitalRow,
  DocsahabProfileProvider,
  DocsahabSimulatedLiveProvider,
  DocsahabNavigationETAProvider,
  toHospitalProfile,
  deriveRequirement,
} from '../../examples/docsahab-reference-adapter';

const ROWS: DocsahabHospitalRow[] = [
  { id: 'hosp-001', name: 'AIIMS Delhi', latitude: 28.5672, longitude: 77.21, hasICU: true, hasTraumaCare: true, hasCardiology: true, availableBeds: 12 },
  { id: 'hosp-002', name: 'Safdarjung', latitude: 28.5683, longitude: 77.2067, hasICU: true, hasTraumaCare: true, hasCardiology: false, availableBeds: 8 },
];

describe('Docsahab contract compatibility', () => {
  test('Hospital row → HospitalProfile maps REAL fields 1:1', () => {
    const p = toHospitalProfile(ROWS[0]);
    expect(p.hospitalId.toString()).toBe('hosp-001');
    expect(p.location).toEqual({ latitude: 28.5672, longitude: 77.21 });
    expect(p.capabilities.has(CommonCapabilities.CARDIAC_EMERGENCY)).toBe(true);
    expect(p.capabilities.has(CommonCapabilities.TRAUMA)).toBe(true);
  });

  test('MISSING / REQUIRES SCHEMA: 6 engine capabilities are unrepresentable in the current Hospital table', () => {
    const p = toHospitalProfile(ROWS[0]); // AIIMS has all three booleans true
    const unrepresentable = [
      CommonCapabilities.NEUROLOGICAL_EMERGENCY,
      CommonCapabilities.PEDIATRIC_EMERGENCY,
      CommonCapabilities.OBSTETRIC_EMERGENCY,
      CommonCapabilities.BURN_UNIT,
      CommonCapabilities.TOXICOLOGY,
      CommonCapabilities.ISOLATION,
    ];
    for (const c of unrepresentable) {
      // The current 3-boolean model literally cannot express these — documented as REQUIRES SCHEMA CHANGE.
      expect(p.capabilities.has(c)).toBe(false);
    }
  });

  test('end-to-end rank over real Docsahab rows produces a coherent result', async () => {
    const now = new Date('2026-09-10T12:00:00Z');
    const engine = new HospitalRankingEngine(
      new DocsahabProfileProvider(ROWS),
      new DocsahabSimulatedLiveProvider(ROWS, now),
      new DocsahabNavigationETAProvider(40),
      new InMemoryClockProvider(now)
    );
    const req = deriveRequirement({
      emergencyId: 'emg-contract',
      probableEmergencyType: 'Cardiac Emergency',
      severity: 'HIGH',
      patientLocation: { latitude: 28.56, longitude: 77.21 },
      ambulanceLocation: { latitude: 28.55, longitude: 77.2 },
    });
    const r = await engine.rankHospitals({ emergency: req });
    // AIIMS (cardiology) eligible; Safdarjung (no cardiology) excluded for a cardiac case.
    expect(r.rankedHospitals.map((h) => h.hospitalId)).toContain('hosp-001');
    expect(r.excludedHospitals.find((e) => e.hospitalId === 'hosp-002')?.reasons.some((x) => x.type === 'MISSING_MANDATORY_CAPABILITY')).toBe(true);
  });
});
