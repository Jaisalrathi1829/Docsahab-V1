# Docsahab Hospital Engine — Integration File Map

Per-file plan for the **future** integration/cutover task. **None of these files
are modified by the remediation task** — this is a map, not a changelog. All paths
are relative to `backend/` unless noted.

Legend: **KEEP** (unchanged) · **MODIFY** · **RETIRE** (delete decision logic
after cutover) · **REUSE** (repurpose mechanism) · **ADAPTER** (new adapter needed)
· **MIGRATION** (schema change).

| File | Current responsibility | Action | Engine change? | Adapter? | Persistence? | API? | Frontend? | Migration? | Reason / Risk |
|---|---|---|---|---|---|---|---|---|---|
| `src/services/hospital.service.ts` | Ranking + eligibility + ETA cutoff + candidate gen + acceptance + reassignment + **fallback** + notification | **RETIRE** decision logic (ranking/eligibility/scoring/reassignment/fallback); KEEP notification orchestration | No | Yes | No | Maybe | No | No | This is the OTHER decision brain. Its ranking/selection must be replaced by the engine so there is one authority. **Risk: HIGH** — largest behavioral change; do behind a flag. |
| `src/repositories/hospital.repository.ts` | Transactional atomic accept/reassign/lock (`$transaction` + conditional `updateMany`) | **REUSE** as the body of the Postgres `SelectionStateStore` + `assignedHospitalId` commit | No | Yes | Reshaped | No | No | Maybe | This atomicity is exactly what the engine's store contract needs — do not rebuild it. **Risk: MEDIUM.** |
| `src/providers/hospital-selection.provider.ts` | Simulation auto-acceptor calling the OLD ranking/selection | **MODIFY** to drive the NEW engine (or retire once a real hospital console exists) | No | Yes | No | No | No | No | Currently occupies the `hospitalCandidatesRanked` seam. **Risk: MEDIUM.** |
| `src/config/hospital-ranking.config.ts` | Weights, radii, golden-hour, keyword capability rules | **RETIRE** (superseded by engine `RankingConfiguration`) except the keyword rules, which move into the `EmergencyRequirementProvider` adapter | No | Yes | No | No | No | No | Keyword→capability mapping is derivation, now Docsahab's job. **Risk: LOW.** |
| `src/types/hospital.types.ts` | `RankedHospital`, `RequiredCapabilities`, payloads | **MODIFY**/RETIRE — engine now owns `RankedHospital`/`RankingResult`; keep DTOs used by controllers | No | No | No | No | No | No | Avoid two `RankedHospital` types. **Risk: LOW.** |
| `src/providers/navigation.provider.ts` | Haversine `RouteEstimate {distanceKm, etaMinutes}` | **REUSE** via a thin `ETAProvider` adapter (minutes→seconds) | No | Yes | No | No | No | No | Clean reuse. **Risk: LOW.** |
| `src/services/emergency.service.ts` | Lifecycle state machine, `emergencyEvents`, timestamp stamping | **KEEP** | No | No | No | No | No | No | Lifecycle stays Docsahab's. **Risk: LOW.** |
| `src/services/clinical-derivation.service.ts` | `probableEmergency` / `criticalAlert` derivation (no AI) | **REUSE** as the input to `EmergencyRequirementProvider` | No | Yes | No | No | No | No | Its output string feeds the capability mapping; allergy stays a critical alert, not a ranking input. **Risk: LOW.** |
| `src/server.ts` | Registers `registerHospitalEventHandlers()` + `registerHospitalSelectionProvider()` | **MODIFY** to register the new-engine-backed handlers behind a flag | No | Yes | No | No | No | No | Single wiring point for cutover. **Risk: MEDIUM.** |
| `prisma/schema.prisma` | `Hospital` (static + `availableBeds`), `HospitalCandidate`, `Emergency` | **MIGRATION** — add `HospitalLiveStatus` + `HospitalSelectionState`; optional capability expansion | No | No | Yes | No | No | Yes | The engine's live/freshness model has no home today. **Risk: MEDIUM** (additive only). |
| `prisma/seed.ts` | Seeds hospitals with 3 booleans + `availableBeds` | **MODIFY** to also seed `HospitalLiveStatus` (incl. `lastUpdated`) | No | No | Yes | No | No | Yes | Demos need real freshness data. **Risk: LOW.** |
| `src/controllers/hospital.controller.ts`, `src/routes/hospital.routes.ts` | Hospital console inbox + response endpoints | **KEEP**/MODIFY — forward responses to the engine instead of the old service | No | Yes | No | Maybe | No | No | Transport unchanged; target swapped. **Risk: LOW.** |
| Frontend (`frontend-revised/**`) | Renders `assignedHospital` + lock flag from the view-model | **KEEP** | No | No | No | No | No | No | View-model shape is unchanged; the engine feeds the same fields. **Risk: NONE.** |

**Invariant for the whole cutover:** at no point may both the old
`hospital.service.ts` decision path and the new engine write
`Emergency.assignedHospitalId`. Shadow-mode first (engine computes, does not
persist), then a single flag flip that also retires the old paths.
