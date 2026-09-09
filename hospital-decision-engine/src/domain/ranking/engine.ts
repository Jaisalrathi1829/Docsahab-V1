import { HospitalId, EmergencyId, Capability, ResourceType, createEmergencyId, createHospitalId } from '../models/types';
import { HospitalProfile } from '../models/hospital-profile';
import { HospitalLiveStatus } from '../models/hospital-live-status';
import { HospitalSnapshot } from '../models/hospital-snapshot';
import { EmergencyRequirement } from '../models/emergency-requirement';
import { RankingConfiguration, DEFAULT_RANKING_CONFIGURATION, validateConfiguration } from './configuration';
import { createHospitalSnapshot, SnapshotInputs, ETAResult } from './snapshot';
import { calculateFactorScores, calculateFinalScore, FactorScores, ScoredHospital } from './scoring';
import { ClockProvider, ETAProvider, HospitalProfileProvider, HospitalLiveStatusProvider } from '../../ports/providers';
import { RankingError, RankingErrorCode } from '../../errors/ranking-errors';

export interface RankingInput {
  emergency: EmergencyRequirement;
  hospitalIds?: ReadonlyArray<HospitalId>;
  config?: Partial<RankingConfiguration>;
}

export interface RankingResult {
  emergencyId: EmergencyId;
  rankedHospitals: ReadonlyArray<RankedHospital>;
  configurationVersion: string;
  rankedAt: Date;
  eligibleCount: number;
  totalConsidered: number;
}

export interface RankedHospital {
  hospitalId: HospitalId;
  rank: number;
  finalScore: number;
  factorScores: FactorScores;
  normalizedFactors: {
    capability: number;
    eta: number;
    resource: number;
  };
  distanceKm?: number;
  etaSeconds?: number;
  eligibility: {
    eligible: boolean;
    reasons: ReadonlyArray<{
      type: string;
      details?: Record<string, unknown>;
    }>;
  };
  freshness: 'FRESH' | 'STALE' | 'EXPIRED';
  lastUpdated: Date;
  snapshotAt: Date;
  capabilityMatch: {
    matchPercentage: number;
    mandatoryMatched: number;
    mandatoryMissing: number;
    preferredMatched: number;
    preferredMissing: number;
  };
  resourceAvailability: {
    overallScore: number;
    resources: ReadonlyArray<{
      resourceType: string;
      available: number;
      required: number;
      meetsRequirement: boolean;
      percentage: number;
    }>;
  };
  rankingReasons: ReadonlyArray<string>;
}

export class HospitalRankingEngine {
  private profileProvider: HospitalProfileProvider;
  private liveStatusProvider: HospitalLiveStatusProvider;
  private etaProvider: ETAProvider;
  private clock: ClockProvider;
  private defaultConfig: RankingConfiguration;

  constructor(
    profileProvider: HospitalProfileProvider,
    liveStatusProvider: HospitalLiveStatusProvider,
    etaProvider: ETAProvider,
    clock: ClockProvider,
    defaultConfig: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION
  ) {
    this.profileProvider = profileProvider;
    this.liveStatusProvider = liveStatusProvider;
    this.etaProvider = etaProvider;
    this.clock = clock;
    this.defaultConfig = defaultConfig;
  }

  async rankHospitals(input: RankingInput): Promise<RankingResult> {
    const config = this.mergeConfiguration(input.config);
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      throw new RankingError(RankingErrorCode.INVALID_CONFIGURATION, validation.errors.join('; '));
    }

    const now = this.clock.now();
    const emergency = input.emergency;

    const profiles = await this.getProfiles(input.hospitalIds);
    const liveStatuses = await this.getLiveStatuses(input.hospitalIds);

    const snapshots: Map<HospitalId, HospitalSnapshot> = new Map();
    const etaResults: Map<HospitalId, ETAResult> = new Map();

    for (const [hospitalId, profile] of profiles) {
      const liveStatus = liveStatuses.get(hospitalId);
      if (!liveStatus) {
        continue;
      }

      const etaResult = await this.getETA(emergency.ambulanceLocation, profile.location);
      if (etaResult) {
        etaResults.set(hospitalId, etaResult);
      }

      const snapshotInputs: SnapshotInputs = {
        profile,
        liveStatus,
        emergency,
        etaResult: etaResult ?? null,
        now,
        config,
      };

      const snapshot = createHospitalSnapshot(snapshotInputs);
      snapshots.set(hospitalId, snapshot);
    }

    const scoredHospitals = this.scoreHospitals(snapshots, etaResults, config);
    const eligibleHospitals = scoredHospitals.filter(h => h.snapshot.derived.eligibility.eligible);
    const rankedHospitals = this.rankHospitalsList(eligibleHospitals, config);

    return {
      emergencyId: emergency.emergencyId,
      rankedHospitals,
      configurationVersion: config.configurationVersion,
      rankedAt: now,
      eligibleCount: eligibleHospitals.length,
      totalConsidered: snapshots.size,
    };
  }

  private async getProfiles(hospitalIds?: ReadonlyArray<HospitalId>): Promise<Map<HospitalId, HospitalProfile>> {
    const all = await this.profileProvider.getAllHospitalProfiles();
    const profiles = new Map<HospitalId, HospitalProfile>(all);
    if (hospitalIds && hospitalIds.length > 0) {
      const filtered = new Map<HospitalId, HospitalProfile>();
      for (const id of hospitalIds) {
        const p = profiles.get(id);
        if (p) filtered.set(id, p);
      }
      return filtered;
    }
    return profiles;
  }

  private async getLiveStatuses(hospitalIds?: ReadonlyArray<HospitalId>): Promise<Map<HospitalId, HospitalLiveStatus>> {
    const all = await this.liveStatusProvider.getAllHospitalLiveStatuses();
    const statuses = new Map<HospitalId, HospitalLiveStatus>(all);
    if (hospitalIds && hospitalIds.length > 0) {
      const filtered = new Map<HospitalId, HospitalLiveStatus>();
      for (const id of hospitalIds) {
        const s = statuses.get(id);
        if (s) filtered.set(id, s);
      }
      return filtered;
    }
    return statuses;
  }

  private async getETA(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): Promise<ETAResult | null> {
    try {
      return await this.etaProvider.calculateETA(origin, destination);
    } catch {
      return null;
    }
  }

  private scoreHospitals(
    snapshots: Map<HospitalId, HospitalSnapshot>,
    etaResults: Map<HospitalId, ETAResult>,
    config: RankingConfiguration
  ): ReadonlyArray<{ hospitalId: HospitalId; snapshot: HospitalSnapshot; factorScores: FactorScores; finalScore: number; etaResult?: ETAResult }> {
    const scored: Array<{ hospitalId: HospitalId; snapshot: HospitalSnapshot; factorScores: FactorScores; finalScore: number; etaResult?: ETAResult }> = [];

    for (const [hospitalId, snapshot] of snapshots) {
      const etaResult = etaResults.get(hospitalId);
      
      const factorScores = calculateFactorScores(
        snapshot.derived.capabilityMatch,
        snapshot.derived.resourceAvailability,
        etaResult?.etaSeconds,
        etaResult?.distanceKm,
        config
      );

      const finalScore = calculateFinalScore(factorScores, config);

      scored.push({
        hospitalId,
        snapshot,
        factorScores,
        finalScore,
        etaResult: etaResult ?? undefined,
      });
    }

    return scored;
  }

  private rankHospitalsList(
    hospitals: ReadonlyArray<{ hospitalId: HospitalId; snapshot: HospitalSnapshot; factorScores: FactorScores; finalScore: number; etaResult?: ETAResult }>,
    config: RankingConfiguration
  ): ReadonlyArray<RankedHospital> {
    const sorted = [...hospitals].sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return this.tieBreak(a, b, config);
    });

    return sorted.map((h, index) => ({
      hospitalId: h.hospitalId,
      rank: index + 1,
      finalScore: h.finalScore,
      factorScores: h.factorScores,
      normalizedFactors: {
        capability: h.factorScores.capabilityScore,
        eta: h.factorScores.etaScore,
        resource: h.factorScores.resourceScore,
      },
      distanceKm: h.etaResult?.distanceKm,
      etaSeconds: h.etaResult?.etaSeconds,
      eligibility: {
        eligible: h.snapshot.derived.eligibility.eligible,
        reasons: h.snapshot.derived.eligibility.reasons.map(r => ({ type: r.type, details: r as any })),
      },
      freshness: h.snapshot.freshness,
      lastUpdated: h.snapshot.liveStatus.lastUpdated,
      snapshotAt: h.snapshot.snapshotAt,
      capabilityMatch: {
        matchPercentage: h.snapshot.derived.capabilityMatch.matchPercentage,
        mandatoryMatched: h.snapshot.derived.capabilityMatch.mandatoryMatched.size,
        mandatoryMissing: h.snapshot.derived.capabilityMatch.mandatoryMissing.size,
        preferredMatched: h.snapshot.derived.capabilityMatch.preferredMatched.size,
        preferredMissing: h.snapshot.derived.capabilityMatch.preferredMissing.size,
      },
      resourceAvailability: {
        overallScore: h.snapshot.derived.resourceAvailability.overallScore,
        resources: Array.from(h.snapshot.derived.resourceAvailability.resources.entries()).map(([type, avail]) => ({
          resourceType: type.toString(),
          available: avail.available,
          required: avail.required,
          meetsRequirement: avail.meetsRequirement,
          percentage: avail.percentage,
        })),
      },
      rankingReasons: this.generateRankingReasons(h.snapshot, h.factorScores, h.etaResult),
    }));
  }

  private tieBreak(
    a: { hospitalId: HospitalId; snapshot: HospitalSnapshot; factorScores: FactorScores; finalScore: number; etaResult?: ETAResult },
    b: { hospitalId: HospitalId; snapshot: HospitalSnapshot; factorScores: FactorScores; finalScore: number; etaResult?: ETAResult },
    config: RankingConfiguration
  ): number {
    const policy = config.tieBreakPolicy.strategy;
    
    if (policy === 'CAPABILITY_THEN_ETA_THEN_RESOURCE_THEN_ID') {
      if (b.factorScores.capabilityScore !== a.factorScores.capabilityScore) {
        return b.factorScores.capabilityScore - a.factorScores.capabilityScore;
      }
      const aEta = a.factorScores.etaScore;
      const bEta = b.factorScores.etaScore;
      if (bEta !== aEta) {
        return bEta - aEta;
      }
      if (b.factorScores.resourceScore !== a.factorScores.resourceScore) {
        return b.factorScores.resourceScore - a.factorScores.resourceScore;
      }
      return a.hospitalId.localeCompare(b.hospitalId);
    }

    return a.hospitalId.localeCompare(b.hospitalId);
  }

  private generateRankingReasons(
    snapshot: HospitalSnapshot,
    factorScores: FactorScores,
    etaResult?: ETAResult
  ): ReadonlyArray<string> {
    const reasons: string[] = [];

    if (snapshot.derived.capabilityMatch.mandatoryMissing.size === 0) {
      reasons.push('All mandatory capabilities available');
    }

    if (snapshot.derived.capabilityMatch.preferredMissing.size === 0) {
      reasons.push('All preferred capabilities available');
    } else if (snapshot.derived.capabilityMatch.preferredMissing.size > 0) {
      reasons.push(`${snapshot.derived.capabilityMatch.preferredMissing.size} preferred capabilities missing`);
    }

    if (etaResult) {
      reasons.push(`ETA: ${Math.round(etaResult.etaSeconds / 60)} minutes`);
    }

    if (snapshot.derived.resourceAvailability.overallScore > 0.8) {
      reasons.push('Strong resource availability');
    } else if (snapshot.derived.resourceAvailability.overallScore > 0.5) {
      reasons.push('Moderate resource availability');
    } else {
      reasons.push('Limited resource availability');
    }

    return reasons;
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
