# Docsahab Core Hospital Decision Engine (v2.0.0)

A standalone, deterministic, explainable, **persistence-ready** TypeScript decision
engine that filters, ranks, and selects hospitals during emergency medical
coordination. Zero runtime dependencies. No AI/ML. No fallback. No framework or
database coupling in the core.

## What it is / is not
- **Is:** a pure decision core (eligibility → freshness → hard filter → fresh ETA →
  score → rank → invite → accept → replace-if-better → pickup lock) plus an async
  orchestrator over injectable ports.
- **Is not:** a persistence layer, an HTTP server, a hospital directory, a clinical
  diagnosis engine, or an AI model.

## Architecture
- **Ranking** (`domain/ranking/*`): pure snapshot + scoring + deterministic sort.
- **Selection** (`domain/selection/*`): a **pure reducer** (`reducer.ts`) and an
  **orchestrator** (`engine.ts`) that persists via a `SelectionStateStore` port
  with optimistic compare-and-set.
- **Ports** (`ports/*`): `HospitalProfileProvider`, `HospitalLiveStatusProvider`,
  `ETAProvider`, `EmergencyRequirementProvider`, `SelectionStateStore`,
  `HospitalInvitationDispatcher`, `ClockProvider`.
- **Infrastructure** (`infrastructure/*`): TEST/DEV ONLY in-memory reference impls.

## Determinism, freshness & safety
- Same state + same input ⇒ same decision (property-tested).
- Freshness is a decision rule: `FRESH` / `STALE` / `EXPIRED`, clock-skew aware.
  STALE behavior is an explicit, configurable policy (`DEGRADE` default).
- Hard filters run before scoring; ineligible hospitals never become candidates.
- Malformed ETA (NaN/negative/Infinity) and missing live status are **excluded
  with structured reasons**, never scored favorably or silently dropped.
- Pickup irreversibly locks the destination; post-lock responses cannot change it.
- Selection-state persistence and multi-instance safety are delegated to the
  injected store's atomic `compareAndSwap` (see the integration guide).

## Ranking
Default weights: **Capability 50% / ETA 30% / Resources 20%.** ETA score decays
linearly to 0 at `maxETASeconds`. Deterministic tie-break:
capability → ETA → resource → hospitalId.

## Usage
```ts
const ranking = new HospitalRankingEngine(profileProvider, liveStatusProvider, etaProvider, clock);
const result = await ranking.rankHospitals({ emergency });

const selection = new HospitalSelectionEngine(clock, selectionStore); // inject a durable store in prod
await selection.initializeSelection({ emergencyId, rankedHospitals: result.rankedHospitals, topN: 3 });
await selection.processResponse({ emergencyId, candidateId, hospitalId, response: 'ACCEPT' });
await selection.processPickup({ emergencyId, pickedUpAt: new Date() }); // locks
```

## Scripts
- `npm run build` — compile to `dist/` (CommonJS + `.d.ts`).
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` — full Jest suite (unit / freshness / eligibility / selection /
  persistence / errors / property / adversarial / contract).
- `npm run harness` — run the read-only Docsahab integration harness.

## Integration
See `DOCSAHAB_HOSPITAL_ENGINE_INTEGRATION_GUIDE.md`,
`DOCSAHAB_HOSPITAL_ENGINE_FILE_MAP.md`, and `integration-contract.json`. Two
product decisions are flagged there: **STALE data policy** and **fallback
retirement**. The engine must become the *single* hospital decision authority —
the current Docsahab decision path is retired at cutover, never run in parallel.
