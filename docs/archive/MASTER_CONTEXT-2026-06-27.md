# DOCSAHAB — MASTER CONTEXT & ENGINEERING HANDOVER

> **Purpose of this file.** This is a complete, self-contained handover for a Claude Code instance with **zero prior knowledge** of Docsahab. Everything here was reconstructed from actual source code (not documentation, not comments, not prior reports). If you are that new instance: read this whole file before touching anything. It tells you what exists, why it was built that way, what is broken, and exactly what to do next.
>
> **Last updated:** 2026-06-27. **Author:** prior Claude Code session (Opus 4.8).
> **Working directory:** `D:\PROJECTS\DOCSAHAB` (Windows 11, PowerShell primary shell, Bash/Git-Bash also available).

---

## 1. Executive Summary

### What Docsahab is
Docsahab is an **emergency medical coordination platform**. Its job is to reduce delays during the **"golden hour"** by coordinating three actors in real time:
- **Patient** (triggers SOS)
- **Ambulance** (dispatched, transports patient)
- **Hospital** (accepts patient, prepares resources)

It is **NOT**: a hospital ERP, an ambulance-booking app, a telemedicine platform, or a healthcare-analytics system. It **IS**: a rapid-response coordination layer (SOS → transport → hospital preparation → arrival).

### Overall goal
A single emergency ("Emergency") is created on SOS and progresses through a strict lifecycle. The **Emergency Core Service is the single source of truth**; every other module reads/writes the Emergency through it. All three frontends watch the same Emergency and show role-appropriate views.

### Current completion (code-verified)
| Layer | % | Note |
|------|---:|------|
| Database | ~98% | All models/FKs/indexes/migrations/seed present & applied |
| Backend | ~62% | Emergency Core + Ambulance + Data done; Hospital (P3) & Realtime (P4) absent |
| Frontend | ~55% | 3 polished UI shells; integration partial/broken |
| Integration | ~45% | P1↔P5, P1↔P2 complete; frontend writes partly broken; P3/P4 missing |
| **Overall MVP** | **~52%** | First half (response+transport) real; second half (hospital+realtime) missing |

### What is production-ready
- **Person 1 — Emergency Core Service** (lifecycle, timeline, status machine, APIs, validation). Tested: `test-e2e.js` 52/52.
- **Person 2 — Ambulance Matching** (nearest-unit selection, atomic assignment, ETA, events). Tested: `test-ambulance.ts` 27/27.
- **Person 5 — Data Foundation** (models, FKs, seed) — fully integrated into Person 1.

### What is MVP-ready (works when driven with correct values)
- The full backend emergency lifecycle SOS → ARRIVED (proven by `test-e2e.js` issuing each transition with correct enums/IDs).
- Ambulance discovery + assignment over the real DB.

### What is unfinished / missing
- **Person 3 — Hospital Ranking & Acceptance: does not exist** (only DB hooks). **Biggest gap.**
- **Person 4 — Realtime (Socket.IO): does not exist** (only an unconsumed event emitter). Frontends poll every 3 s instead.
- **Lifecycle orchestration tail**: `AMBULANCE_EN_ROUTE`, `EN_ROUTE_TO_HOSPITAL`, `ARRIVED` have **no trigger** anywhere.
- **Frontend↔backend contract bugs** (severity enum, invalid status, invalid hospital ID) — see §9.
- **No authentication / identity** (a single hardcoded patient).

---

## 2. Complete Architecture

### High-level shape
```
   Patient App            Ambulance App           Hospital App        (React/Vite/TS, shadcn/ui)
        │                       │                        │             all share api.ts → :3000
        └───────────── HTTP (poll every 3s) ─────────────┘
                                │
                    Emergency Core Service  (backend person 1/, Express + TypeScript, :3000, /api/v1)
                    ├── Emergency module  (P1)  ← SOURCE OF TRUTH
                    ├── Ambulance module  (P2)
                    ├── [Hospital module  (P3)]  ← NOT BUILT
                    ├── emergencyEvents (EventEmitter)  ← [P4 Socket.IO would consume this — NOT BUILT]
                    └── Prisma ORM
                                │
                         PostgreSQL  "docsahab" @ localhost:5432  (models from P5)
```

### Backend services
There is **exactly one backend process**: `backend person 1/` (Express 4 + TypeScript, port 3000, prefix `/api/v1`). It contains the Emergency module (P1) and the Ambulance module (P2) as **co-located layers** (not separate servers).

**Why one process, layered by concern (not microservices):** the project is a hackathon-scale, single-DB coordination app. A modular monolith keeps the Emergency the single source of truth, lets modules call each other in-process (no network hops mid-emergency), and keeps transactions atomic across modules. Person 2 was explicitly **rebuilt from a standalone port-5000 server into this process** for exactly this reason (see §11).

### Layered architecture (per module)
```
HTTP → routes → validators (Zod) → controllers → services (business logic) → repositories (Prisma) → PostgreSQL
```
- **routes**: path + method + validation middleware wiring.
- **validators**: Zod schemas; reject malformed requests before controllers.
- **controllers**: thin HTTP glue; `try/catch → next(error)`; return standardized responses. No business logic.
- **services**: business logic, state-machine enforcement, event emission, transactions orchestration.
- **repositories**: *all* Prisma queries; no HTTP, no business rules. Also the **in-process integration point** for other modules.
**Why:** strict separation makes modules independently testable and lets P2/P3 import P1's repository/service directly without HTTP.

### Database
PostgreSQL via Prisma. Single DB `docsahab`. The Emergency carries a **denormalized snapshot of the patient profile** at SOS time (name/age/sex/bloodGroup/allergies/conditions/criticalAlert) **in addition to** a real FK to `Patient`. **Why denormalize:** during an emergency, every consumer (ambulance, hospital) must read patient-critical data with zero extra service calls and the snapshot must not change if the patient row is later edited. `Patient` remains the system of record.

### Realtime flow (DESIGNED, NOT BUILT)
`emergency.service.ts` exports a Node `EventEmitter` named **`emergencyEvents`**. The Emergency and Ambulance services emit events (`emergencyCreated`, `statusChanged`, `ambulanceAssigned`, `etaUpdated`). **No code subscribes at runtime.** Person 4 is intended to attach a Socket.IO server to this emitter and broadcast to per-emergency rooms. Until then, **frontends poll `GET /emergency/:id` every 3 seconds**.
**Why an emitter seam:** it decouples lifecycle writes from realtime transport, so Person 4 can be added with zero changes to P1/P2.

### Integrations
- **P1 ↔ P5**: P5's models live inside P1's schema with FKs. Complete.
- **P1 ↔ P2**: P2 imports `emergencyRepo`, `emergencyEvents`, the `EmergencyStatus` enum + `isValidTransition`, and `AppError`. Complete.
- **P1 ↔ Frontend**: all three apps call `/api/v1` via a shared `api.ts`. Reads work; several writes broken (§9).
- **P3, P4**: hooks only.

### Authentication plan (NOT IMPLEMENTED)
There is **no auth** today. The patient is hardcoded (`patient-arjun-001`). The intended plan (not in code): per-role identity (patient / ambulance crew / hospital console), a real patient registry, and JWT or session auth at the gateway, with `assignedHospitalId`/crew actions authorized by role. CORS is currently `*` in dev; `helmet` is enabled.

### Data flow (happy path, as the backend supports it)
1. Patient app → `POST /sos` → Emergency created `SOS_TRIGGERED` + timeline event + `emergencyCreated`.
2. (Dispatcher/P2) → `POST /emergency/:id/assign-ambulance` → nearest available ambulance claimed atomically → `AMBULANCE_ASSIGNED`, `assignedAmbulanceId`, `etaMinutes`, ambulance `isAvailable=false`, events.
3. Ambulance crew → `PATCH …/status` → `AMBULANCE_EN_ROUTE` → `PATIENT_PICKED_UP` → `SEVERITY_SELECTED`.
4. (P3) → hospital search → `HOSPITAL_SEARCHING` → candidates → `HOSPITAL_ACCEPTANCE_REQUESTED` → `HOSPITAL_ACCEPTED`.
5. Ambulance/hospital → `HOSPITAL_NOTIFIED` → `EN_ROUTE_TO_HOSPITAL` → `ARRIVED`.
Steps 2's caller, 3's `EN_ROUTE`, all of 4, and 5's tail are **not orchestrated** today (see §6).

### Deployment assumptions
Local dev only. Backend `npm run dev` (tsx watch) on :3000; Postgres on localhost:5432 (`DATABASE_URL` in `backend person 1/.env`). Frontends are Vite dev servers. No Docker, no CI, no cloud config exists.

### Folder structure (top level)
```
D:\PROJECTS\DOCSAHAB\
├── backend person 1/              ← THE backend (unified foundation + P1 + P2). git repo lives here.
├── Docsahab-Backend person 5/     ← DEPRECATED (models migrated into backend person 1). Has DEPRECATED.md.
├── ambulance-module Person 2/     ← DEAD prototype (standalone :5000 mock). Superseded by P2-in-foundation.
└── Front End/
    ├── Patient Side/
    ├── Ambulance Side/
    └── Hospital Side/
```

---

## 3. Repository Structure (detailed)

### `backend person 1/` — the only live backend
- **Git:** a git repo is initialized **here** (not at project root). Branches: `main` (frozen foundation), `feature/person2-ambulance-matching` (P2 module, not yet merged). See §11.
- `.env` — `DATABASE_URL="postgresql://postgres:admin@localhost:5432/docsahab?schema=public"`, `PORT=3000`, `NODE_ENV=development`. (gitignored.)
- `package.json` — scripts: `dev` (tsx watch), `build` (tsc), `start`, `prisma:generate`, `prisma:migrate`, `prisma:studio`, `typecheck` (tsc --noEmit), `test:ambulance` (tsx test-ambulance.ts). Deps: `@prisma/client`, `cors`, `express@^4`, `helmet`, `morgan`, `uuid`, `zod`. Dev: `prisma`, `tsx`, `typescript`, `dotenv`, `@types/*`, `pg`. **Prisma seed config:** `"prisma": { "seed": "tsx prisma/seed.ts" }`.
- `tsconfig.json` — strict, ES2022, commonjs, outDir dist, rootDir src, `@/*`→`src/*`.
- **`prisma/`**
  - `schema.prisma` — 6 models, 3 enums (see §4).
  - `seed.ts` — idempotent upserts: 5 patients, 10 ambulances, 10 hospitals (Delhi-NCR). Run via `npx prisma db seed` OR `node_modules/.bin/tsx prisma/seed.ts`.
  - `migrations/20260611161631_init/` — Emergency, TimelineEvent, HospitalCandidate + enums.
  - `migrations/20260616120000_integrate_patient_ambulance_hospital/` — Patient/Ambulance/Hospital tables + 4 FKs (the P5 integration).
  - `migrations/migration_lock.toml` — provider postgresql.
  - `pg_hba_backup.conf` — stray Postgres config backup (ignore; candidate for deletion).
  - ⚠️ NOTE: an obsolete loose `prisma/migration.sql` **was deleted** during finalization. Don't recreate it; `prisma/migrations/` is authoritative.
- **`src/`**
  - `server.ts` — entry; `prisma.$connect()` then `app.listen(PORT)`; graceful SIGTERM/SIGINT.
  - `app.ts` — Express app: `helmet`, `cors`, `morgan`, `express.json()`, static-serves `../../Front End` (for `active-emergency.json`), `/api/v1/health`, mounts `emergencyRoutes` then `ambulanceRoutes` at `/api/v1`, 404 handler, global error handler.
  - `prisma/client.ts` — PrismaClient singleton (`globalForPrisma`) to avoid hot-reload connection exhaustion.
  - `enums/emergency-status.enum.ts` — re-exports `EmergencyStatus`; `STATUS_LABELS`; `VALID_TRANSITIONS`; `isValidTransition()`. **This is the canonical state machine.**
  - `middleware/error-handler.middleware.ts` — `AppError(statusCode, code, message)` + `errorHandler` (maps AppError → JSON; unknown → 500).
  - `middleware/validate.middleware.ts` — `validate({ body?, params?, query? })` Zod middleware → 400 `VALIDATION_ERROR` with field details.
  - `utils/api-response.ts` — `successResponse(data, message)` / `errorResponse(code, message, details?)`. Response shapes are a hard contract (see §5).
  - `utils/haversine.ts` — `haversineDistanceKm(lat1,lon1,lat2,lon2)` (pure, TS, ported from P2 prototype).
  - `config/ambulance-matching.config.ts` — `averageSpeedKmph` (env `AMBULANCE_AVG_SPEED_KMPH`, default 30), `minimumEtaMinutes` (env `AMBULANCE_MIN_ETA_MINUTES`, default 1).
  - **Emergency module (P1):** `types/emergency.types.ts`, `validators/emergency.validator.ts`, `controllers/emergency.controller.ts`, `services/emergency.service.ts`, `repositories/emergency.repository.ts`, `routes/emergency.routes.ts`.
  - **Ambulance module (P2):** `types/ambulance.types.ts`, `validators/ambulance.validator.ts`, `controllers/ambulance.controller.ts`, `services/ambulance.service.ts`, `repositories/ambulance.repository.ts`, `routes/ambulance.routes.ts`.
- **Test/util scripts (project-root of backend):**
  - `test-e2e.js` — HTTP E2E for Emergency Core (52 assertions; full lifecycle). Needs server running + DB seeded.
  - `test-ambulance.ts` — unit+integration for P2 (27 assertions; run `npm run test:ambulance`). Self-cleaning, hits DB directly.
  - `test-db.js` — Prisma connectivity smoke.
  - `seed-test-data.js` — creates one demo emergency via HTTP, advances it to `AMBULANCE_EN_ROUTE`, and writes `Front End/active-emergency.json` (which all frontends read to bootstrap).
  - `MERGE_REPORT.md` — detailed P5-integration record.

### `Docsahab-Backend person 5/` — DEPRECATED
Standalone Express+Prisma backend (the original home of Patient/Ambulance/Hospital). Superseded; models migrated into `backend person 1`. Has `DEPRECATED.md`. Do **not** run or migrate from it. `index.js` had its own `POST /sos` and ad-hoc endpoints — all rejected during the merge.

### `ambulance-module Person 2/ambulance-module/` — DEAD prototype
Standalone Express server on :5000 using `mockData.js` (3 hardcoded ambulances, Lucknow coords, invented `status` field). `controllers/`, `services/`, `routes/`, `utils/haversine.js`. **Only `haversine.js` was salvaged** (ported to TS). Everything else discarded. Candidate for deletion.

### `Front End/` — three React/Vite/TypeScript apps (shadcn/ui, Figma-Make exports)
Each has `src/app/api.ts` (identical shared client → `http://localhost:3000/api/v1`), `src/app/App.tsx`, `src/app/components/*`, `src/app/components/ui/*` (shadcn), `src/main.tsx`, `src/styles/*`. **No tests. No sockets. Polling only.**
- **Patient Side**: `HomeScreen` (SOS button), `SosActiveScreen`, `MedicalProfileScreen`.
- **Ambulance Side**: `ScreenEnRoute`, `ScreenPickedUp`, `MapView`, `PhoneFrame`.
- **Hospital Side**: `IncomingQueue`, `RequestDetails`, `ActionPanel`, `ResponseTimer` (single console layout).

---

## 4. Database

### Models (Prisma, `backend person 1/prisma/schema.prisma`)

**Patient** — system of record for a person who can trigger SOS.
- `id String @id @default(uuid())`, `fullName String`, `age Int`, `sex String?`, `bloodGroup String`, `allergies String[] @default([])`, `conditions String[] @default([])`, `phoneNumber String @unique`, `createdAt`, `updatedAt`, `emergencies Emergency[]`. `@@index([phoneNumber])`.

**Ambulance** — dispatchable unit.
- `id`, `vehicleNo String @unique`, `latitude Float`, `longitude Float`, `isAvailable Boolean @default(true)`, `createdAt`, `updatedAt`, `emergencies Emergency[]`. `@@index([isAvailable])`.
- **Note:** availability is a **boolean**, NOT a per-ambulance status enum. (The dead prototype invented `AVAILABLE/ASSIGNED/...`; rejected.)

**Hospital** — facility that can accept patients.
- `id`, `name`, `latitude`, `longitude`, `hasICU Boolean`, `hasTraumaCare Boolean`, `hasCardiology Boolean`, `availableBeds Int`, `createdAt`, `updatedAt`, `emergencies Emergency[]`, `hospitalCandidates HospitalCandidate[]`. `@@index([availableBeds])`.

**Emergency** — THE central entity. One per SOS.
- `id`, `patientId String` + `patient Patient @relation(...)`.
- `status EmergencyStatus @default(SOS_TRIGGERED)`, `severity Severity?`, `emergencyType String?`.
- `patientLatitude Float`, `patientLongitude Float`, `patientAddress String?`.
- `assignedAmbulanceId String?` + `assignedAmbulance Ambulance?` (SET NULL), `assignedHospitalId String?` + `assignedHospital Hospital?` (SET NULL), `etaMinutes Int?`.
- **Denormalized profile**: `patientName?`, `patientAge?`, `patientSex?`, `patientBloodGroup?`, `patientAllergies String[]`, `patientConditions String[]`, `criticalAlert String?` (auto-derived from first allergy at SOS).
- `hospitalCandidates HospitalCandidate[]`, `timelineEvents TimelineEvent[]`, `createdAt`, `updatedAt`.
- Indexes: `patientId`, `status`, `assignedAmbulanceId`, `assignedHospitalId`, `createdAt`.

**TimelineEvent** — immutable audit; one row per status change.
- `id`, `emergencyId` + `emergency Emergency @relation(onDelete: Cascade)`, `status EmergencyStatus`, `label String`, `description String?`, `metadata Json?`, `createdAt`. Indexes: `emergencyId`, `createdAt`.

**HospitalCandidate** — multi-hospital acceptance workflow (P3's data hook).
- `id`, `emergencyId` + relation (Cascade), `hospitalId` + `hospital Hospital @relation` (Restrict), `hospitalName String?`, `rank Int`, `response HospitalResponse @default(PENDING)`, `respondedAt DateTime?`, `rejectionReason String?`, `createdAt`. `@@unique([emergencyId, hospitalId])`, indexes on each FK.

### Enums
- **EmergencyStatus** (12): `SOS_TRIGGERED, AMBULANCE_ASSIGNED, AMBULANCE_EN_ROUTE, PATIENT_PICKED_UP, SEVERITY_SELECTED, HOSPITAL_SEARCHING, HOSPITAL_ACCEPTANCE_REQUESTED, HOSPITAL_ACCEPTED, HOSPITAL_NOTIFIED, EN_ROUTE_TO_HOSPITAL, ARRIVED, CANCELLED`.
- **Severity** (3): `RED, YELLOW, GREEN`. ← **Frontends incorrectly use `critical/high/moderate` (bug, §9).**
- **HospitalResponse** (3): `PENDING, ACCEPTED, REJECTED`. (There is **no** `HOSPITAL_REJECTED` EmergencyStatus — rejection is modeled on the candidate. Hospital frontend wrongly uses a `HOSPITAL_REJECTED` status, §9.)

### Relationships / FKs (all live, verified)
`Emergency→Patient` (Restrict), `Emergency→Ambulance` (SetNull), `Emergency→Hospital` (SetNull), `HospitalCandidate→Hospital` (Restrict), `TimelineEvent→Emergency` (Cascade), `HospitalCandidate→Emergency` (Cascade).

### Seed data (`prisma/seed.ts`)
- 5 patients with rich profiles. Stable IDs: `patient-arjun-001` … `patient-rahul-005`. (Frontends hardcode `patient-arjun-001`.)
- 10 ambulances `amb-001`…`amb-010`, vehicleNo like `DL-3C-AM-4521`, Delhi-NCR coords.
- 10 hospitals `hosp-001`…`hosp-010` (AIIMS, Safdarjung, Max Saket, …) with varied capability flags + beds.
- Idempotent (`upsert`). **Frontends sometimes use wrong IDs (`hosp-1`) — bug, §9.**

### Migration history
1. `20260611161631_init` — emergency-domain tables + enums.
2. `20260616120000_integrate_patient_ambulance_hospital` — entity tables + 4 FKs (P5 integration; additive).
`prisma migrate status` = up to date; **zero drift** confirmed.

### Known schema decisions
- **Denormalized patient profile on Emergency** (responder speed + historical immutability).
- **Ambulance availability = boolean** (not a status machine) — lifecycle state lives on Emergency only.
- **Rejection modeled on HospitalCandidate**, not as an Emergency status (a hospital declining doesn't change the emergency's global status; it advances the candidate workflow).

---

## 5. API Documentation

Base URL: `http://localhost:3000/api/v1`. **Response envelope is a hard contract:**
- Success: `{ "success": true, "data": <T>, "message": "..." }`
- Error: `{ "success": false, "error": { "code": "...", "message": "...", "details"? } }`

### `GET /health`
→ `{ success, data: { service:"docsahab-emergency-core", status:"healthy", timestamp }, message }`.

### `POST /sos` — create emergency (Emergency module)
**Body (Zod `createEmergencySchema`):** `patientId` (string, required), `patientLatitude` (−90..90), `patientLongitude` (−180..180); optional `patientAddress`, `emergencyType`, `patientName`, `patientAge` (int>0), `patientSex`, `patientBloodGroup`, `patientAllergies[]`, `patientConditions[]`.
**Behavior:** creates Emergency `SOS_TRIGGERED`, derives `criticalAlert` from first allergy, writes initial timeline event, emits `emergencyCreated`. **Note:** `patientId` must exist (FK Restrict) or you get a DB error. **Returns 201** full emergency (with includes).

### `GET /emergency/:id` — full emergency (Emergency module)
**Params:** `id` must be a UUID (else 400). **Returns 200** emergency including `patient`, `assignedAmbulance`, `assignedHospital`, `timelineEvents` (asc), `hospitalCandidates` (rank asc). **404** `EMERGENCY_NOT_FOUND` if missing.

### `PATCH /emergency/:id/status` — advance lifecycle (Emergency module)
**Body (`updateStatusSchema`):** `status` (required, must be a valid `EmergencyStatus`); optional `severity` (`RED|YELLOW|GREEN`), `assignedAmbulanceId`, `assignedHospitalId`, `etaMinutes` (int≥0), `emergencyType`, `criticalAlert`, `description`, `metadata`.
**Business rules:** validates the transition via `isValidTransition(current, next)`; **400 `INVALID_STATUS_TRANSITION`** if illegal (message lists valid next states); only provided fields are updated; writes a timeline event; emits `statusChanged`. **404** if not found. ⚠️ If you pass `assignedHospitalId`/`assignedAmbulanceId` that doesn't exist, the FK throws (surfaces as 500 unless caught) — pass **real seeded IDs**.

### `GET /emergency/:id/timeline` — chronological audit (Emergency module)
→ 200 array of timeline events (asc). 404 if emergency missing.

### `POST /emergency/:id/assign-ambulance` — nearest-ambulance assignment (Ambulance module) **[NEW, P2]**
**Params:** `id` UUID. **No body.**
**Behavior:** loads emergency (must exist, not already have an ambulance, status must allow `AMBULANCE_ASSIGNED`); validates patient coords; queries `isAvailable:true` ambulances; picks nearest by haversine; computes `etaMinutes`; in **one transaction** atomically claims the ambulance (`updateMany where isAvailable:true`), updates the emergency (`AMBULANCE_ASSIGNED`, `assignedAmbulanceId`, `etaMinutes`), writes timeline; **bounded retry (×5)** falls back to next-nearest if a concurrent request won the claim; emits `statusChanged` + `ambulanceAssigned` + `etaUpdated`. **Returns 200** full emergency.
**Errors:** 404 `EMERGENCY_NOT_FOUND`; 409 `EMERGENCY_ALREADY_HAS_AMBULANCE`; 400 `INVALID_STATUS_TRANSITION`; 400 `INVALID_COORDINATES`; 503 `NO_AMBULANCE_AVAILABLE`; 409 `AMBULANCE_NO_LONGER_AVAILABLE` (after retries).

### `GET /ambulances?available=true|false` — discovery (Ambulance module) **[NEW, P2]**
→ 200 list of ambulances (optionally filtered). Query validated by Zod (`available` ∈ `"true"|"false"`).

### Error codes in use
`VALIDATION_ERROR`, `NOT_FOUND`, `EMERGENCY_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `INVALID_COORDINATES`, `NO_AMBULANCE_AVAILABLE`, `EMERGENCY_ALREADY_HAS_AMBULANCE`, `AMBULANCE_NO_LONGER_AVAILABLE`, `INTERNAL_SERVER_ERROR`.

---

## 6. Emergency Lifecycle

### Statuses & `VALID_TRANSITIONS` (from `enums/emergency-status.enum.ts` — the source of truth)
```
SOS_TRIGGERED                → AMBULANCE_ASSIGNED, CANCELLED
AMBULANCE_ASSIGNED           → AMBULANCE_EN_ROUTE, CANCELLED
AMBULANCE_EN_ROUTE           → PATIENT_PICKED_UP, CANCELLED
PATIENT_PICKED_UP            → SEVERITY_SELECTED
SEVERITY_SELECTED            → HOSPITAL_SEARCHING
HOSPITAL_SEARCHING           → HOSPITAL_ACCEPTANCE_REQUESTED
HOSPITAL_ACCEPTANCE_REQUESTED→ HOSPITAL_ACCEPTED, HOSPITAL_SEARCHING (retry if all reject)
HOSPITAL_ACCEPTED            → HOSPITAL_NOTIFIED
HOSPITAL_NOTIFIED            → EN_ROUTE_TO_HOSPITAL
EN_ROUTE_TO_HOSPITAL         → ARRIVED
ARRIVED                      → (terminal)
CANCELLED                    → (terminal)
```
**Rule:** `CANCELLED` is only reachable before pickup (first three states). After pickup, the emergency must complete. **Note:** severity is assessed **before** hospital search (clinically correct: triage → match a capable hospital). *(The original task prompt listed hospital-search before pickup — that ordering is wrong; trust the code.)*

### Who triggers each (current reality)
| Transition | Trigger today | Status |
|---|---|---|
| → SOS_TRIGGERED | `POST /sos` (Patient app) | ✅ |
| → AMBULANCE_ASSIGNED | `POST /assign-ambulance` (P2) | ✅ (no UI calls it yet) |
| → AMBULANCE_EN_ROUTE | **nobody** | ❌ missing trigger |
| → PATIENT_PICKED_UP | Ambulance app PATCH | ⚠️ unreachable (needs EN_ROUTE) |
| → SEVERITY_SELECTED | Ambulance app PATCH | ⚠️ sends wrong severity enum |
| → HOSPITAL_SEARCHING | **nobody (P3 absent)** | ❌ |
| → HOSPITAL_ACCEPTANCE_REQUESTED | **nobody (P3 absent)** | ❌ |
| → HOSPITAL_ACCEPTED | Hospital app PATCH | ⚠️ wrong ID + unreachable |
| → HOSPITAL_NOTIFIED | Ambulance app PATCH | ⚠️ unreachable |
| → EN_ROUTE_TO_HOSPITAL | **nobody** | ❌ |
| → ARRIVED | **nobody** | ❌ |

### Events emitted (on `emergencyEvents`)
- `emergencyCreated` `{ emergency }` (P1 create).
- `statusChanged` `{ emergency, previousStatus, newStatus, timelineEvent }` (P1 updateStatus AND P2 assign).
- `ambulanceAssigned` `{ emergencyId, ambulanceId, vehicleNo, distanceKm, etaMinutes, emergency }` (P2).
- `etaUpdated` `{ emergencyId, etaMinutes, previousEtaMinutes }` (P2).
**No runtime subscribers** (Person 4 not built).

### Missing transitions (must be built)
`AMBULANCE_EN_ROUTE` (dispatch), all hospital-phase transitions (P3), and `EN_ROUTE_TO_HOSPITAL`/`ARRIVED` (transport tail).

---

## 7. Person Contributions

### Person 1 — Emergency Core Service ✅ COMPLETE / PRODUCTION-READY
- **Completed & merged into `main`:** Emergency model, 12-state lifecycle, transition map, timeline, all emergency APIs, Zod validation, AppError/error handler, standardized responses, `emergencyEvents` seam, Prisma singleton, app/server bootstrap.
- **Pending:** none for its scope (auth/list endpoints are cross-cutting, not P1-specific).
- **Integration:** owns the source of truth; consumed by P2 and all frontends.
- **Tests:** `test-e2e.js` 52/52.

### Person 2 — Ambulance Matching ✅ COMPLETE (on a feature branch)
- **Original:** a standalone :5000 Express mock (`mockData.js`, invented status machine, hardcoded Lucknow ambulances). **Abandoned** — only `haversine` salvaged.
- **Rebuilt (this project):** foundation-native module in `backend person 1/src/*/ambulance.*` + `utils/haversine.ts` + `config/ambulance-matching.config.ts`. Real Ambulance model, nearest selection, configurable ETA, atomic assignment transaction, bounded-retry concurrency, events. APIs `POST /emergency/:id/assign-ambulance`, `GET /ambulances`.
- **Merged?** Committed on branch **`feature/person2-ambulance-matching`** (commit `a03a2d2`). **NOT merged to `main`** — awaiting review.
- **Pending:** dispatch (`AMBULANCE_EN_ROUTE`) endpoint; real routing/GPS ETA; a frontend that calls the assign endpoint.
- **Tests:** `test-ambulance.ts` 27/27.

### Person 3 — Hospital Ranking & Acceptance ❌ NOT BUILT
- **Exists:** only DB hooks — `Hospital` + `HospitalCandidate` models, and `emergency.repository.ts` helpers `addHospitalCandidates`, `updateHospitalCandidateResponse`, `findHospitalCandidates`.
- **Pending (everything):** hospital search; ranking algorithm (capability + distance + beds); candidate generation; `HOSPITAL_SEARCHING` / `HOSPITAL_ACCEPTANCE_REQUESTED` orchestration; accept/reject endpoints; `HOSPITAL_ACCEPTED`. **Highest-priority remaining module.**
- **Integration:** none yet (hooks ready).

### Person 4 — Realtime ❌ NOT BUILT
- **Exists:** only `emergencyEvents` (EventEmitter) with no runtime consumers. No `socket.io` dependency anywhere.
- **Pending (everything):** Socket.IO server attached to `emergencyEvents`, per-emergency rooms, broadcasting, client reconnection; swap frontends from polling to sockets.

### Person 5 — Data Foundation ✅ COMPLETE / MERGED
- **Completed:** Patient/Ambulance/Hospital models, seed, DB bootstrap.
- **Merged:** integrated into `backend person 1/prisma/schema.prisma` + a dedicated migration; the standalone `Docsahab-Backend person 5/` folder **deprecated** (`DEPRECATED.md`).
- **Abandoned:** P5's own `Emergency` model + 7-state enum + `POST /sos` (conflicted with P1; P1 won).

---

## 8. Frontend

### Architecture
Three independent React 18 + Vite + TypeScript apps using **shadcn/ui** (Radix + Tailwind), exported from Figma Make. Each has its own `package.json`/`node_modules`. They are **not** a monorepo and share code only by **duplication** (identical `api.ts` copied into each).

### Routing & state
- **No router.** Each app is a single screen or a fixed multi-panel layout; "navigation" is local `useState` (e.g., Patient `screen: "home"|"sos-active"|"profile"`).
- **State:** local `useState`/`useMemo`; **data sync = `setInterval` polling `getEmergency` every 3 s.** Bootstraps by fetching `active-emergency.json` (written by `seed-test-data.js`).

### Backend integration status
- **Shared `api.ts`** → `http://localhost:3000/api/v1`: `createEmergency`, `getEmergency`, `updateStatus`, `getTimeline`, `healthCheck`, plus `Emergency`/`TimelineEvent`/`HospitalCandidate` types.
- **Patient**: ✅ SOS create + status display. Hardcodes `patient-arjun-001` and Connaught Place coords. (Bootstraps off **relative** `/active-emergency.json` — wrong origin vs the other two apps which use the absolute backend URL.)
- **Ambulance**: ✅ reads `etaMinutes`/`assignedAmbulanceId`/profile; ❌ severity write broken; ❌ skips `AMBULANCE_EN_ROUTE`.
- **Hospital**: ✅ reads + maps profile; ❌ `HOSPITAL_REJECTED` (not a real status); ❌ `assignedHospitalId:"hosp-1"` (FK violation); vitals/checklist/capacity/timer hardcoded.

### Current mock data (looks live, isn't)
Hospital: vitals `120/80, hr 80, spo2 98`, checklist (bed/doctor/team), "St. Vincent Medical Center", "ER 8/12 beds", "Dr. Mehra", 57-s `ResponseTimer`. Ambulance: fallback `"AMB-204"`, `"Rajeev Sharma"`, hardcoded "8 MIN" to hospital, "St. Mary Hospital".

### Known frontend bugs (see §9)
Severity enum mismatch; invalid `HOSPITAL_REJECTED`; invalid `hosp-1`; skipped lifecycle transitions; relative bootstrap URL on Patient app; no error UX on poll failures.

---

## 9. Known Issues

### Functional bugs (block end-to-end UI flow)
1. **Severity enum mismatch (all frontends):** they send `critical/high/moderate`; backend `Severity` = `RED/YELLOW/GREEN`. `SEVERITY_SELECTED` write → **400**.
2. **Hospital `HOSPITAL_REJECTED` is not a status:** Hospital app `handleDecline` → **400**. Rejection belongs on `HospitalCandidate.response`.
3. **Hospital `assignedHospitalId:"hosp-1"`:** real IDs are `hosp-001`…; FK Restrict → **DB error**.
4. **Missing `AMBULANCE_EN_ROUTE` trigger:** Ambulance app jumps `AMBULANCE_ASSIGNED → PATIENT_PICKED_UP` → **400**.
5. **Hospital phase unreachable:** without P3, an emergency can't reach `HOSPITAL_ACCEPTANCE_REQUESTED`, so `HOSPITAL_ACCEPTED` from the UI → 400.
6. **Patient bootstrap URL** is relative (`/active-emergency.json`) → resolves to Vite origin, not backend.

### Technical debt
- Dead folders on disk: `ambulance-module Person 2/`, `Docsahab-Backend person 5/`.
- FE/BE share types by **copy-paste**, not a package → drift (root cause of bugs 1–3).
- Only `backend person 1/` is under git; frontends untracked.
- `console.log` logging only; no structured logs/metrics/tracing.
- `prisma/pg_hba_backup.conf` stray file.
- P2 not merged to `main` yet.

### Missing validation
- No validation that `assignedHospitalId`/`assignedAmbulanceId` exist before the FK throws (surfaces as 500). Consider catching `P2003` → 400.
- No auth/role checks on any endpoint.

### Race conditions
- **Handled** in ambulance assignment (atomic conditional claim + retry). **Verified** by `test-ambulance.ts` (5 concurrent → 5 distinct units).
- **Unhandled generally**: generic `PATCH /status` has a small TOCTOU between read and write (not transactional). Low risk at current scale; P3 should use transactions like P2.

### Authentication gaps
No authentication, authorization, identity, or session anywhere. Single hardcoded patient. CORS `*` in dev.

### Scalability concerns
- In-memory `EventEmitter` won't work across multiple backend instances → Person 4 needs a Socket.IO Redis adapter.
- 3-s polling × N clients is O(N) load every 3 s — replace with sockets.
- No pagination on list endpoints; no DB connection-pool tuning beyond Prisma defaults.

### Security concerns
- No auth; open CORS in dev; DB password in `.env` files (P1 `.env` is gitignored; P5 `.env` has a password and sits on disk). `helmet` is enabled (good). No rate limiting, no input sanitization beyond Zod.

### Performance issues
- ETA is straight-line haversine (no roads/traffic) — fine for MVP, wrong for production dispatch.

---

## 10. Previous Engineering Decisions (with rejected alternatives)

1. **Person 1 is the single source of truth; P5's Emergency/SOS rejected.** Alternative (let P5 keep its `Emergency` + 7-state enum): rejected — two emergency systems = guaranteed divergence. P1's 12-state machine is richer and tested.
2. **Modular monolith, not microservices.** Alternative (P2 as a standalone :5000 service): rejected — broke atomicity and the single-source-of-truth; rebuilt P2 in-process.
3. **Layered architecture (routes/validators/controllers/services/repositories).** Alternative (fat controllers): rejected — untestable, couples HTTP to DB.
4. **Denormalized patient profile on Emergency.** Alternative (always join Patient): rejected — extra calls mid-emergency + history would mutate if the patient row changes.
5. **Ambulance availability = boolean.** Alternative (per-ambulance status enum, as the prototype had): rejected — duplicates lifecycle state; `isAvailable` + Emergency status suffice.
6. **Rejection on `HospitalCandidate`, not as an Emergency status.** A hospital declining advances the candidate workflow; it doesn't change the emergency's global status.
7. **Additive migration for P5 integration (not editing the init migration).** Alternative (regenerate one clean init): rejected — would rewrite applied history; additive is reversible.
8. **Reset dev DB during P5 integration.** The live DB had 19 orphaned pre-merge test emergencies (referenced a non-existent patient) that blocked adding the FK. With explicit user consent, `prisma migrate reset` replayed both migrations + reseeded. (Pure dev data.)
9. **Atomic ambulance claim via conditional `updateMany` + bounded retry.** Alternative (`SELECT … FOR UPDATE`): rejected — conditional update is simpler, DB-portable, and equally race-safe; retry gives graceful fallback instead of failing the caller.
10. **ETA = distanceKm / avgSpeed × 60, configurable.** Preserves the prototype's implicit 30 km/h (`×2`) but named and env-overridable — no magic numbers.
11. **New route `POST /emergency/:id/assign-ambulance` (vs reusing PATCH /status).** Justified: discovery + selection + availability claim + atomicity is a new capability PATCH doesn't provide.
12. **`--no-ff` merge to freeze the foundation** so there's an explicit merge commit marking the baseline.

---

## 11. Claude Development History (engineering reasoning preserved)

**Session A — P1+P5 merge & foundation freeze.**
- Discovered P1's `schema.prisma`, generated client, and `seed.ts` already integrated P5's models, but **no migration existed** for the entity tables/FKs — the live DB had only Emergency/Timeline/HospitalCandidate, so the API's relation includes would fail at runtime. The "merge" was 75% done; the real gap was the migration layer.
- Verified with `prisma migrate diff` (DB-free) that the canonical schema = init migration + a new entity migration; authored `20260616120000_integrate_patient_ambulance_hospital` from Prisma's own diff output. Proved completeness by a DDL object-set comparison (30/30 objects).
- Initialized **git inside `backend person 1/`** (no git existed anywhere), baseline on `main`, work on a merge branch.
- Applying the migration first **failed (`P3018`/FK `23503`)**: 19 orphaned test emergencies referenced a non-existent `patient-arjun-001`. After explicit user consent, **reset the dev DB** (replayed migrations + reseeded). Prisma's AI-safety gate required the user's exact consent string via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`.
- Post-merge verification: `prisma validate` ✅, `tsc --noEmit` ✅, generate ✅, **relationship/FK tests 23/23**, **Emergency E2E 52/52**. Fixed `test-e2e.js` fake IDs (`AMB-204`/`hosp-st-mary` → real `amb-002`/`hosp-001`) since the new FKs reject non-existent refs.
- Finalization: deleted obsolete loose `prisma/migration.sql`, `--no-ff` merged to `main` (merge commit `bf9070e`). Foundation frozen.

**Session B — Person 2 audit.** Found the `ambulance-module Person 2/` prototype to be a standalone :5000 mock with no DB/Prisma/types, hardcoded Lucknow ambulances, an invented status machine, query-with-side-effects, no validation/tests. Verdict: cannot integrate without a rewrite; salvage only haversine. Scores ~3/3/1/2 of 10. Confirmed the Ambulance frontend already talks to the Core Service (not the prototype).

**Session C — Person 2 rebuild.** Built the foundation-native module (files in §3). Key reasoning: reuse `emergencyRepo`/`emergencyEvents`/`isValidTransition`/`AppError`; assignment is **atomic** (conditional claim → emergency update → timeline) with **bounded retry** so concurrent assignments fall back to the next-nearest unit (verified: 5 concurrent → 5 distinct units). Added events `ambulanceAssigned`/`etaUpdated` plus a parity `statusChanged`. Verified `tsc` ✅, `test-ambulance.ts` 27/27, **no regression** (E2E still 52/52), HTTP smoke (200/400/409). Committed on `feature/person2-ambulance-matching` (`a03a2d2`); **not merged**.

**Session D — Master audit.** Reconstructed state from code: confirmed **no P3 folder, no P4/Socket.IO anywhere**; traced that only 2 of 11 transitions are module-owned; found the frontend contract bugs (§9); produced completion %s (§1). Established that the backend state machine is complete but orchestration of the hospital phase + transport tail is missing.

---

## 12. Remaining Roadmap

### 🔴 Immediate (unblocks the product's missing half)
- **Build Person 3 — Hospital Ranking & Acceptance.** Mirror the P2 build pattern. Difficulty: **High**. Depends on: nothing new (hooks + schema ready).
  - `hospital.repository.ts` (reuse the 3 existing repo helpers), `hospital.service.ts` (rank by capability+distance+beds, generate candidates, drive `HOSPITAL_SEARCHING`→`HOSPITAL_ACCEPTANCE_REQUESTED`→`HOSPITAL_ACCEPTED`), controller/routes/validators/types, mount in `app.ts`. Use transactions for accept (set `assignedHospitalId`, candidate `ACCEPTED`, advance status) atomically. Emit `hospitalRanked`/`hospitalAccepted`/`hospitalRejected`.
- **Fix the 3 frontend contract bugs** (severity enum, `HOSPITAL_REJECTED`, `hosp-1`). Difficulty: **Low**. Unblocks UI happy path.

### 🟠 High priority
- **Lifecycle tail triggers:** `AMBULANCE_EN_ROUTE` (dispatch — likely a P2 endpoint or ambulance-app action), `EN_ROUTE_TO_HOSPITAL`, `ARRIVED`. Difficulty: **Low–Med**. Depends on P3 for the hospital phase to be reachable.
- **Person 4 — Realtime (Socket.IO):** subscribe to `emergencyEvents`, room per emergency, broadcast; swap frontends from polling. Difficulty: **Med**. Depends on: completed event surface (already exists).

### 🟡 Medium
- **Auth & identity** (patient/crew/hospital roles; real patient registry; real location capture). Difficulty: **High**.
- **Shared FE/BE types package** to kill contract drift. Difficulty: **Med**.
- **Catch FK violations (`P2003`) → 400** in the generic PATCH path. Difficulty: **Low**.

### 🟢 Low
- Remove dead folders (`ambulance-module Person 2/`, `Docsahab-Backend person 5/`), `pg_hba_backup.conf`.
- Add a test framework (Vitest) + CI. Difficulty: **Low–Med**.
- Structured logging/metrics; pagination; production CORS/rate-limiting; merge P2 branch to `main`.

### Dependency chain
`Foundation ✅ → P3 → (lifecycle tail) → P4 → FE socket migration → Auth → Hardening`.
**Fastest MVP:** P3 + tail + 3 FE fixes = a complete demonstrable SOS→Arrival flow.

---

## 13. Development Rules (do not violate)

### Architecture rules
- **The Emergency Core Service is the single source of truth.** Never create a second emergency system, a second server, or a duplicate model/enum. New modules live **inside `backend person 1/`** as layers, not separate services.
- **Never bypass the state machine.** All status changes go through `isValidTransition` + write a `TimelineEvent`. Never write `Emergency.status` raw without a timeline event.
- **All multi-write operations use `prisma.$transaction`** (see `ambulance.repository.assignAmbulanceAtomically` as the reference pattern).
- **Emit on `emergencyEvents`** for anything realtime-relevant; never add a competing event bus.

### Patterns & conventions
- Layering: `routes → validators → controllers → services → repositories`. Controllers are thin (`try/catch → next(error)`), no business logic. Repositories hold **all** Prisma queries.
- **Files:** `<domain>.<layer>.ts` (e.g., `ambulance.service.ts`). Co-locate by layer folder, not by feature folder (match existing structure).
- **Errors:** throw `new AppError(httpStatus, "MACHINE_CODE", "human message")`. Never `res.status().json()` ad-hoc from services.
- **Responses:** always `successResponse(data, message)` / `errorResponse(...)`. The `{success, data, message}` / `{success, error}` envelope is a hard contract the frontends depend on.
- **Validation:** Zod schemas in `validators/`, applied via the `validate({...})` middleware. Reuse `emergencyIdParamSchema` for UUID params.
- **Enums:** import `EmergencyStatus`/`Severity`/`HospitalResponse` from `@prisma/client` (or the re-export in `enums/`). Never hardcode status/severity strings in business logic.
- **Config over magic numbers** (see `config/ambulance-matching.config.ts`).
- Match the surrounding code's heavy comment-header style.

### Testing strategy
- No framework yet; tests are runnable scripts. Unit + integration in `tsx` (see `test-ambulance.ts`); HTTP E2E in node (`test-e2e.js`). **Integration tests must be self-cleaning** (delete created rows, restore availability). Always run `tsc --noEmit` + the relevant test script before declaring done. Re-run `test-e2e.js` to confirm **no regression** after any backend change.

### Things future Claude instances must NEVER change
- The `EmergencyStatus` values/order and the `VALID_TRANSITIONS` map (frontends + DB enum depend on them) — **extend only with care + a migration**.
- The API response envelope and existing route contracts (`/sos`, `/emergency/:id`, `/emergency/:id/status`, `/emergency/:id/timeline`).
- The `Severity` enum is `RED/YELLOW/GREEN` (fix the **frontends** to match; do not bend the backend to `critical/high/moderate`).
- The denormalized-profile design and `isAvailable`-boolean design.
- Don't run/migrate from the deprecated P5 folder or the dead P2 prototype.

---

## 14. Current TODO (precise, do in order)

```
[ ] 0. git: review feature/person2-ambulance-matching; merge to main if approved.
[ ] 1. PERSON 3 — Hospital module (inside backend person 1/src):
       [ ] hospital.types.ts, hospital.validator.ts
       [ ] hospital.repository.ts (reuse addHospitalCandidates / updateHospitalCandidateResponse / findHospitalCandidates)
       [ ] hospital.service.ts:
            - searchAndRankHospitals(emergencyId): rank by capability match (severity→needs) + distance (haversine) + availableBeds;
              create HospitalCandidate rows; advance SEVERITY_SELECTED→HOSPITAL_SEARCHING→HOSPITAL_ACCEPTANCE_REQUESTED.
            - respondToCandidate(emergencyId, hospitalId, ACCEPTED|REJECTED, reason?):
              transaction → set candidate.response; if ACCEPTED: set Emergency.assignedHospitalId + status HOSPITAL_ACCEPTED + timeline;
              if all REJECTED: loop back to HOSPITAL_SEARCHING.
            - emit hospitalRanked / hospitalAccepted / hospitalRejected on emergencyEvents.
       [ ] hospital.controller.ts, hospital.routes.ts; mount in app.ts.
       [ ] New routes (documented): POST /emergency/:id/find-hospitals ; POST /emergency/:id/hospital-response (or /hospital/:hospitalId/respond).
       [ ] test-hospital.ts: ranking correctness, candidate generation, accept path, all-reject→retry, transitions, events, transaction safety.
[ ] 2. FRONTEND CONTRACT FIXES:
       [ ] severity: map UI → RED/YELLOW/GREEN in all 3 apps (Ambulance ScreenPickedUp; Hospital mapping).
       [ ] Hospital: replace HOSPITAL_REJECTED flow with candidate-response endpoint; use real hosp-001 IDs.
       [ ] Patient: bootstrap from absolute http://localhost:3000/active-emergency.json.
[ ] 3. LIFECYCLE TAIL: add triggers for AMBULANCE_EN_ROUTE (dispatch), EN_ROUTE_TO_HOSPITAL, ARRIVED
       (backend endpoints and/or ambulance-app actions).
[ ] 4. PERSON 4 — Socket.IO server subscribing to emergencyEvents; rooms per emergency; broadcast; swap FE polling→sockets.
[ ] 5. Auth + identity; shared FE/BE types; catch P2003→400; remove dead folders; Vitest + CI; merge/cleanup.
```

---

## 15. Recovery Instructions (for a fresh Claude with only this file + the repo)

1. **Orient.** Working dir `D:\PROJECTS\DOCSAHAB`. The live backend is `backend person 1/` (has the `.git`). Ignore `Docsahab-Backend person 5/` and `ambulance-module Person 2/` (dead). Frontends are in `Front End/{Patient,Ambulance,Hospital} Side/`.
2. **Verify the world before trusting this doc** (it ages):
   ```bash
   cd "backend person 1"
   node_modules/.bin/prisma validate
   node_modules/.bin/prisma migrate status      # expect: up to date, 2 migrations
   node_modules/.bin/tsc --noEmit                # expect: exit 0
   git branch                                    # main + feature/person2-ambulance-matching
   git log --oneline -5
   ```
3. **Bring the DB up** (Postgres must be running at the `.env` `DATABASE_URL`). If empty/changed: `npx prisma migrate deploy` then `node_modules/.bin/tsx prisma/seed.ts` (NOTE: `npx prisma db seed` may fail with `'tsx' is not recognized` — run the tsx binary directly). Seeded IDs: patients `patient-arjun-001…005`, ambulances `amb-001…010`, hospitals `hosp-001…010`.
4. **Prove the backend works:** in one terminal `DATABASE_URL=... PORT=3000 NODE_ENV=development node_modules/.bin/tsx src/server.ts`; in another `node test-e2e.js` (expect 52/52) and `npm run test:ambulance` (expect 27/27). On Windows, stop the server via PowerShell `Stop-Process` on the PID owning port 3000.
5. **Read the source map in §3**, then read `enums/emergency-status.enum.ts` (the state machine), `services/emergency.service.ts`, `repositories/ambulance.repository.ts` (the transaction pattern), and `app.ts` (wiring). These four teach you every pattern you need.
6. **Pick up work at §14**, starting with **Person 3** (the biggest gap; hooks already exist) using the **P2 module as your template** (it's the canonical "how to add a module" example). Obey §13. Never break the foundation contracts.
7. **For any destructive DB action** (reset/drop), Prisma's AI-safety gate requires the user's explicit consent string passed via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` — stop and ask the user first. Treat the DB as the user's local dev data.
8. **Before declaring any change done:** `tsc --noEmit`, the relevant test script, AND `test-e2e.js` (regression). Keep integration tests self-cleaning. Commit on a feature branch; don't merge to `main` without approval.

> **One-line state of the world:** Docsahab's response+transport engine (Emergency Core + Ambulance Matching + Data) is built, tested, and frozen on `main`; the hospital-coordination engine (Person 3) and realtime layer (Person 4) do not exist yet and are the next work — the schema and event hooks for both are already in place.

---

## 16. Final Knowledge-Preservation Addendum (things that lived only in session memory)

*Appended in a final knowledge-preservation pass. These facts are NOT obvious from code and are not captured above.*

### Git history & rollback
- Full `main` history (oldest→newest): `27434a0` **baseline snapshot — the ROLLBACK POINT** (pre-P5-integration foundation) → `e91a682` P5 entity-integration migration → `fcb514f` docs → `ffb997d` remove obsolete migration dump → `bf9070e` **`--no-ff` merge = frozen foundation, tip of `main`**. Feature branch `feature/person2-ambulance-matching`: `a03a2d2` (P2 module).
- **No git user is configured in the repo.** All commits were made via `git -c user.name="merge-bot" -c user.email="merge@docsahab.local" commit …`. A fresh Claude must pass `-c user.name/-c user.email` (or run `git config`) or commits fail.
- To revert the foundation to pre-integration: `git checkout 27434a0` (code only; the DB would also need reverting).

### Two independent approval gates on DB / destructive commands
- Beyond Prisma's own consent gate, the **Claude Code harness auto-mode classifier** independently blocks DB-mutating / outward commands. During this project it blocked `prisma migrate deploy` and a bulk `DELETE` even though they were valid. Expect "permission denied by auto mode classifier" on `migrate deploy/reset`, bulk writes, etc. → **stop and get explicit user authorization; do not route around it.** This is *separate from and additional to* Prisma's `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` requirement for `reset`/drop.

### Test-data hygiene (hidden runtime behavior)
- **`test-e2e.js` is NOT self-cleaning** — each run creates one emergency and drives it to `ARRIVED` without deleting it, so the dev DB **accumulates ARRIVED emergencies** over repeated runs. `seed-test-data.js` also leaves one (at `AMBULANCE_EN_ROUTE`, with `amb-002` left `isAvailable=false`). Only **`test-ambulance.ts` self-cleans** (deletes its emergencies, restores all ambulance availability). If the DB looks cluttered, this is why; a `migrate reset` + reseed clears it (mind the gates above).

### Landmines likely to be broken accidentally
- **Express 4 → 5 upgrade WILL break validation.** `middleware/validate.middleware.ts` reassigns `req.query` / `req.params`; those are read-only getters in Express 5. The foundation pins Express `^4.21.2` deliberately. (The dead P2/P5 prototypes used Express 5 — do not copy their setup into the foundation.)
- **`criticalAlert` format is asserted by tests.** It is derived as `` `${patientAllergies[0]} Allergy` `` (e.g. `"Penicillin Allergy"`), in `emergency.repository.createEmergency`. `test-e2e.js` asserts that exact literal — changing the derivation breaks the E2E.
- **Node 18+ required.** `test-e2e.js` and `seed-test-data.js` use global `fetch`. Older Node → `fetch is not defined`.
- **Prisma 6.19 → 7 upgrade is breaking.** The `package.json#prisma` seed key is deprecated and removed in Prisma 7 — migrate to a `prisma.config.ts` (the deprecated P5 folder has a working example). The CLI already prints a `6.19.3 → 7.8` update notice.

### Severity mapping — concrete fix for Known-Issues bug #1
- The mismatch is **bidirectional**. Backend `Severity = RED|YELLOW|GREEN`; all frontends use `critical|high|moderate` for both **reads** (Hospital `emergency.severity.toLowerCase()` → never matches the `critical/high/moderate` union) and **writes** (Ambulance `onSeveritySelect("critical")` → 400 on `SEVERITY_SELECTED`). Fix with ONE mapping in the shared `api.ts`: **RED↔critical, YELLOW↔high, GREEN↔moderate** (apply on write to the backend, and on read to the UI). Do **not** change the backend enum.

### Deliberately deferred / rejected ideas (considered, not built)
- **Patient "Emergency Contacts"** were explicitly reviewed during the foundation audit and **intentionally not added** — not needed by the current workflow and would push Docsahab toward a medical-records platform (out of scope). If a notify-next-of-kin flow is later required, add a minimal optional field (e.g. `Patient.emergencyContact Json?`), not a new model.
- A richer **per-ambulance status enum** was considered and rejected — boolean `isAvailable` suffices; lifecycle state lives only on the Emergency.

### Frontend run notes
- Frontends are standalone Vite apps under `Front End/* Side/` (each with its own `node_modules`, none under git). Run each with its own `npm install` + dev script (check each `package.json`; `Ambulance Side` has a `pnpm-workspace.yaml`). They expect the backend at `http://localhost:3000`, and the backend **static-serves `../../Front End`** so `active-emergency.json` is reachable — **do not rename or move the `Front End` folder or that bootstrap breaks.**
