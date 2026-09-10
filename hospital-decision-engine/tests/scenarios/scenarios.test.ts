import {
  HospitalSelectionEngine,
  InMemoryClockProvider,
  InMemorySelectionStateStore,
} from '../../src/index';
import { abcdRanked, emergencyId } from '../helpers';

describe('Mandatory Reference Scenario', () => {
  test('#3 -> #2 -> #1 acceptance with replacement, #4 cannot displace #1, pickup locks #1, late responses rejected', async () => {
    const clock = new InMemoryClockProvider(new Date('2026-09-10T10:00:00Z'));
    const store = new InMemorySelectionStateStore();
    const engine = new HospitalSelectionEngine(clock, store);
    const emId = emergencyId('EMG-REF-001');
    const { A, B, C, D } = abcdRanked();

    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B, C, D], topN: 4 });
    const cand = (rank: number) => snap.candidates.find((c) => c.rank === rank)!;

    // C (#3) accepts first → temporary assignment
    const dC = await engine.processResponse({ emergencyId: emId, candidateId: cand(3).candidateId, hospitalId: C.hospitalId, response: 'ACCEPT' });
    expect(dC.reason.type).toBe('INITIAL_ASSIGNMENT');
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(C.hospitalId);

    // B (#2) accepts → replaces C
    const dB = await engine.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: B.hospitalId, response: 'ACCEPT' });
    expect(dB.replacementOccurred).toBe(true);
    expect(dB.reason.type).toBe('REPLACEMENT');
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(B.hospitalId);

    // A (#1) accepts → replaces B
    const dA = await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect(dA.replacementOccurred).toBe(true);
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(A.hospitalId);

    // D (#4) accepts → must NOT replace A
    const dD = await engine.processResponse({ emergencyId: emId, candidateId: cand(4).candidateId, hospitalId: D.hospitalId, response: 'ACCEPT' });
    expect(dD.replacementOccurred).toBe(false);
    expect(dD.reason.type).toBe('NO_REPLACEMENT_LOWER_RANK');
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(A.hospitalId);

    // Pickup → lock A
    const pickup = await engine.processPickup({ emergencyId: emId, pickedUpAt: clock.now() });
    expect(pickup.reason.type).toBe('LOCKED_AT_PICKUP');
    expect(pickup.newAssignment?.state).toBe('LOCKED');
    expect(await engine.isLocked(emId)).toBe(true);

    // Late acceptances after lock → rejected, assignment unchanged
    const late = await engine.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: B.hospitalId, response: 'ACCEPT' });
    expect(late.lockPreventedReassignment).toBe(true);
    expect(late.reason.type).toBe('RESPONSE_REJECTED_LOCKED');
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(A.hospitalId);
    expect(await engine.isLocked(emId)).toBe(true);
  });

  test('selection state reaches REASSIGNED after a replacement (no longer dead)', async () => {
    const clock = new InMemoryClockProvider(new Date('2026-09-10T10:00:00Z'));
    const engine = new HospitalSelectionEngine(clock, new InMemorySelectionStateStore());
    const emId = emergencyId('EMG-REASSIGN');
    const { A, B, C } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B, C], topN: 3 });
    const cand = (rank: number) => snap.candidates.find((c) => c.rank === rank)!;

    await engine.processResponse({ emergencyId: emId, candidateId: cand(3).candidateId, hospitalId: C.hospitalId, response: 'ACCEPT' });
    expect((await engine.getSelectionState(emId))?.state).toBe('TEMPORARILY_ASSIGNED');
    await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect((await engine.getSelectionState(emId))?.state).toBe('REASSIGNED');
  });
});
