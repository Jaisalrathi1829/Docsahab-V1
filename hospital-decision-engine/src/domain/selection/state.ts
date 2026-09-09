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
  reason: SelectionDecisionReason;
}

export type SelectionDecisionReason =
  | { type: 'INITIAL_ASSIGNMENT'; candidate: HospitalCandidate }
  | { type: 'REPLACEMENT'; betterCandidate: HospitalCandidate; previousCandidate: HospitalCandidate }
  | { type: 'NO_REPLACEMENT_LOWER_RANK'; candidate: HospitalCandidate; currentAssignment: HospitalCandidate }
  | { type: 'NO_REPLACEMENT_LOCKED'; candidate: HospitalCandidate; lockedAssignment: HospitalCandidate }
  | { type: 'NO_REPLACEMENT_EXHAUSTED'; candidate: HospitalCandidate }
  | { type: 'LOCKED_AT_PICKUP'; candidate: HospitalCandidate }
  | { type: 'RESPONSE_REJECTED_INVALID'; candidateId: string; reason: string }
  | { type: 'RESPONSE_REJECTED_DUPLICATE'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_OBSOLETE'; candidateId: string }
  | { type: 'RESPONSE_REJECTED_SUPERSEDED'; candidateId: string }
  | { type: 'NO_ELIGIBLE_CANDIDATES' };

export function createCandidate(
  emergencyId: EmergencyId,
  hospitalId: HospitalId,
  rank: number,
  finalScore: number,
  expiresAt: Date
): HospitalCandidate {
  return {
    candidateId: createCandidateId(`${emergencyId}-${hospitalId}-${rank}`),
    emergencyId,
    hospitalId,
    rank,
    finalScore,
    state: 'PENDING',
    expiresAt,
  };
}

export function isStateLocked(state: SelectionState): boolean {
  return state === 'LOCKED';
}

export function canTransition(from: SelectionState, to: SelectionState): boolean {
  const validTransitions: Record<SelectionState, SelectionState[]> = {
    SEARCHING: ['INVITED', 'EXHAUSTED'],
    INVITED: ['TEMPORARILY_ASSIGNED', 'EXHAUSTED'],
    TEMPORARILY_ASSIGNED: ['REASSIGNED', 'LOCKED', 'EXHAUSTED'],
    REASSIGNED: ['REASSIGNED', 'LOCKED', 'EXHAUSTED'],
    LOCKED: [],
    EXHAUSTED: [],
  };
  return validTransitions[from]?.includes(to) ?? false;
}

export function canCandidateTransition(from: CandidateState, to: CandidateState): boolean {
  const validTransitions: Record<CandidateState, CandidateState[]> = {
    PENDING: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'],
    ACCEPTED: ['SUPERSEDED', 'LOCKED'],
    REJECTED: [],
    SUPERSEDED: [],
    LOCKED: [],
    EXPIRED: [],
  };
  return validTransitions[from]?.includes(to) ?? false;
}