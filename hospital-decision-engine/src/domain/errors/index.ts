export type DomainErrorType =
  | 'INVALID_EMERGENCY_REQUIREMENTS'
  | 'INVALID_HOSPITAL_DATA'
  | 'STALE_HOSPITAL_DATA'
  | 'EXPIRED_HOSPITAL_DATA'
  | 'NO_ELIGIBLE_HOSPITALS'
  | 'ETA_UNAVAILABLE'
  | 'ETA_PROVIDER_FAILURE'
  | 'INVALID_HOSPITAL_RESPONSE'
  | 'CANDIDATE_NOT_FOUND'
  | 'CANDIDATE_SUPERSEDED'
  | 'ASSIGNMENT_LOCKED'
  | 'DUPLICATE_RESPONSE'
  | 'INVALID_SELECTION_TRANSITION'
  | 'NO_SUITABLE_HOSPITAL'
  | 'CONFIGURATION_ERROR';

export class DomainError extends Error {
  readonly type: DomainErrorType;
  readonly details?: Record<string, unknown>;

  constructor(type: DomainErrorType, message: string, details?: Record<string, unknown>) {
    super(message);
    this.type = type;
    this.details = details;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
