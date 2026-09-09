export enum RankingErrorCode {
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INVALID_EMERGENCY_REQUIREMENTS = 'INVALID_EMERGENCY_REQUIREMENTS',
  INVALID_HOSPITAL_DATA = 'INVALID_HOSPITAL_DATA',
  STALE_HOSPITAL_DATA = 'STALE_HOSPITAL_DATA',
  EXPIRED_HOSPITAL_DATA = 'EXPIRED_HOSPITAL_DATA',
  NO_ELIGIBLE_HOSPITALS = 'NO_ELIGIBLE_HOSPITALS',
  ETA_UNAVAILABLE = 'ETA_UNAVAILABLE',
  ETA_PROVIDER_FAILURE = 'ETA_PROVIDER_FAILURE',
}

export class RankingError extends Error {
  constructor(
    public readonly code: RankingErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RankingError';
    Object.setPrototypeOf(this, RankingError.prototype);
  }
}

export enum SelectionErrorCode {
  INVALID_HOSPITAL_RESPONSE = 'INVALID_HOSPITAL_RESPONSE',
  CANDIDATE_NOT_FOUND = 'CANDIDATE_NOT_FOUND',
  CANDIDATE_SUPERSEDED = 'CANDIDATE_SUPERSEDED',
  ASSIGNMENT_LOCKED = 'ASSIGNMENT_LOCKED',
  DUPLICATE_RESPONSE = 'DUPLICATE_RESPONSE',
  INVALID_SELECTION_TRANSITION = 'INVALID_SELECTION_TRANSITION',
  NO_SUITABLE_HOSPITAL = 'NO_SUITABLE_HOSPITAL',
}

export class SelectionError extends Error {
  constructor(
    public readonly code: SelectionErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SelectionError';
    Object.setPrototypeOf(this, SelectionError.prototype);
  }
}