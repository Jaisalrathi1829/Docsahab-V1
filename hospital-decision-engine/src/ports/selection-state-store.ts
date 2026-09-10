// ============================================================================
// SelectionStateStore — persistence PORT for hospital selection state
// ============================================================================
// The engine owns the DECISION; the store owns DURABILITY and ATOMICITY.
//
// This contract is deliberately built around optimistic concurrency rather than
// a naive load()/save(), because the correctness of multi-instance selection
// depends on atomic compare-and-set. Docsahab implements this against
// PostgreSQL so that two backend processes racing on the same emergency cannot
// both win — exactly the failure the audit proved with the in-memory Map.
//
// Mapping to a relational implementation (see the integration guide):
//   load()            → SELECT snapshot, version WHERE emergencyId = $1
//   create()          → INSERT ... (unique emergencyId) — fails if row exists
//   compareAndSwap()  → UPDATE ... SET snapshot=$1, version=version+1
//                       WHERE emergencyId=$2 AND version=$3   (rowcount decides)
//
// The engine core NEVER imports Prisma/Postgres. It depends only on this port.
// ============================================================================

import { EmergencyId } from '../domain/models/types';
import { SelectionSnapshot } from '../domain/selection/state';

export interface VersionedSelection {
  snapshot: SelectionSnapshot;
  /** Monotonic per emergency; incremented on every successful write. */
  version: number;
}

export interface CasSuccess {
  ok: true;
  version: number;
}

export interface CasConflict {
  ok: false;
  conflict: true;
  /** The current persisted value the caller lost the race to. */
  current: VersionedSelection;
}

export type CasResult = CasSuccess | CasConflict;

export interface SelectionStateStore {
  /** Returns the versioned snapshot, or null if none exists for this emergency. */
  load(emergencyId: EmergencyId): Promise<VersionedSelection | null>;

  /**
   * Persists the initial snapshot at version 1. MUST fail (reject) if a
   * selection already exists for the emergency — initialization is once-only.
   */
  create(snapshot: SelectionSnapshot): Promise<VersionedSelection>;

  /**
   * Atomically writes `next` only if the stored version still equals
   * `expectedVersion`. On success the version is incremented. On a version
   * mismatch it returns a conflict carrying the current value, so the caller
   * can re-reduce against fresh state and retry.
   */
  compareAndSwap(
    emergencyId: EmergencyId,
    expectedVersion: number,
    next: SelectionSnapshot
  ): Promise<CasResult>;
}
