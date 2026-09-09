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
  createHospitalLiveStatus,
  isStatusFresh,
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
  FreshnessThresholds,
  TieBreakPolicy,
  CapabilityPolicy,
  ResourcePolicy,
  DEFAULT_RANKING_CONFIGURATION,
  validateConfiguration,
  ValidationResult,
} from './domain/ranking/configuration';

export {
  RankingInput,
  RankingResult,
  RankedHospital,
  HospitalRankingEngine,
} from './domain/ranking/engine';

export {
  SnapshotInputs,
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
} from './domain/selection/state';

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
  DomainErrorType,
  DomainError,
} from './domain/errors';

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
  InMemoryHospitalProfileProvider,
  InMemoryHospitalLiveStatusProvider,
  HaversineETAProvider,
  InMemoryClockProvider,
  createDemoHospitalData,
} from './infrastructure/in-memory';

export {
  DEFAULT_RANKING_CONFIG,
  validateRankingConfig,
} from './domain/config';
