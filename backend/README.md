# Docsahab Backend

Express 4 + TypeScript + Prisma/PostgreSQL. Single process, single port (`3000`), everything
under `/api/v1`. This is the Emergency Core Service and the single source of truth for the
whole platform — see the [repo root README](../README.md) for the overall architecture and
[`docs/DOCSAHAB_CURRENT_STATE_AUDIT.md`](../docs/DOCSAHAB_CURRENT_STATE_AUDIT.md) for the
current, verified state of every module.

## Layout

```
src/
├── app.ts, server.ts        Express app + HTTP server (Socket.IO attaches to the same server)
├── enums/                   EmergencyStatus + the canonical VALID_TRANSITIONS state machine
├── routes/ → validators/ → controllers/ → services/ → repositories/
├── config/                  Tunable weights/thresholds (no magic numbers in service logic)
├── types/                   Shared TypeScript contracts per module
prisma/
├── schema.prisma            6 models, 3 enums
├── seed.ts                  5 patients, 10 ambulances, 10 hospitals (Delhi-NCR)
└── migrations/
test-*.ts, test-*.js         Runnable test suites (no framework yet — see below)
```

## Setup

```bash
npm install
cp .env.example .env          # set DATABASE_URL for your local Postgres
node_modules/.bin/prisma migrate deploy
node_modules/.bin/tsx prisma/seed.ts
npm run dev                   # tsx watch, http://localhost:3000
```

Seeded IDs (stable, referenced by the frontends and test suites):
`patient-arjun-001…005`, `amb-001…010`, `hosp-001…010`.

## Scripts

```bash
npm run dev              # tsx watch src/server.ts
npm run build             # tsc → dist/
npm run typecheck         # tsc --noEmit
npm run test:ambulance    # Ambulance Matching — self-cleaning
npm run test:hospital     # Hospital Ranking & Acceptance — self-cleaning
npm run test:realtime     # Realtime gateway — self-cleaning
node test-e2e.js          # Emergency Core HTTP E2E (server must already be running; NOT self-cleaning)
```

## Architecture rules (do not violate)

- **The Emergency is the single source of truth.** Never create a second emergency system, a
  second server, or a duplicate model/enum. New modules live inside `src/` as layers, not
  separate services.
- **Never write `Emergency.status` raw.** All status changes go through `isValidTransition()`
  (`src/enums/emergency-status.enum.ts`) and write an immutable `TimelineEvent`.
- **Multi-write operations use `prisma.$transaction`.** Reference implementation:
  `repositories/ambulance.repository.ts` → `assignAmbulanceAtomically` — a conditional
  `updateMany` claim inside a transaction, with a bounded retry in the service layer for
  contention. The same pattern is used for hospital acceptance/reassignment.
- **Realtime-relevant changes emit on `emergencyEvents`** (`services/emergency.service.ts`).
  This is the one event bus in the system — the Socket.IO gateway (`services/realtime.service.ts`)
  is its only consumer today; do not add a competing event mechanism.
- Layering is strict: `routes → validators (Zod) → controllers (thin, try/catch → next) →
  services (business logic) → repositories (all Prisma queries)`.
- Enums come from `@prisma/client` (or the `enums/` re-export) — never hardcode status/severity
  strings in business logic.

## Known, deliberate design decisions

- **Ambulance availability is a boolean** (`isAvailable`), not a status enum — lifecycle state
  lives only on `Emergency`.
- **Hospital rejection lives on `HospitalCandidate.response`**, never as an `Emergency` status —
  a hospital declining doesn't change the emergency's global status.
- **The `Emergency` denormalizes the patient profile** at SOS time, in addition to a real FK to
  `Patient` — so every responder reads critical data without an extra service call, and history
  doesn't mutate if the patient record is later edited.
- **Express is pinned to v4 on purpose.** `middleware/validate.middleware.ts` reassigns
  `req.query`/`req.params`, which are read-only getters in Express 5. Do not upgrade without
  addressing that first.

## Testing

No test framework is wired in yet — suites are runnable TypeScript/JS scripts, not `npm test`.
`test-ambulance.ts`, `test-hospital.ts`, and `test-realtime.ts` are self-cleaning (they delete
what they create). **`test-e2e.js` is not self-cleaning** — each run leaves one `ARRIVED`
emergency in the database; run it against a dev database you don't mind accumulating rows in.
