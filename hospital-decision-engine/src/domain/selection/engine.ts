// ============================================================================
// HospitalSelectionEngine — orchestrator
// ============================================================================
// Thin async orchestrator: load versioned state from a SelectionStateStore,
// run a PURE reducer, then persist via compare-and-set with bounded retry.
//
// Concurrency responsibility split (Phase 3):
//   A. decision determinism      → the reducer (pure)
//   B. in-process safety         → single reduce+CAS cycle
//   C. persistent atomicity      → the store's compareAndSwap (Docsahab/Postgres)
//   D. multi-instance safety     → same CAS, across processes
//   E. replay / idempotency      → decision.stateChanged gates writes; duplicate
//                                   and obsolete responses never mutate or write
//
// The engine core imports NO infrastructure. The default store is in-memory and
// labelled TEST/DEV ONLY; production injects a Postgres-backed store.
// ============================================================================

import { EmergencyId } from '../models/types';
import { RankedHospital } from '../ranking/engine';
import { SelectionSnapshot, SelectionDecision, HospitalCandidate } from './state';
import { RankingConfiguration, DEFAULT_RANKING_CONFIGURATION, mergeConfiguration } from '../ranking/configuration';
import { ClockProvider } from '../../ports/providers';
import { SelectionStateStore, VersionedSelection } from '../../ports/selection-state-store';
import { InMemorySelectionStateStore } from '../../infrastructure/in-memory-selection-store';
import { SelectionError, SelectionErrorCode } from '../../errors/ranking-errors';
import { initializeSelection, reduceResponse, reducePickup } from './reducer';

export interface SelectionInput {
  emergencyId: EmergencyId;
  rankedHospitals: ReadonlyArray<RankedHospital>;
  topN?: number;
  config?: Partial<RankingConfiguration>;
}

export interface ResponseInput {
  emergencyId: EmergencyId;
  candidateId: string;
  hospitalId: import('../models/types').HospitalId;
  response: 'ACCEPT' | 'REJECT';
  respondedAt?: Date;
}

export interface PickupInput {
  emergencyId: EmergencyId;
  pickedUpAt: Date;
}

const MAX_CAS_ATTEMPTS = 5;

export class HospitalSelectionEngine {
  private readonly store: SelectionStateStore;
  private readonly clock: ClockProvider;
  private readonly defaultConfig: RankingConfiguration;

  constructor(
    clock: ClockProvider,
    store?: SelectionStateStore,
    defaultConfig: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION
  ) {
    this.clock = clock;
    // TEST/DEV ONLY default. Production MUST inject a durable, transactional store.
    this.store = store ?? new InMemorySelectionStateStore();
    this.defaultConfig = defaultConfig;
  }

  async initializeSelection(input: SelectionInput): Promise<SelectionSnapshot> {
    const config = mergeConfiguration(this.defaultConfig, input.config);
    const now = this.clock.now();
    const snapshot = initializeSelection(
      {
        emergencyId: input.emergencyId,
        rankedHospitals: input.rankedHospitals,
        topN: input.topN ?? config.topN,
        invitationTtlMs: config.invitationTtlMs,
      },
      now
    );
    try {
      const versioned = await this.store.create(snapshot);
      return versioned.snapshot;
    } catch (e) {
      if (e instanceof SelectionError) throw e;
      throw new SelectionError(
        SelectionErrorCode.PERSISTENCE_FAILURE,
        `Failed to initialize selection: ${(e as Error).message}`,
        true
      );
    }
  }

  async processResponse(input: ResponseInput): Promise<SelectionDecision> {
    const respondedAt = input.respondedAt ?? this.clock.now();
    return this.mutate(input.emergencyId, (snapshot) =>
      reduceResponse(
        snapshot,
        {
          emergencyId: input.emergencyId,
          candidateId: input.candidateId,
          hospitalId: input.hospitalId,
          response: input.response,
          respondedAt,
        },
        this.clock.now()
      )
    );
  }

  async processPickup(input: PickupInput): Promise<SelectionDecision> {
    return this.mutate(input.emergencyId, (snapshot) => reducePickup(snapshot, input.pickedUpAt));
  }

  async getSelectionState(emergencyId: EmergencyId): Promise<SelectionSnapshot | undefined> {
    const loaded = await this.store.load(emergencyId);
    return loaded?.snapshot;
  }

  async getCurrentAssignment(emergencyId: EmergencyId): Promise<HospitalCandidate | undefined> {
    const loaded = await this.store.load(emergencyId);
    return loaded?.snapshot.currentAssignment;
  }

  async isLocked(emergencyId: EmergencyId): Promise<boolean> {
    const loaded = await this.store.load(emergencyId);
    return loaded?.snapshot.state === 'LOCKED';
  }

  /**
   * load → reduce → compare-and-set with bounded retry. A no-op decision
   * (stateChanged === false) short-circuits without a write, so duplicate and
   * obsolete responses are naturally idempotent even under retries.
   */
  private async mutate(
    emergencyId: EmergencyId,
    reducer: (snapshot: SelectionSnapshot) => { snapshot: SelectionSnapshot; decision: SelectionDecision }
  ): Promise<SelectionDecision> {
    for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
      let loaded: VersionedSelection | null;
      try {
        loaded = await this.store.load(emergencyId);
      } catch (e) {
        throw new SelectionError(
          SelectionErrorCode.PERSISTENCE_FAILURE,
          `Store.load failed: ${(e as Error).message}`,
          true
        );
      }

      if (!loaded) {
        throw new SelectionError(
          SelectionErrorCode.NO_SELECTION_STATE,
          `No selection state for emergency ${emergencyId} — initialize first`,
          false
        );
      }

      const { snapshot: next, decision } = reducer(loaded.snapshot);

      if (!decision.stateChanged) {
        return decision; // pure no-op — never writes, always safe to replay
      }

      let cas;
      try {
        cas = await this.store.compareAndSwap(emergencyId, loaded.version, next);
      } catch (e) {
        throw new SelectionError(
          SelectionErrorCode.PERSISTENCE_FAILURE,
          `Store.compareAndSwap failed: ${(e as Error).message}`,
          true
        );
      }

      if (cas.ok) return decision;
      // Lost the race — another writer advanced the version. Re-load and re-reduce.
    }

    throw new SelectionError(
      SelectionErrorCode.PERSISTENCE_CONFLICT_EXHAUSTED,
      `Selection compare-and-set exhausted ${MAX_CAS_ATTEMPTS} attempts for ${emergencyId}`,
      true
    );
  }
}
