// ============================================================================
// InMemorySelectionStateStore — TEST/DEV ONLY
// ============================================================================
// A process-local reference implementation of SelectionStateStore. It correctly
// implements the create/load/compareAndSwap contract (including version checks),
// which makes it a faithful stand-in for unit/integration tests and local demos.
//
// IT IS NOT PRODUCTION-SAFE: state lives in a single process's heap and does not
// survive restarts or coordinate across instances. Production MUST inject a
// PostgreSQL-backed store (see the integration guide's transactional design).
// ============================================================================

import { EmergencyId } from '../domain/models/types';
import { SelectionSnapshot } from '../domain/selection/state';
import { SelectionStateStore, VersionedSelection, CasResult } from '../ports/selection-state-store';
import { SelectionError, SelectionErrorCode } from '../errors/ranking-errors';

export class InMemorySelectionStateStore implements SelectionStateStore {
  private readonly rows = new Map<EmergencyId, VersionedSelection>();

  async load(emergencyId: EmergencyId): Promise<VersionedSelection | null> {
    const row = this.rows.get(emergencyId);
    return row ? { snapshot: row.snapshot, version: row.version } : null;
  }

  async create(snapshot: SelectionSnapshot): Promise<VersionedSelection> {
    if (this.rows.has(snapshot.emergencyId)) {
      throw new SelectionError(
        SelectionErrorCode.SELECTION_ALREADY_EXISTS,
        `Selection already exists for emergency ${snapshot.emergencyId}`,
        false
      );
    }
    const versioned: VersionedSelection = { snapshot, version: 1 };
    this.rows.set(snapshot.emergencyId, versioned);
    return { snapshot, version: 1 };
  }

  async compareAndSwap(
    emergencyId: EmergencyId,
    expectedVersion: number,
    next: SelectionSnapshot
  ): Promise<CasResult> {
    const row = this.rows.get(emergencyId);
    if (!row) {
      throw new SelectionError(
        SelectionErrorCode.NO_SELECTION_STATE,
        `Cannot compareAndSwap missing selection ${emergencyId}`,
        false
      );
    }
    if (row.version !== expectedVersion) {
      return { ok: false, conflict: true, current: { snapshot: row.snapshot, version: row.version } };
    }
    const newVersion = row.version + 1;
    this.rows.set(emergencyId, { snapshot: next, version: newVersion });
    return { ok: true, version: newVersion };
  }

  /** Test helper: wipes all state (e.g. simulating a process restart is done by discarding this instance). */
  clear(): void {
    this.rows.clear();
  }
}
