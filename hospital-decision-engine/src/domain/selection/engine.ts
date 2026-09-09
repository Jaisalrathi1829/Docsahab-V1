import { EmergencyId, HospitalId, createCandidateId } from '../models/types';
import { RankedHospital } from '../ranking/engine';
import { HospitalCandidate, SelectionState, CandidateState, SelectionSnapshot, SelectionDecision, SelectionDecisionReason, createCandidate, canTransition, canCandidateTransition } from './state';
import { RankingConfiguration, DEFAULT_RANKING_CONFIGURATION } from '../ranking/configuration';
import { ClockProvider } from '../../ports/providers';
import { SelectionError, SelectionErrorCode } from '../../errors/ranking-errors';

export interface SelectionInput {
  emergencyId: EmergencyId;
  rankedHospitals: ReadonlyArray<RankedHospital>;
  topN?: number;
  config?: Partial<RankingConfiguration>;
}

export interface ResponseInput {
  emergencyId: EmergencyId;
  candidateId: string;
  hospitalId: HospitalId;
  response: 'ACCEPT' | 'REJECT';
  respondedAt?: Date;
}

export interface PickupInput {
  emergencyId: EmergencyId;
  pickedUpAt: Date;
}

export class HospitalSelectionEngine {
  private selectionState: Map<EmergencyId, SelectionSnapshot> = new Map();
  private clock: ClockProvider;
  private defaultConfig: RankingConfiguration;

  constructor(
    clock: ClockProvider,
    defaultConfig: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION
  ) {
    this.clock = clock;
    this.defaultConfig = defaultConfig;
  }

  initializeSelection(input: SelectionInput): SelectionSnapshot {
    const config = this.mergeConfiguration(input.config);
    const topN = input.topN ?? config.topN;
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const candidates: HospitalCandidate[] = input.rankedHospitals
      .slice(0, topN)
      .map((hospital, index) =>
        createCandidate(
          input.emergencyId,
          hospital.hospitalId,
          hospital.rank,
          hospital.finalScore,
          expiresAt
        )
      );

    const snapshot: SelectionSnapshot = {
      emergencyId: input.emergencyId,
      state: 'INVITED',
      candidates,
      createdAt: now,
      updatedAt: now,
    };

    this.selectionState.set(input.emergencyId, snapshot);
    return snapshot;
  }

  processResponse(input: ResponseInput): SelectionDecision {
    const snapshot = this.selectionState.get(input.emergencyId);
    if (!snapshot) {
      throw new SelectionError(SelectionErrorCode.INVALID_HOSPITAL_RESPONSE, 'No selection state for emergency');
    }

    if (snapshot.state === 'LOCKED') {
      const candidate = snapshot.candidates.find(c => c.candidateId === input.candidateId);
      return {
        previousAssignment: snapshot.currentAssignment,
        newAssignment: snapshot.currentAssignment,
        replacementOccurred: false,
        lockPreventedReassignment: true,
        reason: { type: 'RESPONSE_REJECTED_INVALID', candidateId: input.candidateId, reason: 'Assignment locked at pickup' },
      };
    }

    const candidateIndex = snapshot.candidates.findIndex(c => c.candidateId === input.candidateId);
    if (candidateIndex === -1) {
      throw new SelectionError(SelectionErrorCode.CANDIDATE_NOT_FOUND, 'Candidate not found');
    }

    const candidate = snapshot.candidates[candidateIndex];

    if (candidate.state !== 'PENDING') {
      if (candidate.state === 'ACCEPTED' && input.response === 'ACCEPT') {
        return {
          previousAssignment: snapshot.currentAssignment,
          newAssignment: snapshot.currentAssignment,
          replacementOccurred: false,
          lockPreventedReassignment: false,
          reason: { type: 'RESPONSE_REJECTED_DUPLICATE', candidateId: input.candidateId },
        };
      }
      if (candidate.state === 'SUPERSEDED' || candidate.state === 'EXPIRED') {
        return {
          previousAssignment: snapshot.currentAssignment,
          newAssignment: snapshot.currentAssignment,
          replacementOccurred: false,
          lockPreventedReassignment: false,
          reason: { type: 'RESPONSE_REJECTED_OBSOLETE', candidateId: input.candidateId },
        };
      }
      if (candidate.state === 'REJECTED') {
        return {
          previousAssignment: snapshot.currentAssignment,
          newAssignment: snapshot.currentAssignment,
          replacementOccurred: false,
          lockPreventedReassignment: false,
          reason: { type: 'RESPONSE_REJECTED_DUPLICATE', candidateId: input.candidateId },
        };
      }
    }

    const respondedAt = input.respondedAt ?? this.clock.now();

    if (input.response === 'ACCEPT') {
      return this.handleAcceptance(snapshot, candidate, candidateIndex, respondedAt);
    } else {
      return this.handleRejection(snapshot, candidate, candidateIndex, respondedAt);
    }
  }

  private handleAcceptance(
    snapshot: SelectionSnapshot,
    candidate: HospitalCandidate,
    candidateIndex: number,
    respondedAt: Date
  ): SelectionDecision {
    const previousAssignment = snapshot.currentAssignment;

    if (!canCandidateTransition(candidate.state, 'ACCEPTED')) {
      return {
        previousAssignment,
        newAssignment: previousAssignment,
        replacementOccurred: false,
        lockPreventedReassignment: false,
        reason: { type: 'RESPONSE_REJECTED_INVALID', candidateId: candidate.candidateId, reason: 'Invalid state transition' },
      };
    }

    const updatedCandidates = [...snapshot.candidates];
    updatedCandidates[candidateIndex] = {
      ...candidate,
      state: 'ACCEPTED',
      respondedAt,
      response: { type: 'ACCEPT', acceptedAt: respondedAt },
    };

    if (previousAssignment && previousAssignment.rank <= candidate.rank) {
      updatedCandidates[candidateIndex] = {
        ...updatedCandidates[candidateIndex],
        state: 'SUPERSEDED',
      };

      const newSnapshot: SelectionSnapshot = {
        ...snapshot,
        candidates: updatedCandidates,
        updatedAt: respondedAt,
      };

      this.selectionState.set(snapshot.emergencyId, newSnapshot);

      return {
        previousAssignment,
        newAssignment: previousAssignment,
        replacementOccurred: false,
        lockPreventedReassignment: false,
        reason: {
          type: 'NO_REPLACEMENT_LOWER_RANK',
          candidate,
          currentAssignment: previousAssignment,
        },
      };
    }

    if (previousAssignment) {
      const prevIndex = updatedCandidates.findIndex(c => c.candidateId === previousAssignment.candidateId);
      if (prevIndex !== -1 && canCandidateTransition(updatedCandidates[prevIndex].state, 'SUPERSEDED')) {
        updatedCandidates[prevIndex] = {
          ...updatedCandidates[prevIndex],
          state: 'SUPERSEDED',
        };
      }
    }

    const newSnapshot: SelectionSnapshot = {
      ...snapshot,
      state: 'TEMPORARILY_ASSIGNED',
      candidates: updatedCandidates,
      currentAssignment: updatedCandidates[candidateIndex],
      updatedAt: respondedAt,
    };

    this.selectionState.set(snapshot.emergencyId, newSnapshot);

    if (previousAssignment) {
      return {
        previousAssignment,
        newAssignment: updatedCandidates[candidateIndex],
        replacementOccurred: true,
        lockPreventedReassignment: false,
        reason: {
          type: 'REPLACEMENT',
          betterCandidate: updatedCandidates[candidateIndex],
          previousCandidate: previousAssignment,
        },
      };
    }

    return {
      previousAssignment: undefined,
      newAssignment: updatedCandidates[candidateIndex],
      replacementOccurred: false,
      lockPreventedReassignment: false,
      reason: {
        type: 'INITIAL_ASSIGNMENT',
        candidate: updatedCandidates[candidateIndex],
      },
    };
  }

  private handleRejection(
    snapshot: SelectionSnapshot,
    candidate: HospitalCandidate,
    candidateIndex: number,
    respondedAt: Date
  ): SelectionDecision {
    if (!canCandidateTransition(candidate.state, 'REJECTED')) {
      return {
        previousAssignment: snapshot.currentAssignment,
        newAssignment: snapshot.currentAssignment,
        replacementOccurred: false,
        lockPreventedReassignment: false,
        reason: { type: 'RESPONSE_REJECTED_INVALID', candidateId: candidate.candidateId, reason: 'Invalid state transition' },
      };
    }

    const updatedCandidates = [...snapshot.candidates];
    updatedCandidates[candidateIndex] = {
      ...candidate,
      state: 'REJECTED',
      respondedAt,
      response: { type: 'REJECT', rejectedAt: respondedAt },
    };

    const hasAcceptedCandidates = updatedCandidates.some(c => c.state === 'ACCEPTED');
    const newState: SelectionState = hasAcceptedCandidates 
      ? (snapshot.state === 'INVITED' ? 'INVITED' : snapshot.state)
      : 'EXHAUSTED';

    const newSnapshot: SelectionSnapshot = {
      ...snapshot,
      state: newState,
      candidates: updatedCandidates,
      updatedAt: respondedAt,
    };

    this.selectionState.set(snapshot.emergencyId, newSnapshot);

    return {
      previousAssignment: snapshot.currentAssignment,
      newAssignment: snapshot.currentAssignment,
      replacementOccurred: false,
      lockPreventedReassignment: false,
      reason: { type: 'NO_REPLACEMENT_LOWER_RANK', candidate, currentAssignment: snapshot.currentAssignment! },
    };
  }

  processPickup(input: PickupInput): SelectionDecision {
    const snapshot = this.selectionState.get(input.emergencyId);
    if (!snapshot) {
      throw new SelectionError(SelectionErrorCode.INVALID_HOSPITAL_RESPONSE, 'No selection state for emergency');
    }

    if (snapshot.state === 'LOCKED') {
      return {
        previousAssignment: snapshot.currentAssignment,
        newAssignment: snapshot.currentAssignment,
        replacementOccurred: false,
        lockPreventedReassignment: true,
        reason: { type: 'RESPONSE_REJECTED_INVALID', candidateId: '', reason: 'Already locked' },
      };
    }

    if (!snapshot.currentAssignment) {
      const newSnapshot: SelectionSnapshot = {
        ...snapshot,
        state: 'EXHAUSTED',
        lockedAt: input.pickedUpAt,
        updatedAt: input.pickedUpAt,
      };
      this.selectionState.set(input.emergencyId, newSnapshot);

      return {
        previousAssignment: undefined,
        newAssignment: undefined,
        replacementOccurred: false,
        lockPreventedReassignment: false,
        reason: { type: 'NO_ELIGIBLE_CANDIDATES' },
      };
    }

    const assignment = snapshot.currentAssignment;
    const updatedCandidates = snapshot.candidates.map(c =>
      c.candidateId === assignment.candidateId
        ? { ...c, state: 'LOCKED' as CandidateState }
        : c
    );

    const newSnapshot: SelectionSnapshot = {
      ...snapshot,
      state: 'LOCKED',
      candidates: updatedCandidates,
      currentAssignment: { ...assignment, state: 'LOCKED' as CandidateState },
      lockedAt: input.pickedUpAt,
      updatedAt: input.pickedUpAt,
    };

    this.selectionState.set(input.emergencyId, newSnapshot);

    return {
      previousAssignment: assignment,
      newAssignment: { ...assignment, state: 'LOCKED' as CandidateState },
      replacementOccurred: false,
      lockPreventedReassignment: false,
      reason: { type: 'LOCKED_AT_PICKUP', candidate: assignment },
    };
  }

  getSelectionState(emergencyId: EmergencyId): SelectionSnapshot | undefined {
    return this.selectionState.get(emergencyId);
  }

  getCurrentAssignment(emergencyId: EmergencyId): HospitalCandidate | undefined {
    return this.selectionState.get(emergencyId)?.currentAssignment;
  }

  isLocked(emergencyId: EmergencyId): boolean {
    return this.selectionState.get(emergencyId)?.state === 'LOCKED';
  }

  private mergeConfiguration(override?: Partial<RankingConfiguration>): RankingConfiguration {
    if (!override) return this.defaultConfig;
    return {
      ...this.defaultConfig,
      ...override,
      freshnessThresholds: {
        ...this.defaultConfig.freshnessThresholds,
        ...override.freshnessThresholds,
      },
      tieBreakPolicy: {
        ...this.defaultConfig.tieBreakPolicy,
        ...override.tieBreakPolicy,
      },
      capabilityPolicy: {
        ...this.defaultConfig.capabilityPolicy,
        ...override.capabilityPolicy,
      },
      resourcePolicy: {
        ...this.defaultConfig.resourcePolicy,
        ...override.resourcePolicy,
      },
    };
  }
}