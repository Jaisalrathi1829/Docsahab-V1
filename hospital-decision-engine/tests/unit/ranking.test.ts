import {
  HospitalRankingEngine,
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createDemoHospitalData,
  createEmergencyId,
  CommonCapabilities,
  CommonResources,
  createEmergencyRequirement,
} from '../../src/index';

describe('Unit Tests: Ranking Engine', () => {
  test('Determinism of ranking output', async () => {
    const { profiles, statuses } = createDemoHospitalData();
    const profileProvider = new InMemoryHospitalProfileProvider(profiles);
    const liveStatusProvider = new InMemoryHospitalLiveStatusProvider(statuses);
    const etaProvider = new HaversineETAProvider(60);
    const clock = new InMemoryClockProvider(new Date('2026-09-10T12:00:00Z'));

    const engine1 = new HospitalRankingEngine(profileProvider, liveStatusProvider, etaProvider, clock);
    const engine2 = new HospitalRankingEngine(profileProvider, liveStatusProvider, etaProvider, clock);

    const emergency = createEmergencyRequirement({
      emergencyId: createEmergencyId('EMG-DET-001'),
      probableEmergencyType: 'CARDIAC',
      requiredCapabilities: [
        { capability: CommonCapabilities.CARDIAC_EMERGENCY, requirementLevel: 'MANDATORY' },
      ],
      requiredResources: [
        { resourceType: CommonResources.ICU_BEDS, minimumQuantity: 1, requirementLevel: 'MANDATORY' },
      ],
      severity: 'CRITICAL',
      patientLocation: { latitude: 28.6139, longitude: 77.2090 },
      ambulanceLocation: { latitude: 28.6000, longitude: 77.1900 },
    });

    const res1 = await engine1.rankHospitals({ emergency });
    const res2 = await engine2.rankHospitals({ emergency });

    expect(res1.rankedHospitals).toEqual(res2.rankedHospitals);
  });
});
