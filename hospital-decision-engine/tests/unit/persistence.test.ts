import {
  HospitalSelectionEngine,
  InMemoryClockProvider,
  InMemorySelectionStateStore,
  SelectionStateStore,
  VersionedSelection,
  CasResult,
  SelectionSnapshot,
  EmergencyId,
  SelectionError,
} from '../../src/index';
import { abcdRanked, emergencyId } from '../helpers';

describe('Persistence boundary', () => {
  test('state survives across engine instances sharing a store (restart / multi-instance)', async () => {
    const clock = new InMemoryClockProvider(new Date('2026-09-10T10:00:00Z'));
    const store = new InMemorySelectionStateStore();
    const emId = emergencyId('E-PERSIST');
    const { A, B, C } = abcdRanked();

    // Instance 1 initializes + assigns.
    const engine1 = new HospitalSelectionEngine(clock, store);
    const snap = await engine1.initializeSelection({ emergencyId: emId, rankedHospitals: [A, B, C], topN: 3 });
    const cand = (r: number) => snap.candidates.find((c) => c.rank === r)!;
    await engine1.processResponse({ emergencyId: emId, candidateId: cand(2).candidateId, hospitalId: B.hospitalId, response: 'ACCEPT' });

    // Instance 2 (simulating a different backend process) reads the SAME store.
    const engine2 = new HospitalSelectionEngine(clock, store);
    expect((await engine2.getCurrentAssignment(emId))?.hospitalId).toBe(B.hospitalId);

    // Instance 2 can continue the workflow correctly.
    await engine2.processResponse({ emergencyId: emId, candidateId: cand(1).candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect((await engine1.getCurrentAssignment(emId))?.hospitalId).toBe(A.hospitalId);
  });

  test('initialize twice for the same emergency is rejected (SELECTION_ALREADY_EXISTS)', async () => {
    const store = new InMemorySelectionStateStore();
    const engine = new HospitalSelectionEngine(new InMemoryClockProvider(new Date()), store);
    const emId = emergencyId('E-TWICE');
    const { A } = abcdRanked();
    await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 });
    await expect(engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 })).rejects.toMatchObject({
      code: 'SELECTION_ALREADY_EXISTS',
    });
  });

  test('compare-and-set retries and converges when a stale version conflicts once', async () => {
    // A store decorator that forces the FIRST compareAndSwap to see a stale version.
    const inner = new InMemorySelectionStateStore();
    let injectedConflict = false;
    const flaky: SelectionStateStore = {
      load: (id) => inner.load(id),
      create: (s) => inner.create(s),
      compareAndSwap: async (id: EmergencyId, expected: number, next: SelectionSnapshot): Promise<CasResult> => {
        if (!injectedConflict) {
          injectedConflict = true;
          // Return a conflict as if someone else advanced the version, but do NOT
          // actually change inner — the retry will reload the real (unchanged) state
          // and succeed. This proves the retry loop reloads and re-reduces.
          const current = (await inner.load(id))!;
          return { ok: false, conflict: true, current };
        }
        return inner.compareAndSwap(id, expected, next);
      },
    };
    const engine = new HospitalSelectionEngine(new InMemoryClockProvider(new Date('2026-09-10T10:00:00Z')), flaky);
    const emId = emergencyId('E-CAS');
    const { A } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 });
    const d = await engine.processResponse({ emergencyId: emId, candidateId: snap.candidates[0].candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' });
    expect(d.reason.type).toBe('INITIAL_ASSIGNMENT');
    expect(injectedConflict).toBe(true);
    expect((await engine.getCurrentAssignment(emId))?.hospitalId).toBe(A.hospitalId);
  });

  test('persistent conflict that never resolves exhausts retries with a retryable error', async () => {
    const inner = new InMemorySelectionStateStore();
    const alwaysConflict: SelectionStateStore = {
      load: (id) => inner.load(id),
      create: (s) => inner.create(s),
      compareAndSwap: async (id: EmergencyId): Promise<CasResult> => {
        const current = (await inner.load(id))!;
        return { ok: false, conflict: true, current };
      },
    };
    const engine = new HospitalSelectionEngine(new InMemoryClockProvider(new Date()), alwaysConflict);
    const emId = emergencyId('E-CONFLICT');
    const { A } = abcdRanked();
    const snap = await engine.initializeSelection({ emergencyId: emId, rankedHospitals: [A], topN: 1 });
    await expect(
      engine.processResponse({ emergencyId: emId, candidateId: snap.candidates[0].candidateId, hospitalId: A.hospitalId, response: 'ACCEPT' })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_CONFLICT_EXHAUSTED', retryable: true });
  });

  test('store load failure surfaces as PERSISTENCE_FAILURE (not silently swallowed)', async () => {
    const failing: SelectionStateStore = {
      load: async () => { throw new Error('db down'); },
      create: async (s) => ({ snapshot: s, version: 1 }),
      compareAndSwap: async () => ({ ok: true, version: 2 }),
    };
    const engine = new HospitalSelectionEngine(new InMemoryClockProvider(new Date()), failing);
    await expect(
      engine.processResponse({ emergencyId: emergencyId('E-F'), candidateId: 'x', hospitalId: abcdRanked().A.hospitalId, response: 'ACCEPT' })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_FAILURE' });
  });
});
