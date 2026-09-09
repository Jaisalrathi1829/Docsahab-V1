# Docsahab

**Emergency medical coordination platform** — reducing delays during the "golden hour" by
coordinating Patient, Ambulance, and Hospital in real time.

One `Emergency` is created on SOS and progresses through a strict, validated lifecycle:

```
SOS_TRIGGERED → AMBULANCE_ASSIGNED → AMBULANCE_EN_ROUTE → [Hospital Search + Ranking]
→ HOSPITAL_ACCEPTED (temporary, pre-pickup) → PATIENT_PICKED_UP (assignment locks)
→ SEVERITY_SELECTED → HOSPITAL_NOTIFIED → EN_ROUTE_TO_HOSPITAL → ARRIVED
```

The Emergency Core Service is the single source of truth; every module and every frontend
reads/writes the emergency through it.

## Current status

**Read [`docs/DOCSAHAB_CURRENT_STATE_AUDIT.md`](docs/DOCSAHAB_CURRENT_STATE_AUDIT.md) first**
for the backend — it's a forensic, evidence-based audit of exactly what works today, verified
against live source and the running system. Short version: the full intended backend workflow
(SOS → ambulance dispatch → automatic hospital ranking → acceptance → pickup → triage →
notification) works end-to-end.

**Frontend note:** the audit describes an earlier frontend that has since been retired.
`frontend-revised/` is the current, in-progress frontend rebuild and is **not yet wired to the
backend** — see its own section below. The audit's backend findings remain accurate; its
frontend-integration findings are historical.

## Repository structure

```
docsahab/
├── backend/                    Express + TypeScript + Prisma/PostgreSQL API (single source of truth)
├── frontend-revised/            Current frontend rebuild — NOT yet integrated with the backend
│   ├── patient-side/
│   │   ├── patient-home/
│   │   └── patient-authentication/
│   └── ambulance-side/
│       ├── ambulance-home/
│       └── ambulance-authentication/
│       (hospital side: not started yet)
├── docs/
│   ├── DOCSAHAB_CURRENT_STATE_AUDIT.md   ← current, authoritative (backend)
│   └── archive/                          historical audits and handover docs (superseded)
└── .gitignore
```

## Architecture

A modular monolith, not microservices — deliberate, so the Emergency stays a single source of
truth with in-process module calls and atomic cross-module transactions. One backend process,
one port, layered per module:

```
routes → validators (Zod) → controllers → services → repositories (Prisma) → PostgreSQL
```

Five original module owners, all integrated into one backend today:

| Module | Responsibility |
|---|---|
| **Emergency Core** | Lifecycle state machine, timeline, validation, the source-of-truth API |
| **Ambulance Matching** | Nearest-unit selection, atomic race-safe assignment, ETA |
| **Hospital Ranking & Acceptance** | Capability/ETA/resource ranking, parallel requests, accept/reassign/lock |
| **Realtime Synchronization** | Socket.IO gateway bridging backend events to rooms (built; not yet consumed by any frontend — see audit) |
| **Data Foundation** | Patient/Ambulance/Hospital schema, seed data |

## Getting started

**Prerequisites:** Node 18+, PostgreSQL running locally.

### Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in your local DATABASE_URL
node_modules/.bin/prisma migrate deploy
node_modules/.bin/tsx prisma/seed.ts
npm run dev                 # http://localhost:3000/api/v1/health
```

### Frontend

`frontend-revised/` is being rebuilt and is **not yet connected to the backend** — each
sub-app (`patient-side/patient-home`, `patient-side/patient-authentication`,
`ambulance-side/ambulance-home`, `ambulance-side/ambulance-authentication`) is an independent
Vite app you can run on its own:

```bash
cd frontend-revised/patient-side/patient-home && npm install && npm run dev
```

Backend integration is deliberately deferred until the frontend rebuild is further along.

### Verifying the backend

```bash
cd backend
node_modules/.bin/tsc --noEmit     # typecheck
node test-e2e.js                   # Emergency Core E2E (server must be running)
npm run test:ambulance             # Ambulance Matching (self-cleaning)
npm run test:hospital              # Hospital Ranking & Acceptance (self-cleaning)
npm run test:realtime              # Realtime gateway (self-cleaning)
```

## Contributing to this repo

- `backend/` keeps its own detailed conventions and gotchas in its README and code comments —
  read those before changing backend code.
- Never write `Emergency.status` directly — always go through `isValidTransition()` and write
  a `TimelineEvent`.
- Multi-write operations use `prisma.$transaction` (see `ambulance.repository.assignAmbulanceAtomically`
  for the reference pattern: conditional claim + bounded retry).
- Before calling anything "done": typecheck, run the relevant test suite, and re-run `test-e2e.js`
  as a regression check.
