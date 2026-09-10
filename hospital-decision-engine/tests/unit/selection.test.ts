import {
  HospitalSelectionEngine,
  InMemoryClockProvider,
  InMemorySelectionStateStore,
  SelectionError,
} from '../../src/index';
import { abcdRanked, rankedHospital, emergencyId, hospitalId } from '../helpers';

function makeEngine(t = '2026-09-10T10:00:00Z') {
  const clock = new InMemoryClockProvider(new Date(t));
  const store = new InMemorySelectionStateStore();
  return { clock, store, engine: new HospitalSelectionEngine(clock, store) };
}

describe('Selection state machine', () => {
  test('rejection is recorded and does not change assignment', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-REJ');
    const { A, B, C } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B, C], topN: 3 });
    const cand = (r: number) => snap.candidates.find((c) => c.rank === r)!;
    await engine.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: B.hospitalId, response: 'ACCEPT' });
    const rej = await engine.processResponse({ emergencyId: emId, candidateId: cand(3).candidateId, hospitalId: C.hospitalId, response: 'REJECT' });
    expect(rej.reason.type).toBe('REJECTION_RECORDED');
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(B.hospitalId);
  });

  test('all rejected with none assigned → EXHAUSTED (no fallback)', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-EXH');
    const { A, B, C } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B, C], topN: 3 });
    for (const c of snap.candidates) {
      await engine.processResponse({ emergencyId: emId, candidateId: c.candidateId, hospitalId: c.hospitalId, response: 'REJECT' });
    }
    expect((await engine.getSelectionState(emId))?.state).toBe('EXHAUSTED');
    expect(await engine.getCurrentAssignment(emId)).toBeUndefined();
  });

  test('duplicate ACCEPT from same hospital is idempotent (no double-process, no write)', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-DUP');
    const { A } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 });
    const c1 = snap.candidates[0];
    await engine.processResponse({ emergencyId: emId, candidateId: c1.candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    const dup = await engine.processResponse({ emergencyId: emId, candidateId: c1.candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect(dup.reason.type).toBe('RESPONSE_REJECTED_DUPLICATE');
    expect(dup.stateChanged).toBe(false);
  });

  test('duplicate REJECT is idempotent', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-DUPREJ');
    const { A, B } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B], topN: 2 });
    const cand = (r: number) => snap.candidates.find((c) => c.rank === r)!;
    await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'REJECT' });
    const dup = await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'REJECT' });
    expect(dup.reason.type).toBe('RESPONSE_REJECTED_DUPLICATE');
    expect(dup.stateChanged).toBe(false);
  });

  test('unknown candidate id fails closed (structured, no mutation, no throw)', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-UNK');
    const { A } = abcdRanked();
    await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 });
    const d = await engine.processResponse({ emergencyId: emId, candidateId: 'not-a-real-candidate', hospitalId: hospitalId('H-Z'), response: 'ACCEPT' });
    expect(d.reason.type).toBe('RESPONSE_REJECTED_UNKNOWN_CANDIDATE');
    expect(d.stateChanged).toBe(false);
    expect(await engine.getCurrentAssignment(emId)).toBeUndefined();
  });

  test('rejected candidate cannot later accept and take over', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-REJACC');
    const { A, B } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B], topN: 2 });
    const cand = (r: number) => snap.candidates.find((c) => c.rank === r)!;
    await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'REJECT' });
    await engine.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: B.hospitalId, response: 'ACCEPT' });
    const late = await engine.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect(['RESPONSE_REJECTED_DUPLICATE', 'RESPONSE_REJECTED_OBSOLETE']).toContain(late.reason.type);
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(B.hospitalId);
  });

  test('candidate expiry: a PENDING invitation past its TTL cannot be answered', async () => {
    const { engine, clock } = makeEngine();
    const emId = emergencyId('E-EXP');
    const { A } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1, config: { invitationTtlMs: 60_000 } });
    const c1 = snap.candidates[0];
    clock.advance(61_000); // past the 60s TTL
    const d = await engine.processResponse({ emergencyId: emId, candidateId: c1.candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect(d.reason.type).toBe('RESPONSE_REJECTED_EXPIRED');
    expect(await engine.getCurrentAssignment(emId)).toBeUndefined();
  });

  test('pickup with no assignment is explicit and terminal (no silent success)', async () => {
    const { engine, clock } = makeEngine();
    const emId = emergencyId('E-PICKNONE');
    const { A } = abcdRanked();
    await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 });
    const d = await engine.processPickup({ emergencyId: emId, pickedUpAt: clock.now() });
    expect(d.reason.type).toBe('PICKUP_WITHOUT_ASSIGNMENT');
    expect((await engine.getSelectionState(emId))?.state).toBe('EXHAUSTED');
  });

  test('processResponse before initialize throws NO_SELECTION_STATE', async () => {
    const { engine } = makeEngine();
    await expect(
      engine.processResponse({ emergencyId: emergencyId('E-NONE'), candidateId: 'x', hospitalId: hospitalId('H'), response: 'ACCEPT' })
    ).rejects.toMatchObject({ code: 'NO_SELECTION_STATE' });
  });

  test('two emergencies are fully isolated in a shared engine/store', async () => {
    const { engine } = makeEngine();
    const emA = emergencyId('E-ISO-A');
    const emB = emergencyId('E-ISO-B');
    const a = abcdRanked();
    const b = abcdRanked();
    const snapA = await engine.initializeSelection({ emergencyId: emA, rankedHospitals: a.list, topN: 3 });
    await engine.initializeSelection({ emergencyId: emB, rankedHospitals: b.list, topN: 3 });
    const candA1 = snapA.candidates.find((c) => c.rank === 1)!;
    await engine.processResponse({ emergencyId: emA, candidateId: candA1.candidateId, hospitalId: a.A.hospitalId, response: 'ACCEPT' });
    expect(await engine.getCurrentAssignment(emB)).toBeUndefined();
    // A's candidateId against B → unknown candidate, no cross-contamination
    const cross = await engine.processResponse({ emergencyId: emB, candidateId: candA1.candidateId, hospitalId: a.A.hospitalId, response: 'ACCEPT' });
    expect(cross.reason.type).toBe('RESPONSE_REJECTED_UNKNOWN_CANDIDATE');
  });

  test('worse-ranked-first then better replaces; then even-worse cannot displace', async () => {
    const { engine } = makeEngine();
    const emId = emergencyId('E-ORDER');
    const list = [rankedHospital('H-1', 1, 0.9), rankedHospital('H-2', 2, 0.8), rankedHospital('H-3', 3, 0.7), rankedHospital('H-4', 4, 0.6)];
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: list, topN: 4 });
    const cand = (r: number) => snap.candidates.find((c) => c.rank === r)!;
    await engine.processResponse({ emergencyId: emId, candidateId: cand(3).candidateId, hospitalId: hospitalId('H-3'), response: 'ACCEPT' });
    await engine.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: hospitalId('H-2'), response: 'ACCEPT' });
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe('H-2');
    const d4 = await engine.processResponse({ emergencyId: emId, candidateId: cand(4).candidateId, hospitalId: hospitalId('H-4'), response: 'ACCEPT' });
    expect(d4.reason.type).toBe('NO_REPLACEMENT_LOWER_RANK');
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe('H-2');
  });
});
