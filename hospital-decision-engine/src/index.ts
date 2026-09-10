// ============================================================================
// Public API — the single canonical surface consumers import.
// ============================================================================
// There is exactly ONE configuration system, ONE error model, and ONE of each
// provider interface. No dead/duplicate modules are exported.
// ============================================================================

export {
  HospitalId,
  EmergencyId,
  CandidateId,
  Capability,
  ResourceType,
  Coordinates,
  createHospitalId,
  createEmergencyId,
  createCandidateId,
  createCapability,
  createResourceType,
  CommonCapabilities,
  CommonResources,
} from './domain/models/types';

export {
  HospitalProfile,
  ContactInfo,
  HospitalProfileSnapshot,
  createHospitalProfile,
} from './domain/models/hospital-profile';

export {
  HospitalLiveStatus,
  OperationalStatus,
  DepartmentStatus,
  LoadLevel,
  CapacityIndicators,
  HospitalLiveStatusSnapshot,
  FreshnessLevel,
  FreshnessAssessment,
  classifyFreshness,
  createHospitalLiveStatus,
} from './domain/models/hospital-live-status';

export {
  HospitalSnapshot,
  DerivedValues,
  CapabilityMatchResult,
  ResourceAvailabilityResult,
  ResourceAvailability,
  EligibilityResult,
  EligibilityReason,
} from './domain/models/hospital-snapshot';

export {
  EmergencyRequirement,
  RequiredCapability,
  RequirementLevel,
  RequiredResource,
  EmergencySeverity,
  EmergencyConstraints,
  GeographicBounds,
  createEmergencyRequirement,
} from './domain/models/emergency-requirement';

export {
  RankingConfiguration,
  FreshnessPolicy,
  TieBreakPolicy,
  CapabilityPolicy,
  ResourcePolicy,
  DEFAULT_RANKING_CONFIGURATION,
  validateConfiguration,
  mergeConfiguration,
  ValidationResult,
} from './domain/ranking/configuration';

export {
  RankingInput,
  RankingResult,
  RankedHospital,
  ExcludedHospital,
  HospitalRankingEngine,
} from './domain/ranking/engine';

export {
  SnapshotInputs,
  ETAResult as SnapshotETAResult,
  createHospitalSnapshot as createHospitalSnapshotWithInputs,
} from './domain/ranking/snapshot';

export {
  FactorScores,
  NormalizedFactors,
  ScoredHospital,
  calculateFactorScores,
  calculateFinalScore,
  normalizeFactors,
} from './domain/ranking/scoring';

export {
  SelectionState,
  CandidateState,
  HospitalCandidate,
  CandidateResponse,
  SelectionSnapshot,
  SelectionDecision,
  SelectionDecisionReason,
  createCandidate,
  isStateLocked,
  canTransition,
  canCandidateTransition,
  assertSelectionTransition,
} from './domain/selection/state';

export {
  InitializeInput,
  ResponseInput as ReducerResponseInput,
  initializeSelection,
  reduceResponse,
  reducePickup,
} from './domain/selection/reducer';

export {
  SelectionInput,
  ResponseInput,
  PickupInput,
  HospitalSelectionEngine,
} from './domain/selection/engine';

export {
  RankingErrorCode,
  RankingError,
  SelectionErrorCode,
  SelectionError,
} from './errors/ranking-errors';

export {
  HospitalProfileProvider,
  HospitalLiveStatusProvider,
  ETAProvider,
  ETAResult,
  HospitalInvitationDispatcher,
  HospitalInvitation,
  InvitationResult,
  ClockProvider,
  SystemClockProvider,
  createSystemClock,
} from './ports/providers';

export {
  SelectionStateStore,
  VersionedSelection,
  CasResult,
  CasSuccess,
  CasConflict,
} from './ports/selection-state-store';

export {
  EmergencyRequirementProvider,
  EmergencyRequirementContext,
} from './ports/emergency-requirement-provider';

// ── Infrastructure — TEST/DEV ONLY reference implementations ────────────────
export {
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createDemoHospitalData,
} from './infrastructure/in-memory';

export { InMemorySelectionStateStore } from './infrastructure/in-memory-selection-store';
export { InMemoryInvitationDispatcher } from './infrastructure/in-memory-dispatcher';
