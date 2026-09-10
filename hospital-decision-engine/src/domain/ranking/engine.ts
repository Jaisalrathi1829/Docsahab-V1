import { HospitalId, EmergencyId } from '../models/types';
import { HospitalProfile } from '../models/hospital-profile';
import { HospitalLiveStatus, FreshnessLevel } from '../models/hospital-live-status';
import { HospitalSnapshot } from '../models/hospital-snapshot';
import { EmergencyRequirement } from '../models/emergency-requirement';
import {
  RankingConfiguration,
  DEFAULT_RANKING_CONFIGURATION,
  validateConfiguration,
  mergeConfiguration,
} from './configuration';
import { createHospitalSnapshot, SnapshotInputs, ETAResult } from './snapshot';
import { calculateFactorScores, calculateFinalScore, FactorScores } from './scoring';
import { ClockProvider, ETAProvider, HospitalProfileProvider, HospitalLiveStatusProvider } from '../../ports/providers';
import { RankingError, RankingErrorCode } from '../../errors/ranking-errors';

export interface RankingInput {
  emergency: EmergencyRequirement;
  hospitalIds?: ReadonlyArray<HospitalId>;
  config?: Partial<RankingConfiguration>;
}

export interface ExcludedHospital {
  hospitalId: HospitalId;
  reasons: ReadonlyArray<{ type: string; details?: Record<string, unknown> }>;
  freshness?: FreshnessLevel;
}

export interface RankingResult {
  emergencyId: EmergencyId;
  rankedHospitals: ReadonlyArray<RankedHospital>;
  /** Every hospital considered but not eligible, with structured reasons. */
  excludedHospitals: ReadonlyArray<ExcludedHospital>;
  configurationVersion: string;
  rankedAt: Date;
  eligibleCount: number;
  excludedCount: number;
  totalConsidered: number;
  /** Explicit, deterministic signal for the no-eligible-hospital case (Phase 6). */
  noEligibleHospitals: boolean;
}

export interface RankedHospital {
  hospitalId: HospitalId;
  rank: number;
  finalScore: number;
  factorScores: FactorScores;
  normalizedFactors: { capability: number; eta: number; resource: number };
  distanceKm?: number;
  etaSeconds?: number;
  eligibility: {
    eligible: boolean;
    reasons: ReadonlyArray<{ type: string; details?: Record<string, unknown> }>;
  };
  freshness: FreshnessLevel;
  usedStaleData: boolean;
  confidenceMultiplier: number;
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

type ScoredEntry = {
  hospitalId: HospitalId;
  snapshot: HospitalSnapshot;
  factorScores: FactorScores;
  finalScore: number;
  etaResult?: ETAResult;
};

export class HospitalRankingEngine {
  constructor(
    private readonly profileProvider: HospitalProfileProvider,
    private readonly liveStatusProvider: HospitalLiveStatusProvider,
    private readonly etaProvider: ETAProvider,
    private readonly clock: ClockProvider,
    private readonly defaultConfig: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION
  ) {}

  async rankHospitals(input: RankingInput): Promise<RankingResult> {
    const config = mergeConfiguration(this.defaultConfig, input.config);
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      throw new RankingError(RankingErrorCode.INVALID_CONFIGURATION, validation.errors.join('; '), false);
    }

    const now = this.clock.now();
    const emergency = input.emergency;

    const profiles = await this.getProfiles(input.hospitalIds);
    const liveStatuses = await this.getLiveStatuses(input.hospitalIds);

    const scored: ScoredEntry[] = [];
    const excluded: ExcludedHospital[] = [];

    for (const [hospitalId, profile] of profiles) {
      const liveStatus = liveStatuses.get(hospitalId);

      // P1-7: a hospital with a profile but no live status is NOT silently
      // dropped — it is reported as considered-and-excluded with a reason.
      if (!liveStatus) {
        excluded.push({ hospitalId, reasons: [{ type: 'MISSING_LIVE_STATUS' }] });
        continue;
      }

      // Per-hospital ETA. A failure excludes THIS hospital (recorded), it never
      // aborts the whole ranking and never becomes favorable data.
      const etaResult = await this.getETA(emergency.ambulanceLocation, profile.location);

      const snapshotInputs: SnapshotInputs = {
        profile,
        liveStatus,
        emergency,
        etaResult,
        now,
        config,
      };
      const snapshot = createHospitalSnapshot(snapshotInputs);

      const factorScores = calculateFactorScores(
        snapshot.derived.capabilityMatch,
        snapshot.derived.resourceAvailability,
        snapshot.derived.etaSeconds,
        snapshot.derived.distanceKm,
        config,
        snapshot.derived.confidenceMultiplier
      );
      const finalScore = calculateFinalScore(factorScores, config);

      const entry: ScoredEntry = {
        hospitalId,
        snapshot,
        factorScores,
        finalScore,
        etaResult: etaResult ?? undefined,
      };

      if (snapshot.derived.eligibility.eligible) {
        scored.push(entry);
      } else {
        excluded.push({
          hospitalId,
          freshness: snapshot.freshness,
          reasons: snapshot.derived.eligibility.reasons.map((r) => ({ type: r.type, details: r as unknown as Record<string, unknown> })),
        });
      }
    }

    const rankedHospitals = this.rankScored(scored, config);

    return {
      emergencyId: emergency.emergencyId,
      rankedHospitals,
      excludedHospitals: excluded,
      configurationVersion: config.configurationVersion,
      rankedAt: now,
      eligibleCount: rankedHospitals.length,
      excludedCount: excluded.length,
      totalConsidered: profiles.size,
      noEligibleHospitals: rankedHospitals.length === 0,
    };
  }

  private async getProfiles(hospitalIds?: ReadonlyArray<HospitalId>): Promise<Map<HospitalId, HospitalProfile>> {
    let all: ReadonlyMap<HospitalId, HospitalProfile>;
    try {
      all = await this.profileProvider.getAllHospitalProfiles();
    } catch (e) {
      throw new RankingError(
        RankingErrorCode.PROFILE_PROVIDER_FAILURE,
        `HospitalProfileProvider failed: ${(e as Error).message}`,
        true
      );
    }
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
    let all: ReadonlyMap<HospitalId, HospitalLiveStatus>;
    try {
      all = await this.liveStatusProvider.getAllHospitalLiveStatuses();
    } catch (e) {
      throw new RankingError(
        RankingErrorCode.LIVE_STATUS_PROVIDER_FAILURE,
        `HospitalLiveStatusProvider failed: ${(e as Error).message}`,
        true
      );
    }
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

  private async getETA(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<ETAResult | null> {
    try {
      return await this.etaProvider.calculateETA(origin, destination);
    } catch {
      // Recorded downstream as ETA_UNAVAILABLE (exclusion), never as favorable data.
      return null;
    }
  }

  private rankScored(scored: ReadonlyArray<ScoredEntry>, config: RankingConfiguration): ReadonlyArray<RankedHospital> {
    const sorted = [...scored].sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
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
      distanceKm: h.snapshot.derived.distanceKm,
      etaSeconds: h.snapshot.derived.etaSeconds,
      eligibility: {
        eligible: h.snapshot.derived.eligibility.eligible,
        reasons: h.snapshot.derived.eligibility.reasons.map((r) => ({ type: r.type, details: r as unknown as Record<string, unknown> })),
      },
      freshness: h.snapshot.freshness,
      usedStaleData: h.snapshot.derived.usedStaleData,
      confidenceMultiplier: h.snapshot.derived.confidenceMultiplier,
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
      rankingReasons: this.generateRankingReasons(h.snapshot, h.etaResult),
    }));
  }

  private tieBreak(a: ScoredEntry, b: ScoredEntry, config: RankingConfiguration): number {
    if (config.tieBreakPolicy.strategy === 'CAPABILITY_THEN_ETA_THEN_RESOURCE_THEN_ID') {
      if (b.factorScores.capabilityScore !== a.factorScores.capabilityScore) {
        return b.factorScores.capabilityScore - a.factorScores.capabilityScore;
      }
      if (b.factorScores.etaScore !== a.factorScores.etaScore) {
        return b.factorScores.etaScore - a.factorScores.etaScore;
      }
      if (b.factorScores.resourceScore !== a.factorScores.resourceScore) {
        return b.factorScores.resourceScore - a.factorScores.resourceScore;
      }
      return a.hospitalId.toString().localeCompare(b.hospitalId.toString());
    }
    return a.hospitalId.toString().localeCompare(b.hospitalId.toString());
  }

  private generateRankingReasons(snapshot: HospitalSnapshot, etaResult?: ETAResult): ReadonlyArray<string> {
    const reasons: string[] = [];
    if (snapshot.derived.capabilityMatch.mandatoryMissing.size === 0) {
      reasons.push('All mandatory capabilities available');
    }
    if (snapshot.derived.capabilityMatch.preferredMissing.size === 0) {
      reasons.push('All preferred capabilities available');
    } else {
      reasons.push(`${snapshot.derived.capabilityMatch.preferredMissing.size} preferred capabilities missing`);
    }
    if (etaResult && Number.isFinite(etaResult.etaSeconds)) {
      reasons.push(`ETA: ${Math.round(etaResult.etaSeconds / 60)} minutes`);
    }
    if (snapshot.derived.usedStaleData) {
      reasons.push(`Live data STALE — resource confidence reduced to ${Math.round(snapshot.derived.confidenceMultiplier * 100)}%`);
    }
    const rScore = snapshot.derived.resourceAvailability.overallScore;
    if (rScore > 0.8) reasons.push('Strong resource availability');
    else if (rScore > 0.5) reasons.push('Moderate resource availability');
    else reasons.push('Limited resource availability');
    return reasons;
  }
}
