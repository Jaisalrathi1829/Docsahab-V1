# Docsahab Current-State & Hackathon Readiness Audit

**Audit date:** 2026-08-23
**Branch audited:** `feature/person4-realtime` (working tree, including 5 uncommitted files)
**Method:** Read-only forensic inspection. No file was modified, no dependency installed, no
migration run, and **no database state was altered** — the DB-mutating test suites were
deliberately *not* executed (see §17 for how test evidence was obtained instead).

**Evidence labels used throughout:**
`FACT` = directly verified from repository/DB/toolchain during this audit ·
`INFERENCE` = strongly implied but not directly executed ·
`NOT VERIFIED` = insufficient evidence.

> **2026-09-09 update — frontend superseded, backend findings unaffected.** The three
> frontends this audit describes (`frontend/patient`, `frontend/ambulance`, `frontend/hospital`)
> have since been retired in favor of a ground-up rebuild at `frontend-revised/`, which is
> **not yet wired to the backend**. Every finding in this document about the **backend**
> (§2–§10, §16, §19–§20) remains accurate and current. Findings specifically about **frontend
> integration** (§8, §11–§14, §18's frontend columns) describe the retired frontend and are now
> historical — read them as "this is what frontend↔backend integration looked like before the
> rebuild," not as the current state.

---

## 1. Executive Summary

Docsahab is a **functional, end-to-end-wired emergency coordination MVP** whose primary
workflow can be demonstrated today — with two specific operational hazards that will break
a live demo if not handled.

**What is real (FACT):** All five person-modules exist as integrated backend code on one
branch. The three frontends are genuinely wired to the purpose-built endpoints — verified by
tracing 11 distinct endpoint call-sites from UI handlers through to routes. The severity enum
mismatch, invalid-status writes, and fake-ID writes that dominated earlier audits are gone;
the frontend now uses literal-union types that make those classes of bug unrepresentable.

**What is not real (FACT):** Person 4's realtime layer is **backend-only**. Zero frontend has
`socket.io-client` (verified in all three `package.json` files); all three poll every 3s. The
last two lifecycle transitions (`EN_ROUTE_TO_HOSPITAL`, `ARRIVED`) and `CANCELLED` have **no UI
trigger anywhere** — they exist only as read-side display strings.

**The two demo hazards (FACT, newly identified in this audit):**

1. **The Ambulance console binds to an emergency once, on mount, and never rebinds.** It calls
   `getActiveEmergency()` in a `useEffect` with an empty dependency array, then polls that one
   ID forever. If it is opened *before* the demo SOS is triggered, it locks onto whatever was
   previously active and will never show the new emergency without a manual page refresh.
2. **The database currently contains a stale non-terminal emergency that `/emergencies/active`
   will serve.** `ceaaeec1…` sits at `HOSPITAL_NOTIFIED` (created 2026-08-19). Any console
   opened right now binds to a half-finished emergency, not a clean slate.

Neither is a code defect requiring a rewrite; both are handled by demo sequencing plus one
small data cleanup. **Overall hackathon readiness: 7.5/10** — the workflow works, the
demo is reliable *only if run in the correct order*.

---

## 2. Repository & Architecture

### Top-level structure (FACT)

| Path | Classification | Notes |
|---|---|---|
| `backend person 1/` | **ACTIVE** | The only backend. Express 4 + TS, port 3000, `/api/v1`. Git repo lives here. |
| `Front End/{Patient,Ambulance,Hospital} Side/` | **ACTIVE** | Three React/Vite apps, currently wired to the backend. Not under git. |
| `updated frontend/` | **SOURCE ARTIFACT** | The raw Figma export that was copied into `Front End/`. Retained, not built or served. |
| `Front End_BACKUP_2026-08-19/` | **ARCHIVED** | Pre-replacement copy of the old frontend. Dead weight; only rollback value. |
| `Docsahab-Backend person 5/` | **DEPRECATED** | Carries `DEPRECATED.md`. Models were migrated into the active backend. |
| `ambulance-module Person 2/` | **PROTOTYPE (dead)** | Standalone :5000 mock. Superseded. |
| `changes/` | Documentation | 5 audit documents from prior sessions. |
| `docs/` | Documentation | Created by this audit for this report. |

### Runtime architecture (FACT)

One process serves everything. `src/server.ts` creates an `http.Server` from the Express app,
then attaches both event-driven subsystems before listening:

```
src/server.ts:28  registerHospitalEventHandlers()   ← P3 auto hospital-search
src/server.ts:31  initRealtime(server)              ← P4 Socket.IO gateway (same port)
```

Layering is uniform across modules: `routes → validators (Zod) → controllers → services →
repositories (Prisma) → PostgreSQL`. All three route files mount at the same `/api/v1` prefix
(`src/app.ts:66,69,72`).

The cross-module seam is a single Node `EventEmitter` (`emergencyEvents`, exported from
`services/emergency.service.ts`). P1/P2/P3 emit onto it; P3 and P4 are its only consumers.

### Git state (FACT)

- Active branch `feature/person4-realtime`, stacked linearly:
  `main → a03a2d2 (P2) → 7149967 (P3) → 45e2175 (P4) → 714de6b (docs)`.
- **Nothing is merged to `main`.** Four branches exist; `main` still points at the P1+P5
  foundation merge (`bf9070e`).
- **5 files uncommitted (+59 lines)**: the `GET /emergencies/active` feature and a
  hospital-repository include fix. Verified via `git diff`.
- `origin/feature/person4-realtime` exists — the branch has been pushed at least once.

---

## 3. Original Five-Person Plan

Reconstructed from commit history and `MERGE_REPORT.md` (FACT for the mechanics; motives
marked where unverified):

| Person | Planned scope | Outcome |
|---|---|---|
| P1 | Emergency Core Service | Built first; became the frozen foundation and single source of truth |
| P2 | Ambulance Matching | Initially a standalone `:5000` Express mock; **discarded and rebuilt** in-process |
| P3 | Hospital Ranking & Acceptance | Built last against a clarified workflow; required additive state-machine edges |
| P4 | Realtime Synchronization | Built as a pure consumer of the existing event emitter |
| P5 | Patient/Ambulance/Hospital models + seed | Merged into P1's schema; standalone folder deprecated |

---

## 4. Final Implementation Status

| Module | Status |
|---|---|
| Person 1 — Emergency Core | **VERIFIED END-TO-END** |
| Person 2 — Ambulance Matching | **VERIFIED END-TO-END** |
| Person 3 — Hospital Ranking & Acceptance | **VERIFIED END-TO-END** (accept path); reject/reassign/fallback are BACKEND COMPLETE / NOT UI-VERIFIED |
| Person 4 — Realtime | **BACKEND COMPLETE / FRONTEND NOT INTEGRATED** |
| Person 5 — Data Foundation | **VERIFIED END-TO-END** |

---

## 5. Person 1 Audit — Emergency Core

**Status: VERIFIED END-TO-END.**

- **State machine (FACT):** `src/enums/emergency-status.enum.ts` defines 12 statuses and a
  `VALID_TRANSITIONS` map enforced by `isValidTransition()`. Every status write in the codebase
  routes through it.
- **Additive edges for the official workflow (FACT):** three edges were added to support
  hospital selection during transit — `AMBULANCE_EN_ROUTE → HOSPITAL_ACCEPTED` (enum:62),
  `HOSPITAL_ACCEPTED → PATIENT_PICKED_UP` (enum:81), `SEVERITY_SELECTED → HOSPITAL_NOTIFIED`
  (enum:70). **No enum values were changed**, so no migration was required and all pre-existing
  paths remain valid.
- **Timeline (FACT):** every transition writes an immutable `TimelineEvent`
  (`emergency.service.ts:169`). The DB currently holds 96 timeline rows.
- **APIs (FACT):** `POST /sos`, `GET /emergency/:id`, `PATCH /emergency/:id/status`,
  `GET /emergency/:id/timeline`, plus the new `GET /emergencies/active`.
- **Known gap (FACT):** `updateEmergencyStatus` performs update → timeline → refetch as three
  separate awaits, **not** inside a transaction (`emergency.service.ts:163-178`). A minor TOCTOU
  window exists on the generic status path. Not demo-relevant at single-user scale.

## 6. Person 2 Audit — Ambulance Matching

**Status: VERIFIED END-TO-END.**

- **Initial vs final (FACT):** the original standalone `:5000` prototype survives only as dead
  code in `ambulance-module Person 2/`. The final implementation is foundation-native.
- **Selection (FACT):** `selectNearestAmbulance` picks by haversine distance over
  `isAvailable: true` rows; ETA is `distance / speed`, configurable via
  `config/ambulance-matching.config.ts` (default 30 km/h, 1-minute floor).
- **Concurrency (FACT):** `assignAmbulanceAtomically` runs a conditional
  `updateMany({ where: { id, isAvailable: true } })` claim inside `prisma.$transaction`,
  re-validates the emergency inside the transaction, then writes emergency + timeline. The
  service wraps this in a bounded retry (`MAX_ASSIGNMENT_ATTEMPTS = 5`) that falls back to the
  next-nearest unit when a claim is lost. This is the strongest-engineered code in the repo.
- **Frontend integration (FACT):** the Patient app calls `assignAmbulance(created.id)`
  immediately after SOS (`Patient/App.tsx:95`), with a dedicated `NO_AMBULANCE_AVAILABLE`
  branch that keeps the emergency alive and informs the user rather than failing.

## 7. Person 3 Audit — Hospital Ranking & Acceptance

**Status: VERIFIED END-TO-END for the accept path; reject / reassignment / fallback are
BACKEND COMPLETE but NOT UI-VERIFIED.**

Checked directly against the seven authoritative workflow rules:

| Rule | Verdict | Evidence |
|---|---|---|
| 1. Search begins while ambulance is en route | **CONFIRMED** | `hospital.service.ts:939` — auto-search fires on `newStatus === AMBULANCE_EN_ROUTE` |
| 2. Acceptance may occur before pickup | **CONFIRMED** | Additive edge `AMBULANCE_EN_ROUTE → HOSPITAL_ACCEPTED` |
| 3. Pre-pickup assignment is temporary | **CONFIRMED** | Metadata records `temporary: !locked` (`hospital.service.ts:476`) |
| 4. Better-ranked hospital may replace it pre-pickup | **CONFIRMED** | Strict comparison `candidate.rank < assignedCandidate.rank` (`:565`), guarded by conditional `updateMany`, bounded by `MAX_REASSIGNMENT_ATTEMPTS = 3` |
| 5. Assignment locks at `PATIENT_PICKED_UP` | **CONFIRMED** | `hasPatientBeenPickedUp()` derives the lock from the **timeline**, not the status field — correct, because hospital-phase statuses are reachable both before and after pickup |
| 6. Severity selected after pickup | **CONFIRMED** | `PATIENT_PICKED_UP → SEVERITY_SELECTED` is the only outbound edge |
| 7. Notification after severity | **CONFIRMED** | `notifyAssignedHospital` throws `NO_HOSPITAL_ASSIGNED` (`:804`) if no hospital is attached, and recomputes transport ETA |

- **Ranking (FACT):** configurable weights (capability 0.5 / ETA 0.3 / resources 0.2) in
  `config/hospital-ranking.config.ts`, all env-overridable. Filters exclude hospitals with
  0 beds, missing required capabilities, outside radius, or beyond the golden-hour ETA ceiling.
- **Fallback (FACT):** on all-reject, radius expands by a configurable factor up to a max,
  emitting `hospitalSearchExhausted` when the search is exhausted.
- **Frontend integration (FACT):** Hospital console calls `respondToHospitalRequest` for both
  accept and decline (`Hospital/App.tsx:158`), and correctly branches on the response's
  `assignmentChanged` / `locked` flags to show three distinct outcomes.

## 8. Person 4 Audit — Realtime

**Status: BACKEND COMPLETE / FRONTEND NOT INTEGRATED.** This distinction is the single most
important qualification in this report.

- **Realtime server implemented — FACT.** Socket.IO attaches to the same HTTP server
  (`server.ts:31`). Rooms, ack-based subscribe/unsubscribe/sync, snapshot-on-join, and a
  per-emergency monotonic sequence number all exist in `services/realtime.service.ts`.
- **Realtime pipeline implemented — FACT.** The bridge subscribes to **14** domain events
  (verified by counting `on("` registrations) and maps them to stable DTOs, never raw Prisma
  objects.
- **Realtime frontend integrated — FALSE (FACT).** `socket.io-client` appears in **none** of
  the three frontend `package.json` files. A source-wide grep for socket usage returns only
  false positives from `AspectRatio` component names. All three apps use `setInterval` polling:
  `Patient/App.tsx:75`, `Ambulance/App.tsx:47`, `Hospital/App.tsx:72`.

**Consequence:** users receive updates at up to 3s latency via polling. The realtime layer
delivers zero user-visible value today. It is not a demo blocker (polling works), but it must
not be described as "live realtime" during a demo.

## 9. Person 5 Audit — Data Foundation

**Status: VERIFIED END-TO-END.**

- **Schema (FACT):** 6 models, 3 enums, `prisma validate` passes.
- **Migrations (FACT):** 2 migrations, `migrate status` reports "Database schema is up to date"
  — zero drift.
- **Seed integrity (FACT, live query):** 5 patients, 10 ambulances, 10 hospitals — exactly as
  `prisma/seed.ts` defines. Stable IDs (`patient-arjun-001`, `amb-001…010`, `hosp-001…010`) are
  intact, which matters because the frontends pin real IDs.
- **Relations:** 6 foreign keys with deliberate delete behaviour (Restrict on Patient/Hospital,
  SetNull on assignments, Cascade on Timeline/Candidate).

---

## 10. API / Execution-Chain Verification

Each row traced from UI handler → client function → route → controller → service → repository.

| Action | Caller | Endpoint | Handler chain | Result |
|---|---|---|---|---|
| Patient SOS | `HomeScreen` → `handleSos` (`Patient/App.tsx:85`) | `POST /sos` | controller → service → repo, writes emergency + timeline, emits `emergencyCreated` | **WORKS** |
| Ambulance assignment | same handler, immediately after (`:95`) | `POST /emergency/:id/assign-ambulance` | atomic claim + retry | **WORKS** |
| Ambulance en route | "START — EN ROUTE" (`ScreenEnRoute.tsx:162`) | `PATCH /status {AMBULANCE_EN_ROUTE}` | validated transition + timeline; **triggers P3 auto-search** | **WORKS** |
| Hospital search | *automatic* — no UI caller | none (event-driven) | `registerHospitalEventHandlers` → `startHospitalSearch` | **WORKS (automatic)** |
| Hospital ranking | automatic | none | `rankHospitals` pure function | **WORKS** |
| Hospital acceptance | "Accept Patient" (`ActionPanel`) | `POST /emergency/:id/hospital-response` | atomic claim + candidate update + timeline | **WORKS** |
| Hospital rejection | "Unable to Accept" | same endpoint, `response: "REJECTED"` | candidate update + fallback trigger | **WIRED, NOT UI-VERIFIED** |
| Hospital reassignment | automatic on late better-ranked accept | same endpoint | `reassignHospitalAtomically` | **WIRED, NOT UI-VERIFIED** |
| Patient pickup | "PATIENT PICKED UP" (`ScreenEnRoute.tsx:179`) | `PATCH /status {PATIENT_PICKED_UP}` | guarded by `canPickUp` covering both `AMBULANCE_EN_ROUTE` and `HOSPITAL_ACCEPTED` | **WORKS** |
| Hospital locking | automatic on pickup | none | `hasPatientBeenPickedUp()` timeline probe | **WORKS** |
| Severity selection | RED/YELLOW/GREEN buttons | `PATCH /status {SEVERITY_SELECTED, severity}` | `severityToBackend()` converts UI→enum | **WORKS** |
| Hospital notification | "NOTIFY HOSPITAL" | `POST /emergency/:id/notify-hospital` | guard + ETA recompute + status advance | **WORKS** |
| En route to hospital | **NO CALLER** | — | — | **NO UI TRIGGER** |
| Arrival | **NO CALLER** | — | — | **NO UI TRIGGER** |
| Cancellation | **NO CALLER** | — | — | **NO UI TRIGGER** |

**Dead client surface (FACT):** `findHospitals`, `listAmbulances`, `getTimeline`, and
`healthCheck` are exported from `api.ts` but have **0 call-sites** in any `.tsx`. Harmless, but
they are unused API surface, not working features.

---

## 11. Actual End-to-End Workflow

The implemented path, in the order it actually executes:

```
SOS_TRIGGERED          Patient taps SOS                    manual   ✅
AMBULANCE_ASSIGNED     same tap, second call               manual   ✅
AMBULANCE_EN_ROUTE     Ambulance crew taps START           manual   ✅
  └─ hospital search + ranking + candidates fire AUTOMATICALLY off this transition
HOSPITAL_ACCEPTED      Hospital console taps Accept        manual   ✅   (pre-pickup = temporary)
PATIENT_PICKED_UP      Ambulance taps PICKED UP            manual   ✅   (assignment locks here)
SEVERITY_SELECTED      Ambulance taps RED/YELLOW/GREEN     manual   ✅
HOSPITAL_NOTIFIED      Ambulance taps NOTIFY HOSPITAL      manual   ✅
EN_ROUTE_TO_HOSPITAL   ————— no UI trigger —————                    ❌
ARRIVED                ————— no UI trigger —————                    ❌
CANCELLED              ————— no UI trigger —————                    ❌
```

**Unreachable-from-UI states (FACT):** the final three. `EN_ROUTE_TO_HOSPITAL` and `ARRIVED`
appear in frontend code only as *display* strings (`Ambulance/App.tsx:24-25` in the ONBOARD
set, `SosActiveScreen.tsx:131` as a stepper label) — never as a write.

**Frontend/backend assumption alignment (FACT):** the Ambulance app's `ONBOARD` set correctly
**excludes** `HOSPITAL_ACCEPTED`, because under the official workflow that status can occur
while the patient is still *not* onboard. This is a subtle correctness win, not an oversight.

---

## 12. Demo Path Reconstruction

### A. Intended demo path
Patient triggers SOS → ambulance auto-assigned → crew dispatches → hospitals ranked and
requested automatically → hospital accepts → patient picked up → severity set → hospital
notified. Three browser windows, one continuous story.

### B. Current demo path (what the repo can actually do today)
**All eight steps above work.** The chain is complete and each step persists correctly.

### C. Failure points (FACT — both newly identified in this audit)

1. **Ambulance console stale-binding.** `getActiveEmergency()` runs in a `useEffect` with `[]`
   dependencies (`Ambulance/App.tsx:37-42`); the polling effect then tracks only that resolved
   `emergencyId`. **If the Ambulance window is open before the demo SOS is fired, it will never
   see the new emergency.** Mitigation is purely operational: refresh the Ambulance window after
   triggering SOS.
2. **Stale active emergency in the database.** A live query confirms `/emergencies/active` will
   currently return `ceaaeec1…` at `HOSPITAL_NOTIFIED` (created 2026-08-19). Any console opened
   now inherits a half-finished emergency.
3. **Hospital console shows an empty queue for a stale emergency.** Because the console filters
   to `PENDING` candidates for `hosp-001`, and both stale emergencies already have `hosp-001`
   marked `ACCEPTED`, the queue reads "No incoming requests" — correct behaviour, but visually
   indistinguishable from a broken backend during a demo.

### D. Minimum fix set (smallest change that makes the demo reliable)

1. **Clear or terminate the two stale non-terminal emergencies** so the system starts idle.
   *(Data operation, not code.)*
2. **Refresh the Ambulance console after SOS** — or, if a code fix is preferred, have the
   Ambulance app re-poll `getActiveEmergency()` when it currently holds no emergency or holds a
   terminal one. Operational workaround is sufficient for a hackathon.
3. Everything else already works.

### E. Required setup (do not conceal)

- PostgreSQL running at `localhost:5432`, database `docsahab`.
- Backend started with env vars inline (tsx does not auto-load `.env`):
  `DATABASE_URL=… PORT=3000 NODE_ENV=development node_modules/.bin/tsx src/server.ts`
- Three Vite dev servers, one per app.
- Seed data must be present (currently is — 5/10/10 verified).
- **Demo window order matters:** trigger SOS *first*, then open/refresh the Ambulance console.

---

## 13. Initial Approach vs Final Implementation

| Area | Initial | Final | Evidence |
|---|---|---|---|
| P5 entities | Standalone backend with its own `Emergency` + 7-state enum | Models merged into P1's schema; P5's emergency model and `POST /sos` discarded | `MERGE_REPORT.md` §2; `DEPRECATED.md` |
| P2 | Standalone `:5000` Express mock with invented per-ambulance status enum | In-process module reusing P1's repo/events/enum; only `haversine` salvaged | Commit `a03a2d2`; dead prototype folder |
| P3 workflow timing | Docs described hospital search *after* severity selection | Search moved to *during transit*, via 3 additive transition edges | `emergency-status.enum.ts:41-50` comments; `hospital.service.ts:939` |
| Hospital rejection | Frontend attempted a `HOSPITAL_REJECTED` **status** | Rejection modeled on `HospitalCandidate.response`; no such status exists | `hospital.validator.ts`; schema enum |
| Frontend contract | Loose `string` types; invalid statuses/IDs shipped silently | Literal-union types mirroring Prisma enums | `api.ts:26-42` |
| Frontend bootstrap | Committed `active-emergency.json` with a hardcoded UUID | `GET /emergencies/active` endpoint | `emergency.routes.ts:32`; file now unreferenced |
| Realtime | Planned Socket.IO consumption by frontends | Backend gateway built; frontends still poll | No `socket.io-client` in any app |

Reasons are recorded in commit messages and code comments where stated; where a motive is not
documented it is marked **NOT VERIFIED FROM REPOSITORY** rather than inferred.

---

## 14. Frontend Audit

All three apps share a byte-identical `api.ts` (331 lines, verified identical by `diff`).

### Patient app
- **Connected:** SOS creation, ambulance assignment, active-emergency rehydration, 3s polling.
- **Working actions:** SOS button (creates + dispatches), profile navigation.
- **Stepper (FACT):** derived from `timelineEvents`, not a hardcoded status index — this fixes
  the class of bug where the old index-based stepper regressed to "all pending" on the
  early-acceptance path.
- **Hardcoded:** the `PATIENT` constant (`App.tsx:24-36`) pins `patient-arjun-001` and fixed
  Connaught Place coordinates. Deliberate — there is no auth layer.
- **Mismatches found:** none.

### Ambulance app
- **Connected:** active-emergency discovery, polling, en-route, pickup, severity, notify.
- **Working actions:** all four write actions reach purpose-built or correctly-validated endpoints.
- **Guards (FACT):** "START — EN ROUTE" renders only when status is `AMBULANCE_ASSIGNED`;
  "PATIENT PICKED UP" is disabled unless status is `AMBULANCE_EN_ROUTE` or `HOSPITAL_ACCEPTED`;
  "NOTIFY HOSPITAL" is disabled unless both severity and an assigned hospital exist.
- **Defect (FACT):** the mount-once binding described in §12.C.1.
- **Not implemented:** en-route-to-hospital, arrival, cancellation.

### Hospital app
- **Connected:** real ranked queue via `getHospitalRequests`, accept/decline via
  `respondToHospitalRequest`, real timeline, real required-services.
- **Working actions:** Accept (UI-verified previously), Decline (wired, not UI-verified).
- **Correct nuance (FACT):** the accepted-cases list is kept as a **snapshot** rather than
  derived from the pending queue — necessary, because an accepted request immediately leaves the
  `PENDING` inbox and would otherwise vanish from the UI on success.
- **Hardcoded:** `HOSPITAL_ID = "hosp-001"` (`App.tsx:21`) — a *real seeded ID*, which matters
  because acceptance writes a genuine foreign key.
- **Still mocked (FACT):** the preparation checklist (`App.tsx:26-32`) is local UI state, never
  persisted. The 57-second `ResponseTimer` has no backend deadline behind it.
- **Removed, not replaced:** patient vitals. No vitals model exists in the schema, so the panel
  was removed rather than fabricated.

---

## 15. Realtime Audit

| Layer | Status |
|---|---|
| Realtime server implemented | ✅ **FACT** — `initRealtime(server)` at `server.ts:31` |
| Event bridge implemented | ✅ **FACT** — 14 domain events bridged |
| Rooms / DTOs / snapshot / ordering | ✅ **FACT** — implemented in `realtime.service.ts` |
| Client connection | ❌ **FACT** — no `socket.io-client` in any frontend |
| Screens receiving realtime updates | **None** |
| Screens depending on polling | **All** (3s interval in each app) |

**Remaining migration work:** add `socket.io-client`, subscribe each app to its room
(`emergency:{id}`, `ambulance:{id}`, `hospital:{id}`), apply `emergency:snapshot` on join, drop
the three `setInterval` blocks. Not required for the demo.

---

## 16. Database / Data State

**Live counts (FACT, read-only query):**
`patients=5, ambulances=10, hospitals=10, emergencies=10, timelineEvents=96, hospitalCandidates=24`

**Emergencies by status:** `ARRIVED=8`, `HOSPITAL_NOTIFIED=1`, `HOSPITAL_ACCEPTED=1`.

**Findings:**

1. **Stale active emergencies (HIGH, demo-affecting).** Two non-terminal rows exist.
   `/emergencies/active` orders by `createdAt DESC`, so it serves `ceaaeec1…`
   (`HOSPITAL_NOTIFIED`, 2026-08-19). The older `5d7f1fea…` (`HOSPITAL_ACCEPTED`, 2026-07-02)
   is orphaned test residue.
2. **Ambulance availability inconsistency (MEDIUM, data integrity).** Both non-terminal
   emergencies hold an ambulance (`amb-001`, `amb-002`) while **both units are marked
   `isAvailable: true`**. Root cause (INFERENCE, strongly supported): `test-ambulance.ts`'s
   cleanup resets *every* ambulance to available, including units held by emergencies it did not
   create. Consequence: the same ambulance can be assigned to a second emergency.
3. **Accumulating test data (LOW).** `test-e2e.js` is **not self-cleaning** (verified — no
   delete/cleanup calls); each run leaves one `ARRIVED` emergency. The 8 `ARRIVED` rows are
   consistent with repeated runs.
4. **`Front End/active-emergency.json` still exists on disk but is referenced by no frontend**
   (verified by grep) — the stale-bootstrap problem from earlier audits is genuinely resolved.

---

## 17. Tests & Verification

**Constraint:** the suites mutate the database, and this audit was forbidden from altering DB
state. They were therefore **not executed**. Counts below were obtained by static analysis and
reconciled against runs observed earlier in the same working session.

| Suite | Static call-sites | Runtime count | Reconciliation |
|---|---|---|---|
| `test-e2e.js` | 52 `log()` | **52** | exact match |
| `test-ambulance.ts` | 24 `ok()` − 2 inside `expectCode` = 22, + 5 `expectCode` invocations | **27** | exact match |
| `test-hospital.ts` | 78 `ok()` − 2 inside `expectCode` = 76, + 6 `expectCode` invocations | **82** | exact match |
| `test-realtime.ts` | 49 `ok()`, no helper indirection | **49** | exact match |
| **Total** | | **210** | |

This is the important part: the documented "210/210" figure is **not merely a documentation
claim** — the assertion call-sites reconcile arithmetically to exactly those counts, which is
independent corroboration that does not require running anything.

**Classification:**
- **TEST VERIFIED (static):** assertion inventory above; `tsc --noEmit` exit 0;
  `prisma validate` passes; `prisma migrate status` reports no drift — all re-run during this audit.
- **MANUALLY VERIFIED (earlier this session, not re-run now):** the browser-driven walkthrough of
  SOS → HOSPITAL_NOTIFIED across all three apps.
- **CLAIMED BUT NOT RE-VERIFIED IN THIS AUDIT:** live pass/fail of the four suites.
- **NOT VERIFIED:** hospital decline, dynamic reassignment, and fallback-radius expansion
  *through the UI*. Backend coverage for these exists inside `test-hospital.ts`; UI coverage
  does not.
- **No frontend tests exist at all** (FACT) — no test runner is configured in any app.

---

## 18. Feature Verification Matrix

| Feature | Backend | DB | Frontend | Realtime | Tests | End-to-End | Status | Evidence |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|---|
| SOS / emergency creation | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `POST /sos`; `Patient/App.tsx:90` |
| Ambulance assignment | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `assign-ambulance`; `App.tsx:95` |
| Ambulance en route | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `ScreenEnRoute.tsx:162` |
| Hospital discovery | ✅ | ✅ | ➖ | ➖ | ✅ | ✅ | Automatic | `hospital.service.ts:939` |
| Hospital ranking | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | ranking config + console queue |
| Hospital acceptance | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `hospital-response`; UI-verified |
| Hospital rejection | ✅ | ✅ | ✅ | ➖ | ✅ | ⚠️ | Wired, not UI-verified | `Hospital/App.tsx:161` |
| Hospital reassignment | ✅ | ✅ | ➖ | ➖ | ✅ | ⚠️ | Backend-only path | `hospital.service.ts:565` |
| Patient pickup | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `ScreenEnRoute.tsx:179` |
| Hospital locking | ✅ | ✅ | ➖ | ➖ | ✅ | ✅ | Automatic | `hasPatientBeenPickedUp()` |
| Severity selection | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `severityToBackend()` |
| Hospital notification | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ | Working | `notify-hospital` |
| En route to hospital | ✅ | ✅ | ❌ | ➖ | ✅ | ❌ | No UI trigger | grep: display-only |
| Arrival | ✅ | ✅ | ❌ | ➖ | ✅ | ❌ | No UI trigger | grep: display-only |
| Cancellation | ✅ | ✅ | ❌ | ➖ | ⚠️ | ❌ | No UI anywhere | grep: zero matches |
| Patient live updates | ✅ | ✅ | ✅ | ❌ | ➖ | ⚠️ | Polling only | `setInterval` 3s |
| Ambulance live updates | ✅ | ✅ | ⚠️ | ❌ | ➖ | ⚠️ | Polling + stale-bind defect | `App.tsx:37-55` |
| Hospital live updates | ✅ | ✅ | ✅ | ❌ | ➖ | ⚠️ | Polling only | `App.tsx:72` |
| Realtime synchronization | ✅ | ➖ | ❌ | ❌ | ✅ | ❌ | Backend-only | no client dependency |

---

## 19. Hackathon Scope

**A. Required for the demo:** stale-data cleanup; correct demo window ordering (or the
Ambulance rebinding fix). Nothing else.

**B. Nice-to-have:** UI triggers for `EN_ROUTE_TO_HOSPITAL` and `ARRIVED` (lets the story finish
on screen instead of stopping at "notified"); UI-verifying the decline path.

**C. Post-hackathon / production:** authentication and identity; Socket.IO frontend migration;
Prisma error mapping (`P2003` → 400); real GPS and road-network ETA; vitals model; multi-hospital
console identity; observability; merging four branches to `main`.

Authentication, real GPS, and production routing are **explicitly not hackathon blockers** —
they do not affect the demo path.

---

## 20. Current Problems

| # | Issue | Severity | Impact | Evidence |
|---|---|---|---|---|
| 1 | Ambulance console binds to an emergency once on mount and never rebinds | **HIGH** | **HACKATHON BLOCKER** if windows are opened in the wrong order | `Ambulance/App.tsx:37-42` (`useEffect` deps `[]`) |
| 2 | Stale non-terminal emergency is what `/emergencies/active` serves | **HIGH** | **DEMO ISSUE** — consoles open mid-flow | live DB query; `ceaaeec1…` @ `HOSPITAL_NOTIFIED` |
| 3 | `EN_ROUTE_TO_HOSPITAL` / `ARRIVED` have no UI trigger | **MEDIUM** | DEMO ISSUE — story cannot be finished on screen | grep: display-only references |
| 4 | Ambulances held by active emergencies are marked available | **MEDIUM** | TECHNICAL DEBT / data integrity | live query: `amb-001`, `amb-002` |
| 5 | Realtime unused by all frontends | **MEDIUM** | TECHNICAL DEBT — do not claim "realtime" in the pitch | no `socket.io-client` anywhere |
| 6 | Prisma errors surface as raw 500s | **MEDIUM** | TECHNICAL DEBT | no `P2003`/`P2025` branch in `error-handler.middleware.ts` |
| 7 | Backend changes uncommitted; 4 branches unmerged | **MEDIUM** | PRODUCTION CONCERN — work is loseable | `git status`, `git branch` |
| 8 | `test-e2e.js` not self-cleaning | **LOW** | TECHNICAL DEBT | no cleanup calls; 8 `ARRIVED` rows |
| 9 | Frontend has no git tracking; only a manual backup folder | **LOW** | PRODUCTION CONCERN | `Front End/` untracked |
| 10 | `CANCELLED` unreachable from any UI | **LOW** | TECHNICAL DEBT | grep: zero matches |
| 11 | Unused client functions (`findHospitals`, `listAmbulances`, `getTimeline`, `healthCheck`) | **LOW** | TECHNICAL DEBT | 0 `.tsx` call-sites |
| 12 | Hospital checklist / response timer are non-persistent UI theatre | **LOW** | DEMO ISSUE if inspected closely | `Hospital/App.tsx:26-32,48` |

---

## 21. MUST DO Before Demo

Ordered by dependency, then demo impact.

1. **Terminate or delete the two stale non-terminal emergencies** so the system starts idle and
   `/emergencies/active` returns null. *(Data-only; no code change.)*
2. **Establish the demo run order:** start backend → confirm idle → open Patient → trigger SOS →
   **then** open/refresh Ambulance console → open Hospital console. Rehearse it once end-to-end.
3. *(Optional, converts hazard #1 into a non-issue)* make the Ambulance app re-check
   `getActiveEmergency()` when it holds no emergency or a terminal one, instead of binding only
   on mount.

Nothing else is required. The workflow itself is functional.

## 22. SHOULD DO If Time Remains

1. Add UI triggers for `EN_ROUTE_TO_HOSPITAL` and `ARRIVED` so the demo can finish at "Arrived"
   rather than stopping at "Hospital notified."
2. Click through the hospital **decline** path once to convert it from wired-but-unverified to
   verified.
3. Map Prisma `P2003` → 400 / `P2025` → 404 so bad input degrades cleanly on stage.
4. Commit the working tree and consider merging the branch stack.

## 23. Post-Hackathon Roadmap

Authentication and role identity → Socket.IO frontend migration (removing all polling) →
multi-hospital console identity → real GPS/road-network ETA → vitals model if clinically
required → observability and structured logging → merge branches, add CI, add frontend tests →
delete `Front End_BACKUP_2026-08-19/`, `updated frontend/`, and the two dead module folders.

---

## 24. Readiness Scores

| Area | Score | Justification |
|---|:--:|---|
| Backend | **9/10** | All five modules integrated in one process; strict layering; genuine transactional concurrency control; typechecks clean; zero schema drift. −1 for the non-transactional generic status path and unmapped Prisma errors. |
| Frontend | **8/10** | All three apps genuinely wired to purpose-built endpoints with literal-union types and correct action guards. −2 for the mount-once binding defect and three missing lifecycle triggers. |
| Database | **8/10** | Schema, migrations, FKs, indexes and seed all verified intact. −2 for stale non-terminal rows and the ambulance-availability inconsistency. |
| Realtime | **4/10** | Server, bridge, rooms, DTOs and snapshots all implemented and tested — but **zero users receive realtime data**. Implemented ≠ integrated. |
| Integration | **8/10** | P1/P2/P3 fully reachable from the UI; the hospital candidate workflow drives a real console. −2 because P4 is entirely unintegrated. |
| Testing | **7/10** | 210 backend assertions statically corroborated, covering concurrency, transactions and rollback. −3 for zero frontend tests and three UI paths never exercised. |
| Demo Readiness | **7/10** | The full intended story works today — but only if run in a specific window order, from a cleaned database. |

### OVERALL HACKATHON READINESS: **7.5 / 10**

The primary user workflow is genuinely functional end-to-end, which is the thing that matters
most. The score is held below 8 by two operational hazards that will bite during a live demo if
unaddressed, and by a realtime layer that exists but delivers nothing to users.

---

## 25. Executive Decision

**1. What has Docsahab actually built today?**
A working emergency-coordination MVP: one Express/Prisma backend containing five integrated
modules, a PostgreSQL schema with 6 models and real foreign keys, and three React consoles wired
to purpose-built endpoints. A patient SOS genuinely flows through ambulance dispatch, automatic
hospital ranking, hospital acceptance, pickup, triage and hospital notification.

**2. How much of the five-person plan is complete?**
Four of five modules are complete and integrated (P1, P2, P3, P5). P4 is complete on the backend
and unintegrated on the frontend. By demo-visible capability: roughly 85%.

**3. What changed from the original architecture?**
P5's standalone backend was absorbed and deprecated. P2 was rebuilt from a standalone mock into
an in-process module. P3's hospital search moved from *after severity* to *during ambulance
transit*, requiring three additive state-machine edges. The frontend's bootstrap moved from a
committed JSON file to a real `/emergencies/active` endpoint.

**4. What is integrated versus isolated?**
Integrated: Emergency Core, Ambulance Matching, Hospital Ranking & Acceptance, Data Foundation.
Isolated: the entire realtime layer — running, tested, and consumed by nobody.

**5. What still does not work?**
The final three lifecycle transitions have no UI trigger. Realtime reaches no user. Hospital
decline, dynamic reassignment and fallback search are backend-verified but never exercised
through a browser.

**6. What is intentionally out of scope?**
Authentication, real GPS, production routing, patient vitals, multi-hospital identity, and
production hardening. These are deliberate MVP boundaries, not defects.

**7. What MUST be fixed before the demo?**
Clear the stale non-terminal emergencies, and either fix the Ambulance app's mount-once binding
or enforce the window-open order. That is the complete blocking set.

**8. What can safely wait?**
Everything else — realtime migration, auth, error mapping, branch merges, cleanup of dead
folders.

**9. What does a new teammate need to know immediately?**
The backend runs on `feature/person4-realtime` with five uncommitted files; `main` is far behind.
The frontends are not under git — their only backup is a manual folder copy. Severity is
`RED/YELLOW/GREEN` in the backend and converted at the UI edge. Hospital rejection is a
*candidate response*, never an emergency status. And the demo must be run in the correct window
order.

**10. If coding stopped today, what could the team demonstrate?**
A complete, live, three-console emergency response: SOS → automatic nearest-ambulance dispatch →
crew dispatch → automatic hospital ranking → hospital acceptance from a real console → patient
pickup with assignment locking → triage → hospital notification with a recomputed ETA. Every step
persists to PostgreSQL with a full immutable audit trail visible in the hospital console.

**11. What is the single biggest blocker?**
The Ambulance console's mount-once emergency binding — because it fails *silently* and looks
exactly like a broken backend on stage.

**12. What is the smallest path from current state to demo-ready?**
Clear two database rows, rehearse the window order once. Optionally, one small `useEffect`
change in the Ambulance app removes the ordering constraint entirely. The system is
approximately one hour of careful preparation away from a reliable demo.

---

*Audit produced read-only. No application file, schema, migration, test, configuration, or
database record was modified in the course of this audit.*
