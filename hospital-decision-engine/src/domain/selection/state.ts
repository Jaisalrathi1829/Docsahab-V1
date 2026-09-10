import { EmergencyId, HospitalId, createCandidateId } from '../models/types';

export type SelectionState =
  | 'SEARCHING'
  | 'INVITED'
  | 'TEMPORARILY_ASSIGNED'
  | 'REASSIGNED'
  | 'LOCKED'
  | 'EXHAUSTED';

export type CandidateState =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'LOCKED'
  | 'EXPIRED';

export interface HospitalCandidate {
  candidateId: string;
  emergencyId: EmergencyId;
  hospitalId: HospitalId;
  rank: number;
  finalScore: number;
  state: CandidateState;
  invitedAt?: Date;
  respondedAt?: Date;
  response?: CandidateResponse;
  expiresAt: Date;
}

export type CandidateResponse =
  | { type: 'ACCEPT'; acceptedAt: Date }
  | { type: 'REJECT'; rejectedAt: Date; reason?: string }
  | { type: 'TIMEOUT' };

export interface SelectionSnapshot {
  emergencyId: EmergencyId;
  state: SelectionState;
  candidates: ReadonlyArray<HospitalCandidate>;
  currentAssignment?: HospitalCandidate;
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SelectionDecision {
  previousAssignment?: HospitalCandidate;
  newAssignment?: HospitalCandidate;
  replacementOccurred: boolean;
  lockPreventedReassignment: boolean;
  /**
   * True iff this decision mutated selection state. The orchestrator only
   * persists (compare-and-set) when this is true, so duplicate/obsolete/no-op
   * responses are naturally idempotent and never trigger a write.
   */
  stateChanged: boolean;
  reason: SelectionDecisionReason;
}

export type SelectionDecisionReason =
  | { type: 'INITIAL_ASSIGNMENT'; candidate: HospitalCandidate }
  | { type: 'REPLACEMENT'; betterCandidate: HospitalCandidate; previousCandidate: HospitalCandidate }
  | { type: 'NO_REPLACEMENT_LOWER_RANK'; candidate: HospitalCandidate; currentAssignment: HospitalCandidate }
  | { type: 'NO_REPLACEMENT_LOCKED'; candidate?: HospitalCandidate; lockedAssignment?: HospitalCandidate }
  | { type: 'NO_REPLACEMENT_EXHAUSTED'; candidate: HospitalCandidate }
  | { type: 'REJECTION_RECORDED'; candidate: HospitalCandidate; currentAssignment?: HospitalCandidate }
  | { type: 'LOCKED_AT_PICKUP'; candidate: HospitalCandidate }
  | { type: 'PICKUP_WITHOUT_ASSIGNMENT' }
  | { type: 'RESPONSE_REJECTED_UNKNOWN_CANDIDATE'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_LOCKED'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_EXPIRED'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_DUPLICATE'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_OBSOLETE'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_INVALID_TRANSITION'; candidateId: string; reason: string }
  | { type: 'NO_ELIGIBLE_CANDIDATES' };

export function createCandidate(
  emergencyId: EmergencyId,
  hospitalId: HospitalId,
  rank: number,
  finalScore: number,
  expiresAt: Date,
  invitedAt: Date
): HospitalCandidate {
  return {
    candidateId: createCandidateId(`${emergencyId}-${hospitalId}-${rank}`),
    emergencyId,
    hospitalId,
    rank,
    finalScore,
    state: 'PENDING',
    invitedAt,
    expiresAt,
  };
}

export function isStateLocked(state: SelectionState): boolean {
  return state === 'LOCKED';
}

const SELECTION_TRANSITIONS: Record<SelectionState, SelectionState[]> = {
  SEARCHING: ['INVITED', 'EXHAUSTED'],
  INVITED: ['TEMPORARILY_ASSIGNED', 'INVITED', 'EXHAUSTED'],
  TEMPORARILY_ASSIGNED: ['TEMPORARILY_ASSIGNED', 'REASSIGNED', 'LOCKED', 'EXHAUSTED'],
  REASSIGNED: ['REASSIGNED', 'TEMPORARILY_ASSIGNED', 'LOCKED', 'EXHAUSTED'],
  LOCKED: [],
  EXHAUSTED: ['LOCKED'],
};

export function canTransition(from: SelectionState, to: SelectionState): boolean {
  if (from === to) return true;
  return SELECTION_TRANSITIONS[from]?.includes(to) ?? false;
}

const CANDIDATE_TRANSITIONS: Record<CandidateState, CandidateState[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'],
  ACCEPTED: ['SUPERSEDED', 'LOCKED'],
  REJECTED: [],
  SUPERSEDED: [],
  LOCKED: [],
  EXPIRED: [],
};

export function canCandidateTransition(from: CandidateState, to: CandidateState): boolean {
  if (from === to) return true;
  return CANDIDATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throwing guard for illegal SELECTION-state transitions (defense in depth). */
export function assertSelectionTransition(from: SelectionState, to: SelectionState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal selection transition ${from} -> ${to}`);
  }
}
