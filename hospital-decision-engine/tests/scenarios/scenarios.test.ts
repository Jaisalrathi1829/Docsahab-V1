import {
  HospitalRankingEngine,
  HospitalSelectionEngine,
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createDemoHospitalData,
  createEmergencyId,
  createHospitalId,
  CommonCapabilities,
  CommonResources,
  createEmergencyRequirement,
} from '../../src/index';

describe('Docsahab Core Decision Engine - Mandatory Reference & Scenarios', () => {
  test('Mandatory Reference Scenario: #3 -> #2 -> #1 -> #4 acceptance, temporary assignment, pickup lock, late responses rejected', async () => {
    const clock = new InMemoryClockProvider(new Date('2026-09-10T10:00:00Z'));
    const { profiles, statuses } = createDemoHospitalData(clock.now());

    for (const status of statuses) {
      status.traumaDepartmentStatus = 'AVAILABLE';
      status.emergencyDepartmentStatus = 'AVAILABLE';
      status.acceptingEmergencyPatients = true;
    }

    for (const profile of profiles) {
      const caps = new Set(profile.capabilities);
      caps.add(CommonCapabilities.CARDIAC_EMERGENCY);
      caps.add(CommonCapabilities.TRAUMA);
      (profile as any).capabilities = caps;
    }

    const profileProvider = new InMemoryHospitalProfileProvider(profiles);
    const liveStatusProvider = new InMemoryHospitalLiveStatusProvider(statuses);
    const etaProvider = new HaversineETAProvider(60);

    const rankingEngine = new HospitalRankingEngine(profileProvider, liveStatusProvider, etaProvider, clock);
    const selectionEngine = new HospitalSelectionEngine(clock);

    const emergencyId = createEmergencyId('EMG-REF-001');
    const emergency = createEmergencyRequirement({
      emergencyId,
      probableEmergencyType: 'TRAUMA_CARDIAC',
      requiredCapabilities: [
        { capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' },
        { capability: CommonCapabilities.CARDIAC_EMERGENCY, requirementLevel: 'MANDATORY' },
      ],
      requiredResources: [],
      severity: 'CRITICAL',
      patientLocation: { latitude: 28.6139, longitude: 77.2090 },
      ambulanceLocation: { latitude: 28.6000, longitude: 77.1900 },
    });

    const rankingResult = await rankingEngine.rankHospitals({ emergency });
    expect(rankingResult.rankedHospitals.length).toBeGreaterThanOrEqual(4);

    const selectionSnapshot = selectionEngine.initializeSelection({
      emergencyId,
      rankedHospitals: rankingResult.rankedHospitals,
      topN: 4,
    });

    const candidates = selectionSnapshot.candidates;
    const cand1 = candidates.find(c => c.rank === 1);
    const cand2 = candidates.find(c => c.rank === 2);
    const cand3 = candidates.find(c => c.rank === 3);
    const cand4 = candidates.find(c => c.rank === 4);

    expect(cand1).toBeDefined();
    expect(cand2).toBeDefined();
    expect(cand3).toBeDefined();
    expect(cand4).toBeDefined();

    const decision3 = selectionEngine.processResponse({
      emergencyId,
      candidateId: cand3!.candidateId,
      hospitalId: cand3!.hospitalId,
      response: 'ACCEPT',
    });
    expect(selectionEngine.getCurrentAssignment(emergencyId)?.hospitalId).toBe(cand3!.hospitalId);

    const decision2 = selectionEngine.processResponse({
      emergencyId,
      candidateId: cand2!.candidateId,
      hospitalId: cand2!.hospitalId,
      response: 'ACCEPT',
    });
    expect(decision2.replacementOccurred).toBe(true);
    expect(selectionEngine.getCurrentAssignment(emergencyId)?.hospitalId).toBe(cand2!.hospitalId);

    const decision1 = selectionEngine.processResponse({
      emergencyId,
      candidateId: cand1!.candidateId,
      hospitalId: cand1!.hospitalId,
      response: 'ACCEPT',
    });
    expect(decision1.replacementOccurred).toBe(true);
    expect(selectionEngine.getCurrentAssignment(emergencyId)?.hospitalId).toBe(cand1!.hospitalId);

    const decision4 = selectionEngine.processResponse({
      emergencyId,
      candidateId: cand4!.candidateId,
      hospitalId: cand4!.hospitalId,
      response: 'ACCEPT',
    });
    expect(selectionEngine.getCurrentAssignment(emergencyId)?.hospitalId).toBe(cand1!.hospitalId);

    const pickupDecision = selectionEngine.processPickup({
      emergencyId,
      pickedUpAt: clock.now(),
    });
    expect(pickupDecision.newAssignment?.state).toBe('LOCKED');
    expect(selectionEngine.isLocked(emergencyId)).toBe(true);

    const lateDecision2 = selectionEngine.processResponse({
      emergencyId,
      candidateId: cand2!.candidateId,
      hospitalId: cand2!.hospitalId,
      response: 'ACCEPT',
    });
    expect(selectionEngine.getCurrentAssignment(emergencyId)?.hospitalId).toBe(cand1!.hospitalId);
    expect(selectionEngine.isLocked(emergencyId)).toBe(true);
  });

  test('Live data freshness simulation across emergencies', async () => {
    const clock = new InMemoryClockProvider(new Date('2026-09-10T12:00:00Z'));
    const { profiles, statuses } = createDemoHospitalData(clock.now());
    const profileProvider = new InMemoryHospitalProfileProvider(profiles);
    const liveStatusProvider = new InMemoryHospitalLiveStatusProvider(statuses);
    const etaProvider = new HaversineETAProvider(60);

    const rankingEngine = new HospitalRankingEngine(profileProvider, liveStatusProvider, etaProvider, clock);

    const emergency = createEmergencyRequirement({
      emergencyId: createEmergencyId('EMG-LIVE-001'),
      probableEmergencyType: 'TRAUMA',
      requiredCapabilities: [
        { capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' },
      ],
      requiredResources: [],
      severity: 'HIGH',
      patientLocation: { latitude: 28.6139, longitude: 77.2090 },
      ambulanceLocation: { latitude: 28.6000, longitude: 77.1900 },
    });

    const result1 = await rankingEngine.rankHospitals({ emergency });
    expect(result1.rankedHospitals.length).toBeGreaterThan(0);
    const topHospital1 = result1.rankedHospitals[0].hospitalId;

    await liveStatusProvider.updateHospitalLiveStatus(topHospital1, {
      acceptingEmergencyPatients: false,
    });

    const emergency2 = createEmergencyRequirement({
      emergencyId: createEmergencyId('EMG-LIVE-002'),
      probableEmergencyType: 'TRAUMA',
      requiredCapabilities: [
        { capability: CommonCapabilities.TRAUMA, requirementLevel: 'MANDATORY' },
      ],
      requiredResources: [],
      severity: 'HIGH',
      patientLocation: { latitude: 28.6139, longitude: 77.2090 },
      ambulanceLocation: { latitude: 28.6000, longitude: 77.1900 },
    });

    const result2 = await rankingEngine.rankHospitals({ emergency: emergency2 });
    expect(result2.rankedHospitals[0].hospitalId).not.toBe(topHospital1);
  });
});
