# Aftermath of Frontend Changes — Docsahab Audit

> Full audit of the frontend replacement + rewiring session. Covers: what the earlier
> issues were, what changed, what's fixed and how, what's still left, what's temporary/
> placeholder, and what can cause issues. Everything below was verified against live
> source, the running backend, and the dev database at the time of writing — not
> reconstructed from memory. **No source code was modified while producing this file.**
>
> Supersedes `latest Audit of docsahab.md` for anything concerning the frontend — that
> document describes the OLD Figma export (now replaced) and its integration bugs.

---

## 1. Executive Summary

Before this session's work, the backend (P1–P4) was ~90% built but **zero frontend
called any of it correctly** — every write went through a generic status PATCH with
invented statuses/IDs, and P2/P3 were entirely unreachable from any UI. A fresh Figma
export (`updated frontend/`) was then dropped in with **no backend wiring at all** (no
`api.ts`, local `useState` navigation only, no fetch calls).

The frontend was replaced and all three apps were rewired against the real backend,
fixing the 6 blockers identified in the prior audit, then **verified by clicking real
buttons in a real browser** — not just builds. That process caught 3 additional bugs no
static audit would have found. Backend regression: 210/210 assertions still pass.
Nothing has been committed to git.

---

## 2. Earlier Issues (baseline before this session)

From the prior audits (`changes/latest Audit of docsahab.md`), verified accurate as the
starting point:

| # | Issue | Impact |
|---|---|---|
| E1 | No frontend called `POST /assign-ambulance` | Every SOS died at `SOS_TRIGGERED` |
| B1 | Ambulance app had no `AMBULANCE_EN_ROUTE` action | Pickup 400'd; P3's auto hospital-search (fires only on this transition) never ran |
| A1/A2 | Severity sent as `critical/high/moderate`; backend wants `RED/YELLOW/GREEN` | `SEVERITY_SELECTED` 400'd; Hospital console crashed reading it back |
| B2/C1 | Hospital app wrote status `HOSPITAL_REJECTED` (doesn't exist) and ID `hosp-1` (not seeded) | 400 on decline; 500 (unhandled FK violation) on accept |
| B3 | Ambulance "Notify Hospital" used a raw status PATCH | Could mark "notified" with no hospital actually assigned |
| E2 | Hospital console fabricated a single fake request | P3's real ranked multi-candidate queue was invisible |
| E3 | No `socket.io-client` anywhere | All 3 apps polled every 3s despite a working P4 gateway |
| C3 | Committed `active-emergency.json` pinned a UUID that doesn't exist after a fresh seed | No self-contained cold start |

Separately, `updated frontend/` was added — three fresh Figma exports with **zero**
`api.ts`, zero fetch calls, zero backend awareness. This reset the integration to zero
(though it also reset the severity-string vocabulary — the new Ambulance UI natively
uses `red/yellow/green`, closer to the backend than the old export was).

---

## 3. What Changed / What's Fixed / How

### Replacement mechanics
- Backed up the old frontend to `Front End_BACKUP_2026-08-19/` (217 files) — **not
  git**, so this backup is the only safety net for the old integration code.
- Swapped `src/`, configs, styles from `updated frontend/*` into
  `Front End/{Patient,Ambulance,Hospital} Side/`. `package.json` was byte-identical old
  vs new, so existing `node_modules` was reused — no reinstall needed.

### Rebuilt `api.ts` (identical across all 3 apps — verified via diff)
- Literal-union types for `EmergencyStatus`/`Severity` instead of loose `string` (closes
  the audit's D2 finding — this is what let invalid values ship silently before).
- Severity kept in **backend vocabulary** (`RED/YELLOW/GREEN`) at the client boundary;
  each app converts to its own display vocabulary via exported helpers
  (`severityToBackend`, `severityToHospitalUi`, `severityToAmbulanceUi`) — explicit, not
  hidden.
- Added the endpoints that never existed on the client before: `assignAmbulance`,
  `respondToHospitalRequest`, `notifyHospital`, `getHospitalRequests`.
- Added `ApiError` carrying the backend's machine code, so callers can branch on
  `NO_AMBULANCE_AVAILABLE` etc. instead of string-matching messages.

### One backend addition (uncommitted, 5 files, +59 lines)
- New `GET /emergencies/active` — the most recent non-terminal emergency. This is what
  let Ambulance/Hospital discover the live emergency without the stale
  `active-emergency.json` bootstrap (closes C3 for those two apps).
- `hospital.repository.ts`: added `timelineEvents` to the hospital-requests include (a
  real bug found via browser testing, not the static audit — the console was rendering
  "No timeline events yet" against live data).

### Per-app fixes (each verified by actual UI clicks, not just code review)

| App | Fix | Verified how |
|---|---|---|
| Patient | SOS now creates the emergency **and** immediately calls `assign-ambulance` | Clicked SOS → confirmed `DL-3C-AM-4521` assigned via backend query |
| Patient | Stepper derived from `timelineEvents`, not a hardcoded status index | Confirmed it renders correctly at `HOSPITAL_ACCEPTED`, the exact status that broke the old index-based version |
| Ambulance | Added the missing **"START — EN ROUTE"** button | Clicked it → confirmed P3's auto hospital-search fired (3 candidates ranked) from a real UI click |
| Ambulance | Severity buttons wired to `updateStatus` with backend mapping | Clicked RED → confirmed `severity: "RED"` saved |
| Ambulance | "Notify Hospital" now calls `POST /notify-hospital`, disabled until severity + hospital both exist | Clicked it → confirmed `HOSPITAL_NOTIFIED` with real ETA (8 min), not a bare status flip |
| Hospital | Real queue from `GET /hospital/hosp-001/requests`, not 5 fake entries | Confirmed live: `AIIMS Delhi`, real patient, `ICU + Cardiology` from P3's ranking |
| Hospital | Accept/decline go through `POST /hospital-response` with real `hosp-001` | Clicked Accept → confirmed `assignedHospitalId: "hosp-001"`, candidate marked `ACCEPTED` |
| Hospital | Required-services badges + real timeline replace fabricated vitals | Confirmed 11 real timeline events rendering after the backend include fix |

### Bugs the browser caught that the audit/builds didn't

1. **Timeline missing** on hospital requests — backend query gap, fixed.
2. **Pickup button silently disabled** after early hospital acceptance — the guard only
   allowed `AMBULANCE_EN_ROUTE`, but P3's additive edge means `HOSPITAL_ACCEPTED` is also
   legal pre-pickup. Fixed the guard to accept both.
3. **Accepted Cases panel emptied itself** — it was derived from the pending queue,
   which the item had just left the moment it succeeded. Changed to a separate
   accepted-snapshot list.

**Full chain verified live, driven by actual clicks across all three apps:**

```
SOS_TRIGGERED → AMBULANCE_ASSIGNED → AMBULANCE_EN_ROUTE → HOSPITAL_ACCEPTED
→ PATIENT_PICKED_UP → SEVERITY_SELECTED → HOSPITAL_NOTIFIED
```

Backend regression confirmed at time of writing: `tsc` clean, `test-e2e.js` 52/52,
`test-hospital.ts` 82/82, `test-ambulance.ts` 27/27, `test-realtime.ts` 49/49 =
**210/210**.

---

## 4. What's Still Left

- **No frontend uses Socket.IO.** All three apps still poll every 3s. The P4 gateway is
  running and tested server-side but has zero real clients.
- **`EN_ROUTE_TO_HOSPITAL` and `ARRIVED` have no UI trigger.** These were driven via
  curl/script during verification, not through any button — no screen in any app
  currently offers them.
- **`CANCELLED` has no UI anywhere**, in either the old or new frontend (confirmed via
  grep — zero matches).
- **Reject/decline was never exercised through the new UI**, only accept was. The
  backend logic is tested (`test-hospital.ts` covers reject, fallback, and dynamic
  reassignment at 82/82), but the *rewired frontend's* decline button, and the
  dynamic-reassignment / fallback-radius-expansion paths, have not been clicked through a
  real browser this session.
- **No auth/identity layer** — same pre-existing gap as before, unchanged.
- **Patient app is hardcoded to one demo patient** (`patient-arjun-001`); Hospital
  console is hardcoded to one hospital (`hosp-001`, AIIMS Delhi) — by design for a
  no-auth MVP, but worth being explicit about.

## 5. What's Temporary / Placeholder

- **`Front End_BACKUP_2026-08-19/`** — the entire old frontend, kept as a safety net.
  Should be deleted once confident a rollback isn't needed (it's dead weight otherwise,
  and it's a full duplicate copy of three apps).
- **`HOSPITAL_ID = "hosp-001"` hardcoded** in `Hospital Side/App.tsx` — a real seeded ID
  (not a fake like before), but still a single fixed identity, not a login. Deliberate
  stand-in until auth exists.
- **`PATIENT` object hardcoded** in `Patient Side/App.tsx` — same pattern, matches
  `patient-arjun-001` from seed data.
- **Vitals removed, not replaced** — the old Hospital console showed fake BP/HR/SpO₂;
  that block was removed entirely rather than fabricated differently, since no backend
  model for vitals exists. This is a genuine feature gap, not fixed, just no longer
  lying about it.
- **`ResponseTimer`'s 57s countdown** is still decorative — no backend deadline field
  backs it.

## 6. What Can Cause Issues

- **Two stale non-terminal emergencies currently sit in the dev DB** (confirmed via
  direct query): one from 2026-07-02 (`5d7f1fea…`, stuck at `HOSPITAL_ACCEPTED` — likely
  leftover from earlier P3 testing), and **one from this session's own verification**
  (`ceaaeec1…`, stuck at `HOSPITAL_NOTIFIED` — driven to `HOSPITAL_NOTIFIED` and left
  there, never completed to `ARRIVED`). Since `GET /emergencies/active` returns the
  **most recent** non-terminal emergency, **the next person who opens the Ambulance or
  Patient app will land on this leftover test emergency**, not a fresh one. Worth
  cleaning up before a real demo.
- **Backend changes are uncommitted** (5 files, +59 lines) on
  `feature/person4-realtime`, stacked on unmerged P2/P3/P4. If this branch is discarded
  or reset without care, the new `GET /emergencies/active` endpoint and the
  timeline-include fix disappear.
- **Frontend has no git safety net at all** — the only backup is the manual folder copy.
  A future "clean up old folders" pass could delete it without anyone noticing until
  it's needed.
- **No FK/Prisma-error handling still** (unchanged from the prior audit) — if the
  hardcoded `hosp-001`/`patient-arjun-001` ever get deleted from the DB, both apps
  degrade to a raw 500 instead of a clean error.
- **Untested paths carry more risk than tested ones**: decline, dynamic reassignment,
  fallback search expansion, and the `EN_ROUTE_TO_HOSPITAL`/`ARRIVED`/`CANCELLED`
  transitions are all backend-verified but not UI-verified this session — a UI-layer bug
  in those specific paths would not have been caught by the work described here.

---

*No files were committed to git while producing this audit or the changes it describes,
per explicit instruction.*
