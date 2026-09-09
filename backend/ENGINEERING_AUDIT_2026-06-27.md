# ENGINEERING AUDIT

**Date:** 2026-06-27

**Repository Version**
- Main Branch: `bf9070e6cff1cff0b16156cd04a2b38ff79d2146` (`bf9070e`) — "Merge: Person 1 + Person 5 backend foundation integration"
- Active Feature Branches:
  - `feature/person2-ambulance-matching`: `a03a2d24353222774a68453c0a1076a276674a40` (`a03a2d2`) — "feat(person2): foundation-native Ambulance Matching module"
  - `merge/person5-entities-integration`: `ffb997d5514251f6f033f7ff1377ff561250620b` (`ffb997d`) — "chore: remove obsolete prisma migration dump" (now merged into `main`)

## Purpose

This document is a point-in-time engineering audit of the Docsahab repository at the moment of migration from the original Claude Code workspace to a new Claude Pro workspace.

It is intended as a historical engineering snapshot.

Unlike `CLAUDE.md` and `DOCSAHAB_MASTER_CONTEXT.md`, this document is **not** a living specification and should not be continuously updated.

Future engineering audits should be created as new dated files rather than replacing this one.

---

This is the permanent sign-off audit. Everything below is anchored to code, tests, and state directly verified during the engagement (live DB checks, `test-e2e.js` 52/52, `test-ambulance.ts` 27/27, FK tests 23/23, full source read of all modules and frontends, confirmed absence of any Person 3/Person 4 folder or `socket.io` reference).

---

# DOCSAHAB — PERMANENT ENGINEERING AUDIT & SIGN-OFF

*Principal-Engineer technical due diligence. Objective. Evidence-based. Date: 2026-06-27.*

**Definitions used throughout:** **Implemented** = code exists & runs. **Integrated** = wired into the live system & actually used. **Tested** = covered by automated tests. **Production-Ready** = implemented + integrated + tested + acceptable error/security/scale posture.

---

## 1. Executive Summary

| Metric | % | Confidence | Evidence / Justification |
|--------|--:|------------|--------------------------|
| **Overall Project** | **52%** | High | Response+transport half built & tested; hospital + realtime half absent; UI integration partly broken. |
| Backend | 62% | High | P1+P2+P5 complete (3 of 5 backend areas); P3 & P4 ≈5% each (hooks only). Weighted by scope. |
| Frontend | 55% | Medium | 3 polished UI shells (~80% visual) but functional integration ~45% (reads work, key writes 400). Judgment component → Medium. |
| Database | 98% | High | 6 models, 6 FKs, indexes, 2 migrations applied, zero drift, seed verified live this session. |
| Integration | 45% | High | P1↔P5 & P1↔P2 complete + tested; FE↔BE partial/broken; P3/P4 missing. |
| Testing | 35% | High | Backend modules strongly tested (79 assertions across 2 suites); 0 frontend tests, no P3/P4 to test, no framework/CI/coverage. |
| **MVP Readiness** | **50%** | Medium | Backend can complete SOS→ARRIVED when driven correctly; UI cannot (P3 missing + 3 contract bugs). |
| **Production Readiness** | **15%** | High | No auth, no realtime, no CI/CD, no deployment, no monitoring, half the workflow missing. |

**Overall Engineering Score: 6.5 / 10.** What exists is genuinely senior-grade (clean layering, real transactions, race-safety, strong tests) — but ~half the product is unbuilt and the frontend integration is broken, which caps the score. This is an **excellent foundation, a half-finished product.**

---

## 2. Person-wise Engineering Audit

### Person 1 — Emergency Core Service
- **Completion:** Implemented **100%** · Integrated **100%** · Tested **~85%** · Production-Ready **~75%**.
- **Completed:** Emergency model; 12-state machine + `VALID_TRANSITIONS` + `isValidTransition`; timeline; `POST /sos`, `GET /emergency/:id`, `PATCH /status`, `GET /timeline`, `/health`; Zod validation; `AppError` + global handler; standardized response envelope; `emergencyEvents` seam; Prisma singleton.
- **Remaining:** auth, list/pagination endpoints, CANCELLED UI path, FK-violation→400 mapping. (Cross-cutting, not strictly P1.)
- **Code Quality: 9/10** — textbook layering, single responsibility, the state machine is the spine of the system. −1: generic `PATCH /status` isn't transactional (minor TOCTOU).
- **Risks:** current — none material. Future — becomes a bottleneck if not given pagination + the events get a real consumer.
- **Dependencies:** depends on P5 (models). **Everything depends on P1** (source of truth).

### Person 2 — Ambulance Matching
- **Completion:** Implemented **100%** · Integrated **90%** (in-process; no UI calls it yet) · Tested **~90%** · Production-Ready **~70%**.
- **Completed:** real Ambulance model use; haversine nearest selection; configurable ETA; **atomic assignment transaction** (conditional claim) + **bounded retry**; events `ambulanceAssigned`/`etaUpdated`/`statusChanged`; `POST /emergency/:id/assign-ambulance`, `GET /ambulances`.
- **Remaining:** `AMBULANCE_EN_ROUTE` dispatch step; real routing/GPS ETA; a caller (UI/dispatcher); **merge to `main`** (still on `feature/person2-ambulance-matching`, `a03a2d2`).
- **Code Quality: 8.5/10** — the concurrency design is the best-engineered code in the repo. −1.5: straight-line ETA; not yet invoked by any client.
- **Risks:** current — unmerged branch could rot. Future — haversine ETA misleads dispatch at scale.
- **Dependencies:** depends on P1 (repo/events/enum) + P5 (Ambulance). Future ambulance UI depends on it.

### Person 3 — Hospital Ranking & Acceptance
- **Completion:** Implemented **~5%** · Integrated **0%** · Tested **0%** · Production-Ready **0%**.
- **Completed:** only DB hooks — `Hospital` + `HospitalCandidate` models, and 3 `emergency.repository` helpers (`addHospitalCandidates`, `updateHospitalCandidateResponse`, `findHospitalCandidates`).
- **Remaining:** **everything** — search, ranking (capability+distance+beds), candidate generation, `HOSPITAL_SEARCHING`/`HOSPITAL_ACCEPTANCE_REQUESTED`/`HOSPITAL_ACCEPTED` orchestration, accept/reject endpoints, retry-on-all-reject, tests.
- **Code Quality: N/A** (no code). Hooks quality: 7/10.
- **Risks:** **Critical** — its absence makes half the product non-functional; the hospital UI 400s without it.
- **Dependencies:** depends on P1 + P5. **The hospital frontend and the entire back half of the lifecycle depend on it.**

### Person 4 — Realtime
- **Completion:** Implemented **~5%** · Integrated **0%** · Tested **0%** · Production-Ready **0%**.
- **Completed:** only the `emergencyEvents` emitter exists (and it's correctly emitted into by P1/P2). No `socket.io` anywhere.
- **Remaining:** Socket.IO server, per-emergency rooms, broadcasting, reconnection, FE socket migration, multi-instance adapter.
- **Code Quality: N/A.** The seam design (emitter) is good: 8/10 as a design.
- **Risks:** **High** — every frontend compensates with 3s polling (won't scale; not truly "realtime" for a golden-hour product).
- **Dependencies:** depends on the event surface (exists). Frontends’ live UX depends on it.

### Person 5 — Data Foundation
- **Completion:** Implemented **100%** · Integrated **100%** · Tested **~80%** (via FK/relationship tests + E2E) · Production-Ready **~90%**.
- **Completed:** Patient/Ambulance/Hospital models, seed (5/10/10), migrated into P1 with FKs; standalone folder deprecated.
- **Remaining:** none for MVP. (Production: real data sources vs seed.)
- **Code Quality: 8/10** — clean schema, good indexes, idempotent seed. −2: the original standalone backend had to be discarded (rework cost).
- **Risks:** low. Future — schema is solid enough to carry P3/P4 unchanged.
- **Dependencies:** none. **P1/P2/P3 all depend on it.**

---

## 3. Module-wise Audit

| Module | Impl % | Integ % | Tested % | Prod % | State | Quality |
|--------|--:|--:|--:|--:|-------|:------:|
| **Emergency Core** | 100 | 100 | 85 | 75 | Complete, tested, frozen on `main` | 9 |
| **Ambulance Matching** | 100 | 90 | 90 | 70 | Complete on feature branch, unmerged | 8.5 |
| **Hospital Ranking** | 5 | 0 | 0 | 0 | Hooks only | N/A |
| **Hospital Acceptance** | 5 | 0 | 0 | 0 | `HospitalCandidate` schema only | N/A |
| **Realtime** | 5 | 0 | 0 | 0 | Emitter seam only; FE polls | N/A |
| **Patient Module (BE)** | 100 | 100 | 70 | 75 | Patient model + denormalized profile | 8 |
| **Hospital Module (BE)** | 30 | 20 | 0 | 0 | Model+candidate exist; no service | 4 |
| **Ambulance Module (BE)** | 100 | 90 | 90 | 70 | = Ambulance Matching | 8.5 |
| **Database** | 100 | 100 | 80 | 90 | 6 models/6 FKs/2 migrations, no drift | 8.5 |
| **API Layer** | 70 | 60 | 80 | 70 | 6 endpoints; emergency+ambulance only | 8 |
| **Validation** | 90 | 90 | 80 | 80 | Zod everywhere on inbound | 8.5 |
| **Testing** | 40 | — | — | 30 | 2 strong backend suites; no FE/CI | 5 |
| **Architecture** | 90 | 90 | — | 80 | Modular monolith, layered | 8.5 |
| **Frontend** | 80 | 45 | 0 | 30 | 3 shells; integration partial/broken | 6 |
| **Deployment** | 5 | 0 | 0 | 0 | Local dev only; no Docker/CI/cloud | 1 |
| **Security** | 20 | — | 0 | 10 | Zod+helmet only; no auth | 3 |
| **Documentation** | 95 | — | — | 90 | CLAUDE.md + MASTER_CONTEXT + MERGE_REPORT | 9.5 |

**Known bugs / debt / risks per module** are consolidated in §5, §7, §13 to avoid duplication.

---

## 4. Working Features (verified)

**Backend**
- SOS creation (`POST /sos`) with profile denormalization + auto `criticalAlert`.
- Full 12-state machine with rejection of illegal transitions (clear 400 listing valid next states).
- Immutable timeline auto-written on every transition.
- Nearest available ambulance assignment, atomic + race-safe, with ETA + ambulance `isAvailable` flip.
- Ambulance discovery list endpoint.
- Event emission on all lifecycle writes.
- Standardized success/error envelope; global error handler; health check; graceful shutdown.

**Database**
- All 6 tables, 6 FKs (correct cascade/restrict/set-null), indexes, idempotent seed; zero schema drift.

**API**
- 6 endpoints functioning with Zod validation and consistent contracts.

**Integration**
- P1↔P5 (FK-backed relations resolve), P1↔P2 (in-process reuse of repo/events/enum), FE reads (all 3 apps render live emergency via polling).

**Testing**
- `test-e2e.js` 52/52 (full lifecycle + validation + invalid-transition + 404/400 + terminal-state).
- `test-ambulance.ts` 27/27 (selection, ETA, transactions, events, error paths, **5-way concurrency → 5 distinct units, zero double-assignment**).

**Frontend**
- Patient SOS create; all three apps load + poll + render emergency data and patient profile.

---

## 5. Broken Features

| Feature | Expected | Current | Root Cause | Impact | Priority | Fix |
|---------|----------|---------|------------|--------|:--------:|-----|
| Ambulance severity select | `SEVERITY_SELECTED` w/ severity | **400** | FE sends `critical/high/moderate`; backend `RED/YELLOW/GREEN` | Blocks ambulance flow | **P0** | Map RED↔critical etc. in `api.ts` (both directions) |
| Hospital decline | Mark candidate rejected | **400** | FE uses `HOSPITAL_REJECTED` (not a status) | Blocks hospital flow | **P0** | Use `HospitalCandidate.response=REJECTED` via P3 endpoint |
| Hospital accept | `HOSPITAL_ACCEPTED` + assign hospital | **DB/FK error** | `assignedHospitalId:"hosp-1"` (real: `hosp-001`) | Blocks hospital flow | **P0** | Use real seeded IDs; route via P3 |
| Ambulance "Picked up" | advance to `PATIENT_PICKED_UP` | **400** | Skips `AMBULANCE_EN_ROUTE` | Blocks transport | **P1** | Add EN_ROUTE trigger before pickup |
| Hospital phase end-to-end | search→accept | unreachable | **P3 not built** | Half the product dead | **P0** | Build P3 |
| Patient bootstrap | load active emergency | silent fail | relative `/active-emergency.json` (wrong origin) | Demo friction | P2 | Use absolute `http://localhost:3000/...` |
| Realtime updates | push | 3s poll | **P4 not built** | UX/scale | P1 | Build P4 |

---

## 6. Missing Features (priority order)

| # | Feature | Effort | Dependencies | Complexity | Business Value |
|---|---------|--------|--------------|-----------|----------------|
| 1 | **Hospital Ranking & Acceptance (P3)** | ~1–2 days | P1, P5 (ready) | High | **Critical** — unblocks half the product |
| 2 | Frontend contract fixes (severity/status/IDs) | ~0.5 day | none | Low | Critical (UI happy path) |
| 3 | Lifecycle tail triggers (EN_ROUTE, transport, ARRIVED) | ~0.5–1 day | P3 for hospital phase | Low–Med | High (completes flow) |
| 4 | Realtime (P4, Socket.IO) | ~1–2 days | event surface (ready) | Med | High (UX + scale) |
| 5 | Auth & identity | ~3–5 days | none | High | High (multi-user/prod) |
| 6 | Shared FE/BE types package | ~0.5 day | none | Low | Med (kills drift) |
| 7 | CI + test framework (Vitest) | ~1 day | none | Low–Med | Med |
| 8 | Deployment (Docker/cloud) | ~2–3 days | auth | Med | High (prod) |

---

## 7. Technical Debt

| Item | Risk | Fix Effort | Priority | Solution |
|------|------|-----------|:--------:|----------|
| Dead folders (`ambulance-module Person 2/`, `Docsahab-Backend person 5/`) | Confusion/misuse | 5 min | Med | Delete (recoverable via git/DEPRECATED) |
| FE↔BE types by copy-paste | Drift = the §5 contract bugs | 0.5 day | High | Shared types pkg |
| No CI / no test framework | Regressions slip | 1 day | High | Vitest + GitHub Actions |
| `console.log`-only logging | No observability | 0.5 day | Med | Structured logger |
| Generic `PATCH /status` not transactional | Minor TOCTOU | 0.5 day | Med | Wrap in `$transaction` like P2 |
| FK violations surface as 500 | Poor API ergonomics | 2 hrs | Med | Catch `P2003`→400 |
| P2 unmerged on branch | Divergence | 10 min | Med | Review + merge to `main` |
| `package.json#prisma` seed key | Breaks on Prisma 7 | 1 hr | Low | Move to `prisma.config.ts` |
| Express 4 pin vs validate middleware | Breaks if upgraded to 5 | n/a | Low | Document (done); don't upgrade carelessly |
| `pg_hba_backup.conf` stray file | Noise | 1 min | Low | Remove |

---

## 8. Security Audit

| Category | Rating | Why |
|----------|:------:|-----|
| Authentication | **0/10** | None. Single hardcoded `patient-arjun-001`. |
| Authorization | **0/10** | No roles; any caller can drive any emergency. |
| Input Validation | **8/10** | Zod on all inbound bodies/params/query — genuinely good. |
| API Safety | **5/10** | `helmet` on; standardized errors; but no rate limiting, no auth, CORS `*` in dev. |
| Database Safety | **7/10** | Parameterized via Prisma (no SQLi); FKs enforce integrity; transactions where it matters. −: no row-level security/tenancy. |
| Secrets Management | **3/10** | P1 `.env` gitignored (good), but plaintext DB creds on disk; P5 `.env` with a password sits in a dead folder; no vault. |
| Input Sanitization | **6/10** | Zod covers shape/range; no output encoding concerns yet (JSON API), no injection beyond Prisma's safety. |

**Overall security posture: ~3/10 — acceptable for a local demo, unacceptable for any multi-user or production context.** Auth is the single largest security gap.

---

## 9. Scalability Audit

- **Current bottlenecks:** (1) **3s polling × N clients** — O(N) DB reads every 3s, the dominant scaling wall; (2) **in-memory `EventEmitter`** — single-process only.
- **Database:** Prisma + Postgres scales fine for MVP; indexes on hot columns (`isAvailable`, `status`, `availableBeds`, FKs). No pagination on list endpoints → unbounded result risk later. No pool tuning.
- **Backend:** stateless HTTP layer scales horizontally **except** the EventEmitter — multiple instances would each only see their own events. Needs a broker.
- **Realtime:** must be Socket.IO **+ Redis adapter** for multi-instance fan-out; today it doesn't exist at all.
- **Frontend:** fine; polling is the cost, not rendering.
- **Future risks:** ETA is straight-line (wrong under real traffic/dispatch scale); no caching; no queueing for the assignment hot path under burst load.
- **Recommendations:** replace polling with sockets (P4 + Redis), add pagination, externalize events, add a routing/ETA provider, load-test the assignment endpoint.

---

## 10. Code Quality Audit

| Dimension | Score | Reasoning |
|-----------|:-----:|-----------|
| Architecture | 9 | Modular monolith, strict layering, single source of truth — deliberate and correct for the scale. |
| Maintainability | 8 | Clear file/layer naming; heavy doc headers; small focused functions. |
| Readability | 9 | Consistent, well-commented, idiomatic TS. |
| Consistency | 8.5 | P2 deliberately mirrors P1's patterns; envelope/error conventions uniform. |
| Modularity | 8.5 | Modules co-locate by layer and reuse cleanly via repositories. |
| Transactions | 8 | Assignment is exemplary; generic PATCH isn't transactional (−). |
| Concurrency | 9 | Conditional-claim + bounded-retry is the standout; tested under contention. |
| Error Handling | 8 | `AppError` + machine codes + central handler; gap: FK→500 leakage. |
| Documentation | 9.5 | Among the best I've audited — CLAUDE.md + MASTER_CONTEXT + MERGE_REPORT, with rejected-alternative reasoning preserved. |
| Testing | 5 | Backend modules strong; zero FE tests, no framework/CI/coverage. |
| Reusability | 8 | haversine/config/enums/repo helpers are cleanly reusable; FE types are not (copy-paste). |

**Weighted code quality of what exists: ~8.3/10.** The built portion is senior-grade; testing breadth and the missing modules pull the *project* score down, not the code itself.

---

## 11. Testing Audit

- **Automated tests:** `test-e2e.js` (52, HTTP, emergency lifecycle), `test-ambulance.ts` (27, unit+integration+concurrency), `test-db.js` (smoke). Total ~79 meaningful assertions.
- **Estimated coverage:** Emergency Core ~80% of behavior; Ambulance ~85%; **everything else 0%** (P3/P4 don't exist; frontends untested).
- **Untested:** all frontend logic; hospital ranking/acceptance; realtime; auth; the generic PATCH FK paths; load/concurrency at the HTTP boundary.
- **Confidence:** High for the two tested modules (run this session). Low for the system as a whole.
- **Regression risk:** **Medium** — no CI means tests must be run manually; `test-e2e.js` is the regression guard but is not self-cleaning (accumulates rows).
- **Overall testing score: 5/10** — excellent depth where it exists, near-zero breadth elsewhere.

---

## 12. Critical Blockers (highest → lowest impact)

1. **Person 3 absent** — blocks full MVP, end-to-end workflow, and the hospital demo. *Single biggest blocker.*
2. **Frontend contract bugs (severity/status/IDs)** — block the UI happy path even for the built backend.
3. **No auth/identity** — blocks production and multi-user.
4. **Person 4 absent** — blocks true realtime and scaling (polling won't hold).
5. **Lifecycle tail (EN_ROUTE/ARRIVED) untriggered** — blocks a complete demonstrable flow.
6. **No CI/CD/deployment** — blocks production.

---

## 13. Risk Assessment

- **Critical:** P3 missing (product is half-inoperable). *Mitigate:* build P3 first using the P2 template (1–2 days; schema ready).
- **Critical:** No authentication. *Mitigate:* add role-based auth before any multi-user/prod exposure.
- **High:** Frontend↔backend contract drift (copy-pasted types). *Mitigate:* shared types package + fix the 3 bugs.
- **High:** No realtime / polling won't scale. *Mitigate:* P4 + Redis adapter.
- **Medium:** No CI / manual tests / unmerged P2 branch. *Mitigate:* Vitest + Actions; merge P2.
- **Medium:** Straight-line ETA misleads dispatch. *Mitigate:* pluggable routing provider (the config seam already supports this).
- **Low/Future:** Prisma 6→7 and Express 4→5 upgrade landmines (documented). *Mitigate:* follow the addendum notes when upgrading.

---

## 14. Immediate Engineering Roadmap (dependency-aware)

| Order | Task | Priority | Effort | Depends on | Outcome |
|:----:|------|:--------:|:------:|-----------|---------|
| 1 | **Build P3 (Hospital Ranking & Acceptance)** | P0 | 1–2 d | P1, P5 (ready) | Hospital phase functional end-to-end |
| 2 | **Fix 3 FE contract bugs** | P0 | 0.5 d | none | UI can drive the real backend |
| 3 | **Lifecycle tail triggers** (EN_ROUTE, transport, ARRIVED) | P1 | 0.5–1 d | P3 (hospital phase) | A complete SOS→ARRIVED UI flow = MVP |
| 4 | **Merge P2 → `main`; remove dead folders; CI + Vitest** | P1 | 1 d | tests green | Stable trunk, regression safety |
| 5 | **Build P4 (Socket.IO + Redis)** | P1 | 1–2 d | event surface (ready) | Real-time; drop polling |
| 6 | **Auth & identity + shared FE/BE types** | P2 | 4–6 d | P3/P4 stable | Multi-user, prod-eligible |
| 7 | **Deployment (Docker/cloud) + observability** | P2 | 2–3 d | auth | Production posture |

**Critical path to MVP:** 1 → 2 → 3 (≈ 2.5–4 days).

---

## 15. Final Engineering Scorecard

| Area | Score | Rationale |
|------|:-----:|-----------|
| Architecture | 9.0 | Correct, deliberate modular monolith; single source of truth; clean seams. |
| Backend | 7.5 | Built half is 9-grade; whole is dragged by missing P3/P4. |
| Frontend | 6.0 | Beautiful shells; broken integration; no tests. |
| Database | 9.0 | Complete, indexed, FK-sound, migrated, zero drift. |
| API Design | 8.0 | Consistent envelope, validated, RESTful; thin coverage (6 endpoints). |
| Integration | 5.5 | Backend-internal excellent; FE writes broken; P3/P4 absent. |
| Documentation | 9.5 | Exceptional and self-recovering (handover docs preserve reasoning). |
| Maintainability | 8.5 | Patterns are obvious and repeatable. |
| Testing | 5.0 | Deep where present; near-zero breadth. |
| Scalability | 5.0 | Sound DB/stateless API; polling + in-mem events are walls. |
| Security | 3.0 | Validation good; no auth, weak secrets, open CORS. |
| Innovation | 7.0 | Atomic claim+retry concurrency and the event seam are genuinely sharp. |
| Developer Experience | 8.5 | Verify-before-trust commands, gotchas, recovery steps all documented. |
| **Overall** | **6.5** | Senior-grade foundation; half-built product; broken UI integration. |

---

## 16. Project Readiness Assessment

| Context | Ready? | Why / Why not |
|---------|:------:|---------------|
| Academic project | ✅ Yes | Strong architecture, tests, exemplary docs — comfortably exceeds coursework bar. |
| Hackathon | ⚠️ Conditional | Backend demos impressively via scripts/Postman; **the live UI happy path is broken** until the 3 FE fixes + P3 land. With ~3 days of work → strong demo. |
| Internal demo | ⚠️ Conditional | Same as hackathon — demoable backend; UI needs the contract fixes. |
| MVP | ❌ No | Half the workflow (hospital) absent; UI can't complete a run. ~2.5–4 days from MVP. |
| Startup prototype | ❌ No | Needs P3 + P4 + auth before it represents the product thesis. |
| Production | ❌ No | No auth, no realtime, no CI/CD, no deployment, no monitoring; ~4–6 weeks out. |

---

## 17. Final Engineering Verdict

**Greatest strengths:** a disciplined, correct architecture (single source of truth, strict layering, a real state machine) and the **best-engineered concurrency I found in this repo** — the atomic ambulance claim with bounded retry, proven under a 5-way race. The documentation is the second strength: this project can be resurrected from `CLAUDE.md` + `DOCSAHAB_MASTER_CONTEXT.md` alone, with engineering *reasoning* (not just facts) preserved.

**Greatest weaknesses:** **the product is half-built** — the entire hospital-coordination half (P3) and the realtime layer (P4) don't exist — and the **frontend↔backend contract is broken** in three concrete places, so the UI cannot complete a run against the real backend.

**Biggest engineering achievement:** the transactional, race-safe ambulance assignment (conditional `updateMany` claim + retry + event emission), and the clean P5→P1 migration recovery (diagnosing schema-ahead-of-migration drift and proving completeness via DDL object-set comparison).

**Biggest missing component:** **Person 3 — Hospital Ranking & Acceptance.** Its absence is what makes Docsahab a "response engine" rather than a "coordination platform."

**Most technically impressive implementation:** `ambulance.repository.assignAmbulanceAtomically` + the service-level retry loop.

**Highest-risk area:** **security/auth** (a 0/10 with a single hardcoded identity) tied with the **P3 gap** for product-functionality risk.

**One thing I would absolutely never change:** the **Emergency Core state machine + single-source-of-truth design** (`EmergencyStatus` + `VALID_TRANSITIONS` + timeline). Every other module hangs off it correctly; touching it would destabilize the whole system.

**One thing I would build next:** **Person 3**, using Person 2 as the literal template (the schema hooks and event seam are already in place).

**If a brand-new team had six weeks:**
1. **Week 1 — Person 3 (Hospital Ranking & Acceptance)** + fix the 3 frontend contract bugs. *(Unblocks the missing half; makes the UI drive the real backend.)*
2. **Week 2 — Lifecycle tail (EN_ROUTE/transport/ARRIVED) + merge P2 + CI/Vitest + shared FE/BE types.** *(Delivers a complete, regression-guarded MVP.)*
3. **Week 3 — Person 4 (Socket.IO + Redis) and migrate all frontends off polling.** *(Real-time; removes the scaling wall.)*
4. **Week 4 — Authentication, authorization, and real patient/role identity.** *(Makes it multi-user and prod-eligible.)*
5. **Weeks 5–6 — Hardening: deployment (Docker/cloud), observability, rate-limiting/CORS, pagination, routing-based ETA, load-testing, and a security pass.** *(Production readiness.)*

---

**Sign-off:** Docsahab is a **6.5/10 project built on a 9/10 foundation.** The engineering that exists is the kind you keep; the product that's missing is the kind you can build quickly *because* the foundation was done right. Build Person 3 first — everything else is already waiting for it.

*— End of permanent engineering audit.*
