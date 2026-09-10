// ============================================================================
// Engine Error Model (single canonical source)
// ============================================================================
// Two error classes only. The integration guide's "Error Model" section defines
// which conditions THROW (unexpected / infrastructure / precondition violations)
// versus which are returned as structured SelectionDecision reasons (expected
// response-level conditions). This file holds only the throwable ones.
// ============================================================================

export enum RankingErrorCode {
  /** Configuration failed validation (weights, thresholds, TTLs). Not retryable. */
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  /** HospitalProfileProvider threw. Infrastructure — may be transient/retryable. */
  PROFILE_PROVIDER_FAILURE = 'PROFILE_PROVIDER_FAILURE',
  /** HospitalLiveStatusProvider threw. Infrastructure — may be transient/retryable. */
  LIVE_STATUS_PROVIDER_FAILURE = 'LIVE_STATUS_PROVIDER_FAILURE',
}

export class RankingError extends Error {
  constructor(
    public readonly code: RankingErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RankingError';
    Object.setPrototypeOf(this, RankingError.prototype);
  }
}

export enum SelectionErrorCode {
  /** No selection state exists for the emergency — it was never initialized. Not retryable. */
  NO_SELECTION_STATE = 'NO_SELECTION_STATE',
  /** Persistence store threw. Infrastructure — may be transient/retryable. */
  PERSISTENCE_FAILURE = 'PERSISTENCE_FAILURE',
  /** Optimistic concurrency retries exhausted. Retryable by the caller. */
  PERSISTENCE_CONFLICT_EXHAUSTED = 'PERSISTENCE_CONFLICT_EXHAUSTED',
  /** Attempted to initialize a selection that already exists. Not retryable. */
  SELECTION_ALREADY_EXISTS = 'SELECTION_ALREADY_EXISTS',
}

export class SelectionError extends Error {
  constructor(
    public readonly code: SelectionErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SelectionError';
    Object.setPrototypeOf(this, SelectionError.prototype);
  }
}
