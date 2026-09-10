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
} from '../../src/index';
import { buildHospital } from '../helpers';

const BASE = new Date('2026-09-10T12:00:00Z');

function emergency() {
  return createEmergencyRequirement({
    emergencyId: createEmergencyId('EMG-ERR'),
    probableEmergencyType: 'TRAUMA',
    requiredCapabilities: [{ capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' }],
    requiredResources: [],
    severity: 'HIGH',
    patientLocation: { latitude: 28.61, longitude: 77.2 },
    ambulanceLocation: { latitude: 28.6, longitude: 77.19 },
  });
}

describe('Ranking error model', () => {
  test('profile provider failure → RankingError PROFILE_PROVIDER_FAILURE (retryable), not swallowed', async () => {
    const failing = {
      getHospitalProfile: async () => null,
      getAllHospitalProfiles: async () => { throw new Error('profiles db down'); },
    };
    const engine = new HospitalRankingEngine(
      failing as any,
      new InMemoryHospitalLiveStatusProvider([]),
      new HaversineETAProvider(60),
      new InMemoryClockProvider(BASE)
    );
    await expect(engine.rankHospitals({ emergency: emergency() })).rejects.toMatchObject({
      code: 'PROFILE_PROVIDER_FAILURE',
      retryable: true,
    });
  });

  test('live-status provider failure → RankingError LIVE_STATUS_PROVIDER_FAILURE (retryable)', async () => {
    const built = buildHospital({ id: 'H-1' }, BASE);
    const failing = {
      getHospitalLiveStatus: async () => null,
      getAllHospitalLiveStatuses: async () => { throw new Error('status db down'); },
      updateHospitalLiveStatus: async () => {},
    };
    const engine = new HospitalRankingEngine(
      new InMemoryHospitalProfileProvider([built.profile]),
      failing as any,
      new HaversineETAProvider(60),
      new InMemoryClockProvider(BASE)
    );
    await expect(engine.rankHospitals({ emergency: emergency() })).rejects.toMatchObject({
      code: 'LIVE_STATUS_PROVIDER_FAILURE',
    });
  });

  test('invalid configuration (weights not summing to 1) → INVALID_CONFIGURATION (not retryable)', async () => {
    const built = buildHospital({ id: 'H-1' }, BASE);
    const engine = new HospitalRankingEngine(
      new InMemoryHospitalProfileProvider([built.profile]),
      new InMemoryHospitalLiveStatusProvider([built.status]),
      new HaversineETAProvider(60),
      new InMemoryClockProvider(BASE)
    );
    await expect(
      engine.rankHospitals({ emergency: emergency(), config: { capabilityWeight: 0.9, etaWeight: 0.9, resourceWeight: 0.9 } })
    ).rejects.toMatchObject({ code: 'INVALID_CONFIGURATION', retryable: false });
  });
});
