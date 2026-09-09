# Latest Audit of Docsahab — MVP Readiness

> Full read-only audit. Backend on branch `feature/person4-realtime` (P3 + P4 confirmed
> wired at `server.ts:28,31`). Every claim below was verified directly against source
> (file:line references included). **No source code was changed by this audit.**
>
> Supersedes `changes to be done.md` as the current state-of-truth. A1/A2 (severity) are
> now marked FIXED here because they were resolved in `api.ts` — see `changes done.md`.

---

## 0. Real state of the project

- **Backend is ~90% built and healthy.** `server.ts:28` calls `registerHospitalEventHandlers()`
  (P3 auto hospital-search) and `server.ts:31` calls `initRealtime(server)` (P4 Socket.IO).
  Both P3 and P4 are fully implemented — the handover docs calling them "not built" are **stale**.
- **The gap is entirely on the frontends.** All three apps still drive the whole lifecycle
  through one generic `PATCH /status` call and never touch the purpose-built P2/P3 endpoints
  or sockets.
- **A1/A2 (severity enum) are already FIXED** by the earlier `api.ts` change — verified the
  translation layer is in all three `api.ts` files and that `Hospital Side/App.tsx:74`'s
  `.toLowerCase()` is now a harmless no-op. Documented in `changes done.md`.

---

## 1. The chain still dies right after SOS — the core problem

Tracing a real SOS created from the Patient app:

| Step | Should happen | Actually happens |
|---|---|---|
| SOS_TRIGGERED | Patient presses SOS | ✅ `POST /sos` works |
| → AMBULANCE_ASSIGNED | Ambulance matched | ❌ **No frontend calls `POST /emergency/:id/assign-ambulance`** → stuck at SOS forever *(E1)* |
| → AMBULANCE_EN_ROUTE | Dispatch/start | ❌ **No UI triggers this** *(B1)* — the event the auto hospital-search hangs off |
| → PATIENT_PICKED_UP | Crew taps "Picked Up" | ❌ 400 — illegal jump from ASSIGNED (must pass through EN_ROUTE) |
| → SEVERITY_SELECTED | Crew taps severity | ✅ Now works (A1 fixed) — but unreachable until the steps above are fixed |
| → hospital accept | Hospital accepts | ❌ hardcoded `hosp-1` → FK violation → 500 *(C1)* |

**Verified root cause:** `assign-ambulance` sets status to `AMBULANCE_ASSIGNED`
(`ambulance.service.ts:219`); the only legal next step is `AMBULANCE_EN_ROUTE`
(`emergency-status.enum.ts:56-59`); and the P3 auto-search fires **only** on
`newStatus === AMBULANCE_EN_ROUTE` (`hospital.service.ts:939`). So **B1 is the single
highest-leverage fix** — without an EN_ROUTE trigger, the entire fully-built P3 engine
never runs.

---

## 🔴 BLOCKERS — must fix for a working end-to-end demo

### E1 — No frontend calls `assign-ambulance` (nothing advances past SOS)
- Endpoint exists and works: `ambulance.routes.ts:31` → `POST /emergency/:id/assign-ambulance`
  (atomic, race-safe, computes ETA).
- Grep-confirmed: no `assign-ambulance` call anywhere in `Front End/`.
- **Fix:** call `POST /emergency/:id/assign-ambulance` (Patient app after SOS, or a dispatcher
  action). Add it to `api.ts` and invoke it.

### B1 — Ambulance app has no `AMBULANCE_EN_ROUTE` action; jumps ASSIGNED→PICKED_UP
- `ScreenEnRoute.tsx:132-145` — the only CTA is "PATIENT PICKED UP" → `App.tsx:113`
  `handleStatusUpdate("PATIENT_PICKED_UP")`. Nothing PATCHes `AMBULANCE_EN_ROUTE`.
- Backend: `AMBULANCE_ASSIGNED → [AMBULANCE_EN_ROUTE, CANCELLED]` only; `PATIENT_PICKED_UP`
  is legal only from `AMBULANCE_EN_ROUTE`.
- **Double impact:** `AMBULANCE_EN_ROUTE` is also what auto-fires P3 hospital-search
  (`hospital.service.ts:939`). Skipping it silently disables the whole P3 machine.
- **Fix:** add an explicit "Start / En Route" action that PATCHes `AMBULANCE_EN_ROUTE`
  before pickup.

### B2 + C1 — Hospital app writes a fake status `HOSPITAL_REJECTED` and a bad ID `hosp-1`
- `Hospital Side/App.tsx:141` `updateStatus(..., { status: "HOSPITAL_REJECTED" })` — not in
  the enum → Zod 400. (And `App.tsx:70`'s `if (status === "HOSPITAL_REJECTED")` is dead code.)
- `Hospital Side/App.tsx:122` `assignedHospitalId: "hosp-1"` — seeded IDs are
  `hosp-001…hosp-010` (`seed.ts:97+`). `assignedHospitalId` is a real FK → Prisma **P2003**
  → unhandled → raw **500** (see C-error below).
- Correct endpoint exists: `hospital.routes.ts:47` → `POST /emergency/:id/hospital-response`
  with `{ hospitalId, response: "ACCEPTED"|"REJECTED", rejectionReason? }`. Rejection lives on
  the candidate, not the emergency status (by design — `hospital.validator.ts:27`).
- **Fix:** replace both `handleAccept`/`handleDecline` raw status writes with
  `POST /hospital-response`, using a real accepting hospital ID from the candidate/console
  context.

### B3 — Ambulance "Notify Hospital" bypasses the real guard
- `Ambulance Side/App.tsx:122-124` raw PATCH to `HOSPITAL_NOTIFIED`. Because
  `SEVERITY_SELECTED → HOSPITAL_NOTIFIED` is legal (`enum:68-70`), this can succeed even when
  `assignedHospitalId` is null → status says "hospital notified" with no hospital attached,
  and no transport ETA computed.
- The correct endpoint guards both: `notifyAssignedHospital` throws `NO_HOSPITAL_ASSIGNED`
  (`hospital.service.ts:801-807`) and computes the real ETA (`:820-827`).
- **Fix:** call `POST /emergency/:id/notify-hospital`, not a raw status PATCH.

---

## 🟠 STRONGLY RECOMMENDED before showcase

### C-error — Prisma `P2003`/`P2025` fall through to a raw 500
- `error-handler.middleware.ts:37-54` only branches on `AppError`; any Prisma error (bad FK
  from `hosp-1`, unknown patient/emergency) becomes `INTERNAL_SERVER_ERROR` 500 instead of a
  clean 400/404.
- **Fix:** in the error handler, detect `Prisma.PrismaClientKnownRequestError` and map
  `P2003`→400, `P2025`→404 before the generic 500.

### C3 — Stale cold-start; no self-contained demo path
- `Front End/active-emergency.json` pins UUID `769a02df-…` with `status: SOS_TRIGGERED`, but
  `seed.ts` seeds patients/ambulances/hospitals and **no emergencies** (grep-confirmed — only
  `hosp-00x` rows). On a fresh seed that UUID 404s → all three apps show "no active emergency"
  until `seed-test-data.js` pokes the DB.
- **Fix:** a cold-start path that doesn't depend on a stale committed JSON + manual DB poke
  (e.g. Patient app SOS drives the whole chain once E1/B1 land, or seed writes a real
  `active-emergency.json`).

### C2 — Patient app hardcodes `patient-arjun-001`, no existence check
- `Patient Side/App.tsx:35`. Matches `seed.ts:23` so it works today, but
  `createEmergencySchema` only checks non-empty string and `emergency.repository.ts:41-63`
  inserts the FK straight from client input — an unknown ID = same unhandled P2003 → 500.

### F2 — Ambulance app swallows all errors silently
- `Ambulance Side/App.tsx:50-51` only `console.error`s. It's the app that hits the most 400s
  (B1/B3) yet shows the user nothing. Patient app uses `setError`, Hospital uses `toast.error`
  — Ambulance should too.

### D2 — Frontend types are loose `string`, not literal unions
- `api.ts:89-90` type `status`/`severity` as plain `string`; `updateStatus` input too. This is
  the root cause that let `"HOSPITAL_REJECTED"`, `"hosp-1"`, and the severity mismatch ship
  with zero compile-time protection.
- **Fix:** literal-union types mirroring the Prisma enums (ideally a shared FE/BE types package).

---

## 🟡 NICE-TO-HAVE

- **E3 — Sockets unused.** `socket.io`/`socket.io-client` are in the backend deps and the P4
  gateway runs (`realtime.service.ts`), but **no frontend has `socket.io-client`**
  (grep-confirmed NONE) — all three still `setInterval(…, 3000)`. Swap polling for the existing
  gateway.
- **E2/F3 — Hospital console shows fabricated data.** `Hospital Side/App.tsx:80-81` hardcodes
  `rank: 1, icon: "activity"`; `:99` vitals are static `{bp:"120/80",…}`. Render real ranked
  candidates from `GET /hospital/:id/requests` instead.
- **F1 — Patient app relative bootstrap fetch.** `Patient Side/App.tsx:58`
  `fetch("/active-emergency.json")` works only via the Vite dev proxy (`vite.config.ts:40`);
  breaks under build/preview/static hosting. The other two use an absolute URL. Also all 3
  proxy `/api`→:3000 but `api.ts:8` hardcodes the absolute URL, so that proxy entry is dead.
- **Minor UX (new find):** in `ScreenPickedUp.tsx` the YELLOW button is labeled "Moderate"
  (`:193`) and GREEN "Stable" (`:207`), but they send `"high"`/`"moderate"` respectively. The
  wire mapping is now correct (high→YELLOW, moderate→GREEN), but the on-screen labels don't
  match the semantic tier — cosmetic, worth aligning for a showcase.

---

## Not bugs (verified OK / intentional)
- **Response envelope** is consistent — all controllers use `successResponse`/`errorResponse`,
  all `api.ts` unwrap `data.data`/`data.error.message`. ✅
- **No auth anywhere; CORS `*` in dev** (`app.ts:30`) — fine for MVP, flagged for completeness.
- **Express pinned to v4** — deliberate guardrail (`validate.middleware` reassigns
  `req.query/params`). Do **not** "upgrade".
- **Backend `Severity` enum** — correctly left as `RED/YELLOW/GREEN`; the fix lives in `api.ts`
  (A1/A2, done).

---

## Minimum path to a working demo (dependency order)
1. **E1** — wire `assign-ambulance` (nothing advances past SOS).
2. **B1** — add "En Route" action → PATCH `AMBULANCE_EN_ROUTE` (also unblocks auto P3).
3. **B2 + C1** — hospital accept/reject via `POST /hospital-response` with real `hosp-0NN` IDs.
4. **B3** — notify via `POST /notify-hospital`.
5. **C-error** — catch Prisma `P2003`→400 / `P2025`→404 so bad input degrades cleanly.
6. **C3** — a cold-start that doesn't depend on the stale JSON.

A1/A2 (severity) are already done. Items 1–4 are the true blockers; 5–6 make it robust and
demoable from a fresh seed.

---

## File-reference index (for the implementer)

**Backend (all under `backend person 1/src/`):**
- Lifecycle map + transitions: `enums/emergency-status.enum.ts:51-102`
- Status write (single source of truth): `services/emergency.service.ts:121-189`
- Validators: `validators/emergency.validator.ts:64-86`, `validators/hospital.validator.ts:27-53`
- Error handler (needs P2003/P2025 mapping): `middleware/error-handler.middleware.ts:37-54`
- P2 assign: `routes/ambulance.routes.ts:31`, `services/ambulance.service.ts:143,219`
- P3 endpoints: `routes/hospital.routes.ts:41-63`; service guards/logic: `services/hospital.service.ts:389,792,873,929-960`
- P4 gateway: `services/realtime.service.ts`; boot: `server.ts:28,31`
- Static-serve for bootstrap JSON: `app.ts:44-46`

**Frontend (`Front End/{Patient,Ambulance,Hospital} Side/src/app/`):**
- Shared client (severity map already added here): `api.ts`
- Patient: `App.tsx:35` (hardcoded patientId), `:58` (relative bootstrap fetch)
- Ambulance: `App.tsx:113` (pickup), `:119-124` (severity + raw notify), `:50-51` (silent errors);
  `components/ScreenEnRoute.tsx:132-145` (only CTA is pickup), `components/ScreenPickedUp.tsx:160,186,200,256-259`
- Hospital: `App.tsx:70` (dead code), `:122` (hosp-1), `:141` (HOSPITAL_REJECTED), `:80-81,99` (mock data)
- Cold-start file: `Front End/active-emergency.json`; seed: `backend person 1/prisma/seed.ts`
