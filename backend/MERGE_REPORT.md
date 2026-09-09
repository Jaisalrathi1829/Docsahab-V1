# Docsahab Backend Merge Report

**Merge:** `backend person 1` (Emergency Core Service — authoritative) ← `Docsahab-Backend person 5` (entity models)
**Date:** 2026-06-16
**Branch:** `merge/person5-entities-integration` (git initialized in `backend person 1/` for rollback)
**Outcome:** One unified backend. Emergency Core Service remains the single source of truth.

---

## 1. Merge Analysis Report

### Key finding
The integration of Person 5's entities was **already completed at three of four layers** before
this merge and only needed to be finished at the database-migration layer:

| Layer                     | State found                                              | Action |
| ------------------------- | ------------------------------------------------------- | ------ |
| `prisma/schema.prisma`    | ✅ Already contains `Patient`/`Ambulance`/`Hospital` + FK relations | Verified valid — kept as-is |
| Generated Prisma client   | ✅ Already includes all 6 models + 3 enums               | Re-generated — confirmed in sync |
| `prisma/seed.ts`          | ✅ Already merged (Person 5 logic, enriched data)        | Kept as-is |
| **DB migrations**         | ❌ **Missing** — only `Emergency`/`TimelineEvent`/`HospitalCandidate` existed | **Completed (new migration added)** |

The live `docsahab` database (localhost:5432) therefore had **no `Patient`, `Ambulance`, or
`Hospital` tables and no foreign keys** from `Emergency`. Because the repository layer issues
`include: { patient: true, assignedAmbulance: true, assignedHospital: true }` on every read,
**the Emergency API would fail at runtime** against the current DB. Completing the migration is
what makes the unified backend actually functional end-to-end.

### Layered architecture (Person 1, preserved unchanged)
```
HTTP  →  routes → validators (Zod) → controllers
                                         ↓
                                     services (state machine, events, timeline)
                                         ↓
                                     repository (Prisma)
                                         ↓
                                     PostgreSQL
```
Event bus (`emergencyEvents` EventEmitter) already exposed for the Realtime module.

---

## 2. Conflicts Discovered

| # | Conflict | Resolution (Person 1 wins) |
|---|----------|----------------------------|
| 1 | **`EmergencyStatus` enum** — P5 has 7 states; P1 has 12 (adds `AMBULANCE_EN_ROUTE`, `SEVERITY_SELECTED`, `HOSPITAL_ACCEPTANCE_REQUESTED`, `HOSPITAL_NOTIFIED`, `CANCELLED`) | Keep P1's 12-state enum. P5's enum **not merged**. |
| 2 | **`Emergency` model** duplicated in both schemas | Keep P1's richer model (severity, ETA, denormalized profile, timeline, candidates). P5's **not merged**. |
| 3 | **`POST /sos`** — P5 `index.js` auto-assigns ambulance/hospital; P1 `POST /api/v1/sos` is a validated, state-machine-driven SOS trigger | Keep P1. P5 endpoint **not merged** (deprecated). |
| 4 | **Patient fields** — P5 `severeAllergies String?` / `criticalConditions String?`; P1 `allergies String[]` / `conditions String[]` (+ `sex`, `updatedAt`, unique `phoneNumber`) | Keep P1's enriched, array-based fields. |
| 5 | **Emergency FK naming** — P5 `ambulanceId`/`hospitalId`; P1 `assignedAmbulanceId`/`assignedHospitalId` | Keep P1's clearer names. |
| 6 | **Dependency drift** — P5 Express 5 / Prisma 6.19; P1 Express 4.21 / Prisma 6.9 (client generated as 6.19.3) | Keep P1's stack. No change required. |
| 7 | **Migration drift** — schema integrated but no migration for the 3 entity tables / 4 FKs | **Fixed** by new migration (see §6). |
| 8 | **Stale artifact** — `prisma/migration.sql` (loose, manual) only contained core tables and inserted a mismatched migration name `20260611_init` | **Removed** in the finalization pass; `prisma/migrations/` is authoritative. |

No conflicts were resolved in Person 5's favor. Emergency ownership is undivided.

---

## 3. Files Merged

| File | Notes |
|------|-------|
| `prisma/schema.prisma` | (Pre-merged) `Patient`, `Ambulance`, `Hospital` integrated alongside P1 core models. Verified valid. **No change needed this session.** |
| `prisma/seed.ts` | (Pre-merged) Based on P5 seed logic, upgraded to idempotent `upsert`s with realistic Delhi-NCR data (5 patients, 10 ambulances, 10 hospitals). **No change needed.** |
| `test-e2e.js` | **Edited:** fake resource IDs `AMB-204` / `hosp-st-mary` → real seeded IDs `amb-002` / `hosp-001` so the suite passes under the now-enforced FKs. API routes/payload shapes unchanged. |

## 4. Files Deprecated

| Path | Reason |
|------|--------|
| `Docsahab-Backend person 5/` (whole folder) | Superseded by the unified Emergency Core Service. Marked with `DEPRECATED.md`. Files retained for reference/rollback. |
| `Docsahab-Backend person 5/index.js` | Ad-hoc SOS + entity endpoints replaced by the layered API. |
| `Docsahab-Backend person 5/prisma/schema.prisma` | 7-state enum + thin Emergency model superseded. |
| `Docsahab-Backend person 5/prisma/seed.js` | Replaced by `seed.ts`. |
| `backend person 1/prisma/migration.sql` | Stale loose SQL dump superseded by `prisma/migrations/`. **Removed** in the finalization pass (see §5). |

## 5. Files Removed

- `prisma/migration.sql` — obsolete loose SQL dump, **removed during the finalization pass**
  (superseded by the authoritative `prisma/migrations/` folder). Verified beforehand that no
  code, script, documentation, or Prisma configuration referenced it.

The entity merge itself was achieved additively (no model or column drops) to preserve rollback.

## 6. Schema Changes

**No changes to `schema.prisma`** — it was already the unified, valid schema.
The change is at the **migration layer only**:

**Added:** `prisma/migrations/20260616120000_integrate_patient_ambulance_hospital/migration.sql`

```
+ CREATE TABLE Patient   (id, fullName, age, sex?, bloodGroup, allergies[], conditions[], phoneNumber, createdAt, updatedAt)
+ CREATE TABLE Ambulance (id, vehicleNo, latitude, longitude, isAvailable, createdAt, updatedAt)
+ CREATE TABLE Hospital  (id, name, latitude, longitude, hasICU, hasTraumaCare, hasCardiology, availableBeds, createdAt, updatedAt)
+ UNIQUE INDEX Patient_phoneNumber_key, INDEX Patient_phoneNumber_idx
+ UNIQUE INDEX Ambulance_vehicleNo_key, INDEX Ambulance_isAvailable_idx
+ INDEX Hospital_availableBeds_idx
+ 4 foreign keys (see §7)
```
The SQL was produced by Prisma itself (`migrate diff`) — not hand-guessed. The migration is
**purely additive** (no `DROP`, no column rewrite) and safe against existing `Emergency` rows.

## 7. Relationship Changes

All four relationships are now backed by real database foreign keys:

| Relationship | Column | On Delete | Rationale |
|--------------|--------|-----------|-----------|
| `Emergency → Patient` | `patientId` (required) | `RESTRICT` | An emergency must always have a patient; block patient deletion while referenced. |
| `Emergency → Ambulance` | `assignedAmbulanceId` (optional) | `SET NULL` | Assignment is optional and can be released. |
| `Emergency → Hospital` | `assignedHospitalId` (optional) | `SET NULL` | Destination is optional and can change. |
| `HospitalCandidate → Hospital` | `hospitalId` (required) | `RESTRICT` | A candidate must reference a real hospital. |

(`TimelineEvent → Emergency` and `HospitalCandidate → Emergency` were already FK-backed with `CASCADE` from the init migration.)

## 8. Seed Data Changes

**None required.** `seed.ts` was already the merged, enriched version and is compatible with:
- **Emergency Core Service** — patients have `id`s consumed by `POST /sos` (e.g. `patient-arjun-001`).
- **Ambulance Matching (P2)** — 10 ambulances with lat/long + `isAvailable`.
- **Hospital Ranking (P3)** — 10 hospitals with capability flags + `availableBeds`.
- **Test/E2E** — `amb-002` and `hosp-001` referenced by `test-e2e.js`.

Person 5's generic `seed.js` (50 patients / 20 ambulances / 20 hospitals, all `O+`) is deprecated.

---

## 9. Final Folder Structure

```
backend person 1/                         ← UNIFIED BACKEND (source of truth)
├── prisma/
│   ├── schema.prisma                      6 models, 3 enums (unified)
│   ├── seed.ts                            merged seed (Patient/Ambulance/Hospital)
│   └── migrations/
│       ├── 20260611161631_init/           Emergency, TimelineEvent, HospitalCandidate
│       ├── 20260616120000_integrate_patient_ambulance_hospital/   ★ NEW (entities + FKs)
│       └── migration_lock.toml
├── src/
│   ├── controllers/emergency.controller.ts
│   ├── services/emergency.service.ts      state machine + events + timeline
│   ├── repositories/emergency.repository.ts
│   ├── routes/emergency.routes.ts
│   ├── validators/emergency.validator.ts  (Zod)
│   ├── enums/emergency-status.enum.ts     12 states + transition map
│   ├── middleware/ (validate, error-handler)
│   ├── types/emergency.types.ts
│   ├── utils/api-response.ts
│   ├── prisma/client.ts                   singleton
│   ├── app.ts  ·  server.ts
├── test-e2e.js  ·  test-db.js  ·  seed-test-data.js
├── MERGE_REPORT.md                        ★ this file
└── package.json · tsconfig.json

Docsahab-Backend person 5/                 ← DEPRECATED (archived, not deleted)
└── DEPRECATED.md                          ★ pointer to the unified backend
```

## 10. Final Prisma Schema Explanation

Six models, three enums, one source of truth.

- **`Emergency`** (P1 core) — the central record. One row per SOS. Holds lifecycle `status`
  (12-state `EmergencyStatus`), `severity`, captured patient location, assigned ambulance/hospital,
  `etaMinutes`, and a **denormalized patient profile** (`patientName/Age/Sex/BloodGroup/Allergies/
  Conditions/criticalAlert`) so responders never need a second service call during an emergency.
- **`TimelineEvent`** (P1) — immutable audit trail; one row per status change (`CASCADE` on Emergency).
- **`HospitalCandidate`** (P1) — multi-hospital acceptance workflow (`PENDING/ACCEPTED/REJECTED`, rank).
- **`Patient`** (P5, enriched) — `bloodGroup`, `allergies[]`, `conditions[]`, `sex`, unique `phoneNumber`.
- **`Ambulance`** (P5) — `vehicleNo` (unique), location, `isAvailable` (indexed for matching).
- **`Hospital`** (P5) — capability flags (`hasICU/hasTraumaCare/hasCardiology`), `availableBeds` (indexed).
- **Enums:** `EmergencyStatus` (12), `Severity` (RED/YELLOW/GREEN), `HospitalResponse` (3).

The denormalization is deliberate: `Patient` is the system of record, but the Emergency snapshots
the profile at SOS time so the patient row can change without rewriting history.

## 11. Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Prisma schema valid | `prisma validate` | ✅ "The schema is valid 🚀" |
| Prisma client generates | `prisma generate` | ✅ Generated Prisma Client v6.19.3 |
| TypeScript compiles | `tsc --noEmit` | ✅ Exit 0, no errors |
| Migration completeness | DDL object-set diff (canonical schema vs init+new migrations) | ✅ **30/30 objects**, 0 missing, 0 extra, 0 duplicate |
| Broken imports / relations | source review + tsc | ✅ None |
| API contract regressions | route/payload/response review | ✅ None — `src/` untouched |

**Applied & verified against the local `docsahab` DB (2026-06-16, user-authorized):**

| Step | Result |
|------|--------|
| Migration applied | ✅ Both migrations applied via `prisma migrate reset` (replayed init → entity integration) |
| Seed | ✅ 5 patients · 10 ambulances · 10 hospitals |
| Tables created | ✅ Patient, Ambulance, Hospital (+ Emergency, TimelineEvent, HospitalCandidate) |
| Foreign keys live | ✅ All 6 FKs present; reject invalid refs with `P2003` (verified positive + negative) |
| Relationship resolution | ✅ Emergency→Patient/Ambulance/Hospital + HospitalCandidate→Hospital all resolve |
| Relationship/FK test | ✅ **23/23 checks passed** |
| HTTP E2E suite | ✅ **52/52 checks passed** — full lifecycle SOS→ARRIVED + validation/transition guards |

> **Orphan-data note:** the initial `migrate deploy` failed (`P3018` / FK violation `23503`) because the
> live DB held 19 pre-merge test `Emergency` rows referencing a non-existent `patient-arjun-001`.
> With user authorization, the local dev DB was reset (`prisma migrate reset --force`), which replayed
> both migrations cleanly and re-seeded. No production data was involved.

## 12. Integration Readiness Report

**Ready.** The unified backend satisfies the success criteria:

- ✅ One backend, one source of truth, no duplicate emergency systems.
- ✅ Patient / Ambulance / Hospital integrated with real FK relationships.
- ✅ Seed data preserved and enriched.
- ✅ Emergency workflow, routes, payloads, and responses unchanged.

**Forward compatibility:**
- **Ambulance Matching (P2):** `Ambulance.isAvailable` (indexed) + lat/long; assign via `PATCH /emergency/:id/status { assignedAmbulanceId }`.
- **Hospital Selection (P3):** capability flags + `availableBeds` (indexed); `HospitalCandidate` workflow + repo helpers already present.
- **Realtime (P4):** subscribe to `emergencyEvents` (`emergencyCreated`, `statusChanged`).
- **Frontends:** stable `/api/v1` contract; `GET /emergency/:id` returns fully-included relations.

### Model reviews (requested)
- **Patient:** Emergency Profile ✅ · Blood Group ✅ · Severe Allergies ✅ (`allergies[]`) · Critical Conditions ✅ (`conditions[]`) · **Emergency Contacts ❌ not modeled.** *Not added* — not required by the current emergency workflow and outside Person 1's deliberate scope (avoiding a medical-records platform). Recommended as a future optional `emergencyContact Json?` if/when notification flows need it.
- **Ambulance:** Availability ✅ · Assignment ✅ · Dispatch ✅ · ETA ✅ (`Emergency.etaMinutes`).
- **Hospital:** Ranking ✅ (`HospitalCandidate.rank`) · Acceptance ✅ (`HospitalResponse`) · Capability matching ✅ · Availability ✅ (`availableBeds`).

### Status: COMPLETE
The migration, seed, and full verification have been applied to the local `docsahab` DB.
The integration is finalized and ready for the remaining Docsahab modules.

> Note: Prisma's seed runner invoked `tsx prisma/seed.ts` without `node_modules/.bin` on PATH and
> reported `'tsx' is not recognized`. The seed runs correctly via `npx prisma db seed` /
> `node_modules/.bin/tsx prisma/seed.ts`. Optional hardening: change the seed script to
> `node --import tsx prisma/seed.ts` for PATH-independent execution.

### Rollback
```bash
cd "backend person 1"
git checkout main             # discard the merge branch, OR
git branch -D merge/person5-entities-integration
# DB (if the migration was applied): drop the 4 FKs + 3 tables, then
#   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260616120000_integrate_patient_ambulance_hospital';
```

---

## 13. Git Commits Involved

Git was initialized inside `backend person 1/` for this merge (no repo existed previously).
The P5 → P1 integration was performed on branch `merge/person5-entities-integration` and
merged into `main` via a `--no-ff` merge. Commits (oldest → newest):

| Commit | Branch | Message |
|--------|--------|---------|
| `27434a0` | `main` | chore: baseline snapshot of Emergency Core Service before Person 5 entity integration — **ROLLBACK POINT** |
| `e91a682` | `merge/person5-entities-integration` | feat: complete Person 5 entity integration at the DB-migration layer |
| `fcb514f` | `merge/person5-entities-integration` | docs: record applied-migration + verification results in merge report |
| `ffb997d` | `merge/person5-entities-integration` | chore: remove obsolete prisma migration dump |
| `bf9070e` | `main` | **Merge: Person 1 + Person 5 backend foundation integration** (`--no-ff`; current tip of `main`, frozen foundation) |

- To inspect: `git show bf9070e` (the merge), `git show e91a682` (the migration), `git log --oneline --graph` (full history).
- To roll the foundation back to the pre-integration state: `git checkout 27434a0` (code only; the DB also needs reverting per the Rollback section above).
- **Note:** the repository has no configured git user — commits were made with `git -c user.name="merge-bot" -c user.email="merge@docsahab.local" commit …`.

*(The later Person 2 / Ambulance Matching work lives on a separate branch `feature/person2-ambulance-matching` (`a03a2d2`) and is unrelated to this P5→P1 merge.)*
