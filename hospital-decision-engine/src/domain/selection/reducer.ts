// ============================================================================
// Selection Reducer — PURE decision core
// ============================================================================
// Every function here is a pure, synchronous, deterministic function of
// (snapshot, input, now). No I/O, no clock reads, no shared mutable state, no
// persistence. This is guarantee (A): given the same state and the same input
// event, the decision is always identical.
//
// The orchestrator (HospitalSelectionEngine) loads state from a store, calls a
// reducer, and persists via compare-and-set. That layering is what makes
// guarantees (C)/(D) — persistent and multi-instance safety — an INTEGRATION
// concern the store implements, not a property faked in memory.
// ============================================================================

import { EmergencyId, HospitalId } from '../models/types';
import { RankedHospital } from '../ranking/engine';
import {
  HospitalCandidate,
  SelectionSnapshot,
  SelectionDecision,
  CandidateState,
  createCandidate,
  canCandidateTransition,
  assertSelectionTransition,
} from './state';

export interface InitializeInput {
  emergencyId: EmergencyId;
  rankedHospitals: ReadonlyArray<RankedHospital>;
  topN: number;
  invitationTtlMs: number;
}

export interface ResponseInput {
  emergencyId: EmergencyId;
  candidateId: string;
  hospitalId: HospitalId;
  response: 'ACCEPT' | 'REJECT';
  respondedAt: Date;
}

/** Builds the initial INVITED snapshot from the top-N ranked hospitals. */
export function initializeSelection(input: InitializeInput, now: Date): SelectionSnapshot {
  const expiresAt = new Date(now.getTime() + input.invitationTtlMs);
  const candidates: HospitalCandidate[] = input.rankedHospitals
    .slice(0, input.topN)
    .map((h) => createCandidate(input.emergencyId, h.hospitalId, h.rank, h.finalScore, expiresAt, now));

  return {
    emergencyId: input.emergencyId,
    state: candidates.length > 0 ? 'INVITED' : 'EXHAUSTED',
    candidates,
    createdAt: now,
    updatedAt: now,
  };
}

function noop(snapshot: SelectionSnapshot, reason: SelectionDecision['reason']): SelectionDecision {
  return {
    previousAssignment: snapshot.currentAssignment,
    newAssignment: snapshot.currentAssignment,
    replacementOccurred: false,
    lockPreventedReassignment: false,
    stateChanged: false,
    reason,
  };
}

/** Pure response reducer. Returns the next snapshot and the decision. */
export function reduceResponse(
  snapshot: SelectionSnapshot,
  input: ResponseInput,
  now: Date
): { snapshot: SelectionSnapshot; decision: SelectionDecision } {
  // --- Locked: destination is final, nothing can change it. ---
  if (snapshot.state === 'LOCKED') {
    return {
      snapshot,
      decision: {
        ...noop(snapshot, { type: 'RESPONSE_REJECTED_LOCKED', candidateId: input.candidateId }),
        lockPreventedReassignment: true,
      },
    };
  }

  // --- Exhausted is terminal (no fallback). This also blocks a late acceptance
  //     after a pickup-without-assignment, which must never create a destination
  //     for an already-picked-up patient. ---
  if (snapshot.state === 'EXHAUSTED') {
    return {
      snapshot,
      decision: noop(snapshot, { type: 'RESPONSE_REJECTED_OBSOLETE', candidateId: input.candidateId }),
    };
  }

  const idx = snapshot.candidates.findIndex((c) => c.candidateId === input.candidateId);
  if (idx === -1) {
    return {
      snapshot,
      decision: noop(snapshot, { type: 'RESPONSE_REJECTED_UNKNOWN_CANDIDATE', candidateId: input.candidateId }),
    };
  }

  const candidate = snapshot.candidates[idx];

  // --- Expiry (Phase 9): a PENDING invitation past its TTL cannot be answered. ---
  if (candidate.state === 'PENDING' && now.getTime() > candidate.expiresAt.getTime()) {
    const candidates = replaceAt(snapshot.candidates, idx, { ...candidate, state: 'EXPIRED', respondedAt: now });
    return {
      snapshot: { ...snapshot, candidates, updatedAt: now },
      decision: {
        ...noop({ ...snapshot, candidates }, { type: 'RESPONSE_REJECTED_EXPIRED', candidateId: input.candidateId }),
        stateChanged: true,
      },
    };
  }

  // --- Non-PENDING candidate: classify the repeat/obsolete response. ---
  if (candidate.state !== 'PENDING') {
    if (candidate.state === 'ACCEPTED' && input.response === 'ACCEPT') {
      return { snapshot, decision: noop(snapshot, { type: 'RESPONSE_REJECTED_DUPLICATE', candidateId: input.candidateId }) };
    }
    if (candidate.state === 'REJECTED') {
      return { snapshot, decision: noop(snapshot, { type: 'RESPONSE_REJECTED_DUPLICATE', candidateId: input.candidateId }) };
    }
    // SUPERSEDED, EXPIRED, LOCKED, or ACCEPTED-now-rejecting → obsolete.
    return { snapshot, decision: noop(snapshot, { type: 'RESPONSE_REJECTED_OBSOLETE', candidateId: input.candidateId }) };
  }

  return input.response === 'ACCEPT'
    ? handleAcceptance(snapshot, idx, now)
    : handleRejection(snapshot, idx, now);
}

function handleAcceptance(
  snapshot: SelectionSnapshot,
  idx: number,
  now: Date
): { snapshot: SelectionSnapshot; decision: SelectionDecision } {
  const candidate = snapshot.candidates[idx];
  const previousAssignment = snapshot.currentAssignment;

  if (!canCandidateTransition(candidate.state, 'ACCEPTED')) {
    return {
      snapshot,
      decision: noop(snapshot, {
        type: 'RESPONSE_REJECTED_INVALID_TRANSITION',
        candidateId: candidate.candidateId,
        reason: `cannot ACCEPT from ${candidate.state}`,
      }),
    };
  }

  const acceptedCandidate: HospitalCandidate = {
    ...candidate,
    state: 'ACCEPTED',
    respondedAt: now,
    response: { type: 'ACCEPT', acceptedAt: now },
  };

  // Worse-or-equal rank than the current holder: record the acceptance but do
  // NOT replace. The accepting candidate is marked SUPERSEDED.
  if (previousAssignment && previousAssignment.rank <= candidate.rank) {
    const candidates = replaceAt(snapshot.candidates, idx, { ...acceptedCandidate, state: 'SUPERSEDED' });
    const next: SelectionSnapshot = { ...snapshot, candidates, updatedAt: now };
    return {
      snapshot: next,
      decision: {
        previousAssignment,
        newAssignment: previousAssignment,
        replacementOccurred: false,
        lockPreventedReassignment: false,
        stateChanged: true,
        reason: { type: 'NO_REPLACEMENT_LOWER_RANK', candidate, currentAssignment: previousAssignment },
      },
    };
  }

  // Strictly better rank (or no current assignment): assign / replace.
  let candidates = replaceAt(snapshot.candidates, idx, acceptedCandidate);
  if (previousAssignment) {
    const prevIdx = candidates.findIndex((c) => c.candidateId === previousAssignment.candidateId);
    if (prevIdx !== -1 && canCandidateTransition(candidates[prevIdx].state, 'SUPERSEDED')) {
      candidates = replaceAt(candidates, prevIdx, { ...candidates[prevIdx], state: 'SUPERSEDED' });
    }
  }

  const nextState = previousAssignment ? 'REASSIGNED' : 'TEMPORARILY_ASSIGNED';
  assertSelectionTransition(snapshot.state, nextState);

  const next: SelectionSnapshot = {
    ...snapshot,
    state: nextState,
    candidates,
    currentAssignment: acceptedCandidate,
    updatedAt: now,
  };

  return {
    snapshot: next,
    decision: {
      previousAssignment,
      newAssignment: acceptedCandidate,
      replacementOccurred: Boolean(previousAssignment),
      lockPreventedReassignment: false,
      stateChanged: true,
      reason: previousAssignment
        ? { type: 'REPLACEMENT', betterCandidate: acceptedCandidate, previousCandidate: previousAssignment }
        : { type: 'INITIAL_ASSIGNMENT', candidate: acceptedCandidate },
    },
  };
}

function handleRejection(
  snapshot: SelectionSnapshot,
  idx: number,
  now: Date
): { snapshot: SelectionSnapshot; decision: SelectionDecision } {
  const candidate = snapshot.candidates[idx];

  if (!canCandidateTransition(candidate.state, 'REJECTED')) {
    return {
      snapshot,
      decision: noop(snapshot, {
        type: 'RESPONSE_REJECTED_INVALID_TRANSITION',
        candidateId: candidate.candidateId,
        reason: `cannot REJECT from ${candidate.state}`,
      }),
    };
  }

  const rejected: HospitalCandidate = {
    ...candidate,
    state: 'REJECTED',
    respondedAt: now,
    response: { type: 'REJECT', rejectedAt: now },
  };
  const candidates = replaceAt(snapshot.candidates, idx, rejected);

  // If every candidate is now terminal and nothing is assigned, the round is
  // exhausted. (The engine has NO fallback — exhaustion is a terminal, explicit
  // outcome, not a trigger for a wider search.)
  const anyPending = candidates.some((c) => c.state === 'PENDING');
  const anyAccepted = candidates.some((c) => c.state === 'ACCEPTED');
  let nextState = snapshot.state;
  if (!snapshot.currentAssignment && !anyPending && !anyAccepted) {
    assertSelectionTransition(snapshot.state, 'EXHAUSTED');
    nextState = 'EXHAUSTED';
  }

  const next: SelectionSnapshot = { ...snapshot, state: nextState, candidates, updatedAt: now };
  return {
    snapshot: next,
    decision: {
      previousAssignment: snapshot.currentAssignment,
      newAssignment: snapshot.currentAssignment,
      replacementOccurred: false,
      lockPreventedReassignment: false,
      stateChanged: true,
      reason: { type: 'REJECTION_RECORDED', candidate: rejected, currentAssignment: snapshot.currentAssignment },
    },
  };
}

/** Pure pickup reducer. Irreversibly locks the current assignment. */
export function reducePickup(
  snapshot: SelectionSnapshot,
  pickedUpAt: Date
): { snapshot: SelectionSnapshot; decision: SelectionDecision } {
  if (snapshot.state === 'LOCKED') {
    return {
      snapshot,
      decision: {
        ...noop(snapshot, { type: 'NO_REPLACEMENT_LOCKED', lockedAssignment: snapshot.currentAssignment }),
        lockPreventedReassignment: true,
      },
    };
  }

  if (!snapshot.currentAssignment) {
    // Pickup with no hospital assigned: terminal, explicit, no assignment created.
    // Idempotent if already EXHAUSTED (repeat pickup produces no new write).
    if (snapshot.state === 'EXHAUSTED') {
      return { snapshot, decision: noop(snapshot, { type: 'PICKUP_WITHOUT_ASSIGNMENT' }) };
    }
    assertSelectionTransition(snapshot.state, 'EXHAUSTED');
    const next: SelectionSnapshot = { ...snapshot, state: 'EXHAUSTED', lockedAt: pickedUpAt, updatedAt: pickedUpAt };
    return {
      snapshot: next,
      decision: {
        previousAssignment: undefined,
        newAssignment: undefined,
        replacementOccurred: false,
        lockPreventedReassignment: false,
        stateChanged: true,
        reason: { type: 'PICKUP_WITHOUT_ASSIGNMENT' },
      },
    };
  }

  const assignment = snapshot.currentAssignment;
  const lockedAssignment: HospitalCandidate = { ...assignment, state: 'LOCKED' as CandidateState };
  const candidates = snapshot.candidates.map((c) =>
    c.candidateId === assignment.candidateId ? lockedAssignment : c
  );

  assertSelectionTransition(snapshot.state, 'LOCKED');
  const next: SelectionSnapshot = {
    ...snapshot,
    state: 'LOCKED',
    candidates,
    currentAssignment: lockedAssignment,
    lockedAt: pickedUpAt,
    updatedAt: pickedUpAt,
  };

  return {
    snapshot: next,
    decision: {
      previousAssignment: assignment,
      newAssignment: lockedAssignment,
      replacementOccurred: false,
      lockPreventedReassignment: false,
      stateChanged: true,
      reason: { type: 'LOCKED_AT_PICKUP', candidate: assignment },
    },
  };
}

function replaceAt(
  candidates: ReadonlyArray<HospitalCandidate>,
  index: number,
  next: HospitalCandidate
): HospitalCandidate[] {
  const copy = [...candidates];
  copy[index] = next;
  return copy;
}
