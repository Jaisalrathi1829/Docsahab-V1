# CLAUDE.md — Docsahab

> Deep handover: **`DOCSAHAB_MASTER_CONTEXT.md`** (read it for full detail). This file = operational memory.
> Verify before trusting any claim here (this ages): run the checks in "Commands".

## Overview
Emergency medical coordination platform (the "golden hour"): **Patient → Ambulance → Hospital**. One `Emergency` per SOS progresses through a strict status lifecycle. **Emergency Core Service = single source of truth.** NOT a hospital ERP / booking / telemedicine app.

## Layout (4 top-level folders)
- **`backend person 1/`** — THE backend (Express 4 + TS, port 3000, `/api/v1`). Contains Emergency module (P1) **and** Ambulance module (P2). **Git lives HERE** (`main` = frozen foundation; `feature/person2-ambulance-matching` = P2, unmerged). Prisma + PostgreSQL `docsahab` @ localhost:5432.
- **`Front End/{Patient,Ambulance,Hospital} Side/`** — 3 React/Vite/TS (shadcn) apps; identical copied `api.ts`; **poll every 3s** (no sockets); not under git.
- **`Docsahab-Backend person 5/`** — DEPRECATED (models merged into backend). Don't run/migrate.
- **`ambulance-module Person 2/`** — DEAD prototype (:5000 mock). Don't use.

## Status (code-verified)
- ✅ Built/tested: **P1 Emergency Core**, **P2 Ambulance Matching**, **P5 Data** (models/FKs/seed). Overall ~52%.
- ❌ NOT built (hooks only): **P3 Hospital Ranking/Acceptance** (DB `HospitalCandidate` + 3 repo helpers exist; no service/routes), **P4 Realtime** (`emergencyEvents` emitter exists, zero consumers; no socket.io anywhere).

## Architecture rules (do not violate)
- Single source of truth = Emergency Core. **Never** create a second emergency system, server, or duplicate model/enum. New modules go **inside `backend person 1/src` as layers**, not separate services.
- Layering: `routes → validators(Zod) → controllers → services → repositories(Prisma) → DB`. Controllers thin (`try/catch → next(error)`, no logic). **All Prisma queries in repositories.**
- **Never write `Emergency.status` raw.** Go through `isValidTransition()` + write a `TimelineEvent`.
- **Multi-write ops use `prisma.$transaction`.** Reference: `ambulance.repository.assignAmbulanceAtomically` (conditional `updateMany` claim + bounded retry = race-safe).
- Realtime-relevant changes **emit on `emergencyEvents`** (the P4 seam). No competing event bus.

## Coding / repo conventions
- Files: `<domain>.<layer>.ts` (e.g. `ambulance.service.ts`), grouped by **layer folder** not feature.
- Errors: `throw new AppError(httpStatus, "MACHINE_CODE", "msg")`. Never ad-hoc `res.json` in services.
- Responses: always `successResponse(data,msg)` / `errorResponse(code,msg,details?)`. Envelope `{success,data,message}` / `{success,error}` is a **hard contract** the frontends depend on.
- Validation: Zod schemas in `validators/`, applied via `validate({body?,params?,query?})`. Reuse `emergencyIdParamSchema` for UUID params.
- Enums from `@prisma/client` (or `enums/` re-export). Never hardcode status/severity strings in logic. Config over magic numbers (`config/ambulance-matching.config.ts`).
- Match the existing heavy comment-header style.

## Commands (run from `backend person 1/`; use local bins — `npx prisma db seed` fails with `'tsx' not recognized`)
```bash
node_modules/.bin/prisma validate            # schema OK
node_modules/.bin/prisma migrate status      # expect: up to date, 2 migrations, no drift
node_modules/.bin/tsc --noEmit               # typecheck — must be exit 0
node_modules/.bin/prisma generate            # regenerate client
node_modules/.bin/tsx prisma/seed.ts         # seed (5 patients/10 ambulances/10 hospitals)
# run server (tsx doesn't auto-load .env → pass vars):
DATABASE_URL="postgresql://postgres:admin@localhost:5432/docsahab?schema=public" PORT=3000 NODE_ENV=development node_modules/.bin/tsx src/server.ts
node test-e2e.js                             # Emergency Core HTTP E2E → expect 52/52 (server must be up)
npm run test:ambulance                       # P2 unit+integration → expect 27/27 (hits DB, self-cleaning)
```
- Build: `npm run build` (tsc → dist). Dev watch: `npm run dev`.
- Windows: stop server via PowerShell `Stop-Process` on the PID owning :3000.
- **Destructive DB ops** (`migrate reset`/drop): Prisma AI-gate requires the user's exact consent string in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` — **stop and ask the user first.** Treat DB as user's local dev data.

## DB quick facts
6 models: Patient, Ambulance, Hospital, Emergency, TimelineEvent, HospitalCandidate. Seeded IDs: `patient-arjun-001…005`, `amb-001…010`, `hosp-001…010`. Enums: **`EmergencyStatus`** (12), **`Severity` = RED|YELLOW|GREEN**, `HospitalResponse` = PENDING|ACCEPTED|REJECTED. Ambulance availability = **boolean `isAvailable`** (no status enum). Emergency carries a **denormalized patient profile** + real FK. 2 migrations, applied, zero drift.

## Lifecycle (canonical map in `enums/emergency-status.enum.ts`)
`SOS_TRIGGERED → AMBULANCE_ASSIGNED → AMBULANCE_EN_ROUTE → PATIENT_PICKED_UP → SEVERITY_SELECTED → HOSPITAL_SEARCHING → HOSPITAL_ACCEPTANCE_REQUESTED → HOSPITAL_ACCEPTED → HOSPITAL_NOTIFIED → EN_ROUTE_TO_HOSPITAL → ARRIVED` (+ `CANCELLED`, only before pickup). Severity is set **before** hospital search (triage → match). Only `SOS_TRIGGERED` (P1) and `AMBULANCE_ASSIGNED` (P2) are module-owned today.

## Never change
- `EmergencyStatus` values/order + `VALID_TRANSITIONS` (frontends + DB enum depend on them). Extend only with a migration.
- API response envelope + existing routes (`/sos`, `/emergency/:id`, `/emergency/:id/status`, `/emergency/:id/timeline`, `/emergency/:id/assign-ambulance`, `/ambulances`).
- `Severity = RED/YELLOW/GREEN` — fix the **frontends** to match, don't bend the backend.
- Denormalized-profile design; `isAvailable`-boolean design; rejection-on-`HospitalCandidate` design.
- Don't resurrect the dead P5/P2 folders or the deleted `prisma/migration.sql`.

## Roadmap / priorities (in order)
1. **🔴 Build Person 3 (Hospital Ranking & Acceptance)** — biggest gap; hooks ready; **use the P2 module as the template**. Rank by capability+distance+beds; create candidates; drive `SEVERITY_SELECTED→HOSPITAL_SEARCHING→HOSPITAL_ACCEPTANCE_REQUESTED→HOSPITAL_ACCEPTED`; accept/reject endpoints (transactional); emit events; add `test-hospital.ts`.
2. **🔴 Fix 3 frontend contract bugs** (see Known issues) — cheap, unblocks UI happy path.
3. **🟠 Lifecycle tail triggers**: `AMBULANCE_EN_ROUTE` (dispatch), `EN_ROUTE_TO_HOSPITAL`, `ARRIVED`.
4. **🟠 Person 4 Realtime**: Socket.IO subscribing to `emergencyEvents`, room per emergency; swap FE polling→sockets.
5. **🟡 Later**: auth/identity, shared FE/BE types pkg, catch FK `P2003`→400, remove dead folders, Vitest+CI, merge P2→main.

## Known issues (frontend↔backend contract breaks)
- **Severity enum**: all FE send `critical/high/moderate`; backend wants `RED/YELLOW/GREEN` → `SEVERITY_SELECTED` 400.
- **Hospital app** uses **`HOSPITAL_REJECTED`** (not a status → 400) and **`hosp-1`** (not a seeded ID → FK violation). Use real `hosp-001` + candidate-response, not a status.
- **Ambulance app** skips `AMBULANCE_EN_ROUTE` (jumps ASSIGNED→PICKED_UP → 400).
- Hospital phase unreachable until P3 exists. Patient app bootstraps a relative `active-emergency.json` (wrong origin).
- No auth anywhere (single hardcoded `patient-arjun-001`); CORS `*` dev; event emitter won't scale multi-instance; 3s polling; ETA = straight-line haversine.

## Implementation notes
- `emergencyEvents` (in `services/emergency.service.ts`) is the P4 seam — P1 emits `emergencyCreated`/`statusChanged`; P2 emits `ambulanceAssigned`/`etaUpdated`/`statusChanged`. No runtime consumers yet.
- P2 atomic assignment + bounded retry is the canonical concurrency pattern — copy it for P3 accept.
- Frontends bootstrap from `active-emergency.json` written by `seed-test-data.js` (which also fakes progression to `AMBULANCE_EN_ROUTE`).
- Before "done": `tsc --noEmit` + relevant test + `test-e2e.js` (regression). Integration tests must self-clean. Commit on a feature branch; don't merge to `main` without approval.

## Gotchas (hard-won — not obvious from code)
- **TWO approval gates on DB/destructive cmds:** the harness auto-mode classifier blocks `migrate deploy/reset` + bulk writes, AND Prisma needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` for reset/drop. **Stop and ask the user; don't route around either.**
- **Git:** no user configured — commit via `git -c user.name=… -c user.email=… commit`. `main` baseline/rollback = `27434a0`; frozen tip = `bf9070e`; P2 branch tip = `a03a2d2`.
- **`test-e2e.js` is NOT self-cleaning** (accumulates ARRIVED emergencies each run); only `test-ambulance.ts` self-cleans. Both need **Node 18+** (global `fetch`).
- **Do NOT upgrade Express to 5** — `validate.middleware.ts` reassigns `req.query`/`req.params` (read-only getters in v5). Pinned to v4 on purpose.
- **`criticalAlert` = `` `${allergies[0]} Allergy` `` ** (e.g. "Penicillin Allergy") is asserted verbatim by `test-e2e.js` — don't change the derivation.
- **Severity fix (bug #1) is bidirectional** — map **RED↔critical, YELLOW↔high, GREEN↔moderate** in the shared `api.ts` (read + write). Never change the backend enum.
- **Don't rename/move `Front End/`** — backend static-serves `../../Front End` for the `active-emergency.json` bootstrap.
- **Prisma 6→7 upgrade is breaking** (the `package.json#prisma` seed key is removed → move to `prisma.config.ts`).
- **Emergency Contacts** were deliberately NOT added to Patient (scope: not a medical-records platform). Add `Patient.emergencyContact Json?` only if a notify flow is needed.
