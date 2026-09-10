# Docsahab Hospital Decision Engine — Integration Guide (v2.0.0)

This guide is the contract for the **future** integration task. It documents how
the standalone engine becomes the **single authoritative** hospital decision core
inside Docsahab. Nothing here modifies the running application; the actual
integration is a separate task that happens **after** the authority cutover
decision below.

---

## 1. Architecture

```
                         DOCSAHAB
                  Orchestration Layer (Express, events, lifecycle)
                            │
             ┌──────────────┴──────────────┐
             ↓                             ↓
      EmergencyRequirementProvider   SelectionStateStore (Postgres, CAS)
             │                             │
             ↓                             │
     HOSPITAL DECISION ENGINE  ────────────┘
        (pure ranking + pure selection reducer + async orchestrator)
             │
   ┌─────────┼───────────┬────────────────┐
   ↓         ↓           ↓                ↓
Profile   LiveStatus   ETA        InvitationDispatcher
Provider  Provider     Provider   (orchestration transport)
```

The engine **owns decisions**. Docsahab **owns durability, transport, security,
and lifecycle.**

---

## 2. Source-of-truth boundaries

| Concern | Authority |
|---|---|
| Eligibility, hard filtering, capability/resource/ETA scoring, ranking, candidate ordering | **Engine** |
| Acceptance precedence, temporary assignment, better-ranked replacement, pickup lock | **Engine** (pure reducer) |
| Persistent `Emergency.assignedHospitalId`, atomic commit, version | **Docsahab (Postgres via SelectionStateStore)** |
| Invitation transport, events, timeline, realtime | **Docsahab** |
| Requirement derivation (clinical signals → capabilities) | **Docsahab (EmergencyRequirementProvider)** |
| Auth / security | **Docsahab** |

There must be **exactly one** ranking authority, **one** selection authority, and
**one** persistent assignment truth.

---

## 3. Engine responsibilities
- Deterministic, explainable ranking recalculated fresh per emergency.
- Freshness evaluation (FRESH / STALE / EXPIRED, clock-skew aware).
- Hard eligibility filtering (capability, operational, accepting, scoped
  department, mandatory resources, ETA/distance, freshness, explicit exclusion).
- Pure selection reducer: initial assignment, better-ranked replacement,
  worse-ranked rejection, expiry, pickup lock.
- Structured decisions and structured exclusion reasons.

## 4. Docsahab responsibilities
- Implement the provider ports (below).
- Implement `SelectionStateStore` transactionally against Postgres.
- Derive `EmergencyRequirement` from clinical signals.
- Dispatch invitations and translate `SelectionDecision` into events/timeline.
- Persist `assignedHospitalId` from the engine's decision.

---

## 5. Provider contracts (what Docsahab implements)

| Port | Method(s) | Notes |
|---|---|---|
| `HospitalProfileProvider` | `getAllHospitalProfiles()`, `getHospitalProfile(id)` | Static profile. Reads `Hospital` table. |
| `HospitalLiveStatusProvider` | `getAllHospitalLiveStatuses()`, `getHospitalLiveStatus(id)`, `updateHospitalLiveStatus(...)` | Live capacity/operational. **Requires new table (§11).** |
| `ETAProvider` | `calculateETA(origin, dest) → { distanceKm, etaSeconds }` | Wrap the existing `navigation.provider.ts`. Units: **km + seconds**. |
| `EmergencyRequirementProvider` | `deriveRequirement(context) → EmergencyRequirement` | Deterministic clinical mapping (§10). |
| `SelectionStateStore` | `load`, `create`, `compareAndSwap` | Optimistic concurrency (§6, §7). |
| `HospitalInvitationDispatcher` | `sendInvitation(s)` | Transport only. |
| `ClockProvider` | `now()` | Injected time. |

A provider that **throws** surfaces as a typed `RankingError`
(`PROFILE_PROVIDER_FAILURE` / `LIVE_STATUS_PROVIDER_FAILURE`, `retryable: true`).
A per-hospital ETA failure **excludes that hospital** (`ETA_UNAVAILABLE`) and never
aborts the whole ranking.

---

## 6. Persistence contract

```ts
interface SelectionStateStore {
  load(emergencyId): Promise<VersionedSelection | null>;
  create(snapshot): Promise<VersionedSelection>;          // fails if exists
  compareAndSwap(emergencyId, expectedVersion, next): Promise<CasResult>;
}
type CasResult = { ok: true; version } | { ok: false; conflict: true; current };
```

The engine's orchestrator does **load → reduce → compareAndSwap** with bounded
retry (5 attempts). A no-op decision (`decision.stateChanged === false`) never
writes — so duplicate/obsolete responses are idempotent even under retries.

---

## 7. Atomic transaction model (reference Postgres implementation)

Recommended table:

```sql
CREATE TABLE hospital_selection_state (
  emergency_id TEXT PRIMARY KEY REFERENCES "Emergency"(id) ON DELETE CASCADE,
  snapshot     JSONB NOT NULL,      -- serialized SelectionSnapshot
  version      INTEGER NOT NULL,    -- optimistic-concurrency token
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

```ts
// load
SELECT snapshot, version FROM hospital_selection_state WHERE emergency_id = $1;

// create (once-only; unique PK enforces it)
INSERT INTO hospital_selection_state (emergency_id, snapshot, version)
VALUES ($1, $2, 1);

// compareAndSwap — rowcount decides success
UPDATE hospital_selection_state
   SET snapshot = $3, version = version + 1, updated_at = now()
 WHERE emergency_id = $1 AND version = $2;
// rowcount === 1 → { ok:true, version: $2+1 }
// rowcount === 0 → re-SELECT and return { ok:false, conflict:true, current }
```

Because `assignedHospitalId` on `Emergency` is the app-facing truth, the same
transaction that CAS-updates the snapshot should also set
`Emergency.assignedHospitalId` from `decision.newAssignment?.hospitalId`, so the
two never diverge. Docsahab's **existing** `acceptHospitalAtomically` /
`reassignHospitalAtomically` transaction pattern (conditional `updateMany` inside
`$transaction`) is the correct home for this — **reuse it, do not rebuild it.**

---

## 8. Event mapping

| Engine `SelectionDecision.reason.type` | Docsahab event (existing) |
|---|---|
| `INITIAL_ASSIGNMENT` | `hospitalAccepted` + `hospitalAssigned` |
| `REPLACEMENT` | `hospitalAccepted` + `hospitalReassigned` |
| `NO_REPLACEMENT_LOWER_RANK` | `hospitalAccepted` (recorded, no assignment change) |
| `REJECTION_RECORDED` | `hospitalRejected` |
| `LOCKED_AT_PICKUP` | `hospitalAssignmentLocked` |
| `RESPONSE_REJECTED_*` | (log/audit only — no lifecycle change) |
| `NO_ELIGIBLE_CANDIDATES` / `PICKUP_WITHOUT_ASSIGNMENT` | `hospitalSearchExhausted` (or product-defined) |

## 9. Invitation / response flow
1. Ambulance → `AMBULANCE_EN_ROUTE`.
2. Docsahab builds `EmergencyRequirement` via `EmergencyRequirementProvider`.
3. `HospitalRankingEngine.rankHospitals()` → ranked + excluded (with reasons).
4. Docsahab persists candidates, `HospitalSelectionEngine.initializeSelection()`.
5. `HospitalInvitationDispatcher` sends parallel invitations.
6. Hospital responds → Docsahab calls `processResponse()`.
7. Docsahab persists snapshot + `assignedHospitalId`, emits events.
8. On pickup → `processPickup()` → lock.

---

## 10. Requirement derivation boundary

The engine is clinically agnostic. Docsahab implements
`EmergencyRequirementProvider.deriveRequirement()` deterministically:

| Docsahab signal (keyword in `probableEmergency`) | Engine capability |
|---|---|
| cardiac, heart, chest pain, MI | `CARDIAC_EMERGENCY` |
| stroke, seizure, neuro | `NEUROLOGICAL_EMERGENCY` |
| trauma, accident, RTA, injury, fracture, fall | `TRAUMA` |
| burn | `BURN_UNIT` |
| poison, toxic, overdose | `TOXICOLOGY` |
| pediatric, child, infant | `PEDIATRIC_EMERGENCY` |
| obstetric, pregnant, labour, delivery | `OBSTETRIC_EMERGENCY` |
| severity CRITICAL | add mandatory `ICU_BEDS ≥ 1` |

`examples/docsahab-reference-adapter.ts::deriveRequirement` is a working
reference. **Allergy / critical-alert information is NOT a ranking input** — it
remains a clinical alert surfaced to responders (unchanged product behavior). See
**PRODUCT DECISION** below if that must change.

---

## 11. Live hospital data model (new table required)

The current `Hospital` table has one live-ish scalar (`availableBeds`). The engine
needs a separate live-status record. Recommended new table (added to the EXISTING
Postgres, **not** a second database):

```sql
CREATE TABLE hospital_live_status (
  hospital_id                  TEXT PRIMARY KEY REFERENCES "Hospital"(id) ON DELETE CASCADE,
  accepting_emergency_patients BOOLEAN NOT NULL,   -- hard eligibility
  operational_status           TEXT NOT NULL,      -- hard eligibility
  emergency_dept_status        TEXT NOT NULL,      -- hard eligibility (scoped)
  trauma_dept_status           TEXT NOT NULL,      -- hard eligibility (scoped)
  icu_beds_available           INTEGER NOT NULL,   -- ranking + eligibility
  general_beds_available       INTEGER NOT NULL,   -- ranking
  er_bays_available            INTEGER NOT NULL,   -- ranking
  trauma_bays_available        INTEGER NOT NULL,   -- ranking
  ventilators_available        INTEGER NOT NULL,   -- ranking
  blood_products_available     BOOLEAN NOT NULL,   -- display/audit
  last_updated                 TIMESTAMPTZ NOT NULL, -- FRESHNESS (mandatory)
  data_source                  TEXT NOT NULL       -- audit metadata
);
```

Field classification: `accepting_*`, `operational_status`, `*_dept_status`,
`icu_beds_available`, `last_updated` are **hard-eligibility** inputs; the bed/bay
counts are **ranking** inputs; `blood_products_available`, `data_source` are
**display/audit**. Capability expansion (the 6 capabilities the 3-boolean model
cannot express) requires either extra boolean columns or a `hospital_capability`
join table.

To engine capabilities that the current `Hospital` table **cannot** represent
today (REQUIRES SCHEMA CHANGE): `NEUROLOGICAL_EMERGENCY`, `PEDIATRIC_EMERGENCY`,
`OBSTETRIC_EMERGENCY`, `BURN_UNIT`, `TOXICOLOGY`, `ISOLATION`.

---

## 12. Prisma migration requirements (summary)
1. `HospitalLiveStatus` model/table (§11).
2. `HospitalSelectionState` model/table (§7).
3. Capability expansion (columns or join table) if emergencies need capabilities
   beyond cardiac/trauma/ICU.
4. All **additive** — no destructive change to existing models.

---

## 13. Old-system authority cutover
See `DOCSAHAB_HOSPITAL_ENGINE_FILE_MAP.md` for the per-file KEEP/MODIFY/RETIRE
plan. The one hard rule: **only one decision authority may ever mutate
`Emergency.assignedHospitalId`.** Until cutover, the new engine must not be wired
to production assignment state. Cutover sequence:
1. Land the two migrations (live status + selection state), no behavior change.
2. Implement the provider + store adapters (new files, not wired).
3. Behind a flag, route `hospitalCandidatesRanked` → new engine in a shadow mode
   that computes but does not persist; compare against the old system.
4. Flip the flag so the new engine becomes the sole writer; **retire** the old
   ranking/selection/reassignment/fallback code paths in the same change.

---

## 14. Fallback retirement — **PRODUCT DECISION REQUIRED**
- **Current behavior:** `hospital.service.ts` expands the search radius and
  re-invites when all candidates reject (`runFallbackSearchIfExhausted`).
- **New engine:** has **no fallback**; exhaustion is terminal and explicit.
- **Options:**
  1. *(Recommended)* Retire the radius-expansion fallback; on exhaustion, surface
     an explicit "no hospital available — operator action" state. Simplest, matches
     the new engine's mandate, safest determinism.
  2. Keep radius-expansion in **Docsahab orchestration** (not the engine): on
     `noEligibleHospitals`, Docsahab re-invokes ranking with a wider
     `maxDistanceKm`. Preserves current capability without putting fallback in the
     engine.
- **Consequence:** Option 1 changes observable behavior (no auto-retry); Option 2
  keeps it but adds orchestration complexity. This is a product call, not an
  engineering one — do not silently pick.

## 15. STALE data policy — **PRODUCT DECISION REQUIRED**
- **Ambiguity:** the spec never defines what STALE (fresh<age≤stale) data should do.
- **Implemented default (configurable):** `DEGRADE` — stale hospitals stay
  eligible but their live-derived (resource) score is multiplied by
  `staleConfidenceMultiplier` (0.6), so fresher hospitals of equal quality rank
  higher. Alternatives: `EXCLUDE` (hard-exclude stale) or `ALLOW` (full trust).
- **Recommendation:** confirm `DEGRADE`. `EXCLUDE` risks starving the pool (no
  fallback); `ALLOW` trusts up-to-15-min-old capacity at full confidence.
- Set via `RankingConfiguration.freshnessPolicy.staleBehavior`.

---

## 16. Integration sequence (for the next task)
1. Migrations (§12).
2. `SelectionStateStore` Postgres adapter (§7).
3. Provider adapters (`HospitalProfileProvider`, `HospitalLiveStatusProvider`,
   `ETAProvider`, `EmergencyRequirementProvider`).
4. Wire ranking+selection behind a flag (shadow mode).
5. Cutover + retire old decision paths (§13).

## 17. Verification sequence
- Engine unit/property/adversarial suite (`npm test`) green.
- Contract-compat test green.
- Shadow-mode diff: new vs old ranking over real emergencies.
- E2E workflow test on the integrated path.

## 18. Rollback strategy
Cutover is a single flag flip plus the retirement change. Rollback = revert the
flag (old paths remain until the retirement change is deployed). Migrations are
additive and safe to leave in place on rollback.

## 19. Error model — what to catch / inspect / retry
| Condition | Surfaced as | Retryable? |
|---|---|---|
| Invalid config | `RankingError INVALID_CONFIGURATION` (throw) | No |
| Profile/live provider throws | `RankingError *_PROVIDER_FAILURE` (throw) | Yes |
| Per-hospital ETA failure | `ETA_UNAVAILABLE` exclusion (no throw) | n/a |
| No selection state | `SelectionError NO_SELECTION_STATE` (throw) | No |
| Store I/O failure | `SelectionError PERSISTENCE_FAILURE` (throw) | Yes |
| CAS retries exhausted | `SelectionError PERSISTENCE_CONFLICT_EXHAUSTED` (throw) | Yes |
| Duplicate/obsolete/locked/expired/unknown response | `SelectionDecision.reason` (returned, **not** thrown) | n/a |

**Rule:** `try/catch` the throwables; **inspect `decision.reason.type`** for every
response-level condition. Retry only `retryable: true` errors.

## 20. Known limitations
- Selection safety across instances depends on the injected store's CAS being
  genuinely atomic (Postgres row-version). The in-memory store is TEST/DEV ONLY.
- Capability vocabulary richer than the current DB (6 capabilities need schema).
- Freshness is only meaningful once a real `last_updated` feed exists; the
  reference adapter fabricates it and says so.
- No candidate-expiry sweep runs on its own — expiry is enforced lazily when a
  late response arrives (which is the only moment it matters).
