# Changes To Be Done — Docsahab MVP Readiness

> Deep audit of frontend ↔ backend contract breaks and everything required before the platform
> works end-to-end and is showcase-ready. **Audit-only findings — no code changed.**
> Every claim below was verified directly against source (file:line references included).

---

## 0. Framing — the real state of the project

The backend is checked out on branch **`feature/person4-realtime`**. Verified in `server.ts`:

- `server.ts:28` → `registerHospitalEventHandlers()` — P3 auto hospital-search is live
- `server.ts:31` → `initRealtime(server)` — P4 Socket.IO gateway is live

So the handover docs claiming **P3/P4 are "not built" are STALE.** The backend is ~90% complete.
**The real problem is the inverse:** the 3 frontends were never updated past the original P1-only
contract. Every frontend drives the entire lifecycle through one generic `PATCH /status` call and
never touches the purpose-built P2/P3 endpoints or sockets.

---

## 1. The end-to-end flow is broken in the middle — nothing completes on its own

Tracing a **real** SOS created from the Patient app:

| Step | Should happen | Actually happens |
|---|---|---|
| SOS_TRIGGERED | Patient presses SOS | ✅ Works (`POST /sos`) |
| → AMBULANCE_ASSIGNED | Ambulance matched | ❌ No frontend calls `POST /emergency/:id/assign-ambulance`. Stuck at SOS forever. |
| → AMBULANCE_EN_ROUTE | Dispatch | ❌ No UI triggers this. Auto hospital-search hangs off this event → never fires. |
| → PATIENT_PICKED_UP | Crew taps "Picked Up" | ❌ 400 — illegal jump from ASSIGNED (B1) |
| → SEVERITY_SELECTED | Crew taps severity | ❌ 400 — wrong enum values (A1) |
| → hospital accept | Hospital accepts | ❌ hardcoded bad ID → 500 (C1) |

**Cold-start is worse:** `Front End/active-emergency.json` is committed with a hardcoded UUID
(`769a02df…`) and `status: SOS_TRIGGERED`. `prisma/seed.ts` seeds patients/ambulances/hospitals but
**no emergencies**, so on a fresh seed that UUID doesn't exist → `getEmergency()` 404s → all three
apps show "no active emergency." The apps only come alive after `seed-test-data.js` creates an
emergency and manually pokes the DB. **There is no working demo path driven purely by the UIs.**

---

## A. Severity enum mismatches

### A1 — Ambulance app sends `critical/high/moderate`; backend requires `RED/YELLOW/GREEN` 🔴 Blocks flow
- FE: `Ambulance Side/src/app/components/ScreenPickedUp.tsx:160` `onSeveritySelect?.("critical")`,
  `:186` `("high")`, `:200` `("moderate")` — the RED button literally sends `"critical"`.
- Wired at `Ambulance Side/src/app/App.tsx:119-121` → `updateStatus(..., { severity })`.
- BE: `src/validators/emergency.validator.ts:62,71-75` builds the enum from `Object.values(Severity)`
  = `["RED","YELLOW","GREEN"]`.
- **Effect:** Zod rejects with 400 **before the controller**, so `severity` never saves **and the
  `SEVERITY_SELECTED` transition itself never happens.**
- **Fix:** bidirectional map in `api.ts` — RED↔critical, YELLOW↔high, GREEN↔moderate — on both write
  and read. Never change the backend enum.

### A2 — Hospital app will crash once severity is real 🟠 Latent (unmasked by fixing A1)
- FE: `Hospital Side/src/app/App.tsx:74`
  `emergency.severity?.toLowerCase() ... as "critical"|"high"|"moderate"`. A real `"RED"` → `"red"`.
- `Hospital Side/src/app/components/IncomingQueue.tsx:20-24` keys `severityStyles` only by
  `critical|high|moderate`; `:63` `const s = severityStyles[r.severity]` → `undefined`, then
  `:76` `s.bg` throws `TypeError` → whole console blanks (no error boundary).
- **Fix:** same central mapping (map `RED→critical` etc. on read) so both apps speak one vocabulary.

---

## B. Status / lifecycle mismatches

### B1 — Ambulance app has no `AMBULANCE_EN_ROUTE` action; jumps ASSIGNED→PICKED_UP 🔴 Blocks flow
- FE: `Ambulance Side/src/app/components/ScreenEnRoute.tsx:132-145` — the only CTA is
  "PATIENT PICKED UP" → `App.tsx:113` `handleStatusUpdate("PATIENT_PICKED_UP")`. No element PATCHes
  `AMBULANCE_EN_ROUTE`.
- BE: `src/enums/emergency-status.enum.ts:56-59` — `AMBULANCE_ASSIGNED → [AMBULANCE_EN_ROUTE,
  CANCELLED]` only. `PATIENT_PICKED_UP` is legal **only from `AMBULANCE_EN_ROUTE`** (`:60-64`).
- **Double impact:** `AMBULANCE_EN_ROUTE` also fires auto hospital-search (`hospital.service.ts:939`).
  Skipping it means P3 never auto-runs even though it's fully built.
- **Fix:** add an explicit "Start / En Route" action that PATCHes `AMBULANCE_EN_ROUTE` before pickup.

### B2 — Hospital app writes `HOSPITAL_REJECTED`, which is not a status 🔴 Blocks flow
- FE: `Hospital Side/src/app/App.tsx:141` `updateStatus(..., { status: "HOSPITAL_REJECTED" })`.
- BE: not in the enum → Zod 400. And `App.tsx:70` `if (emergency.status === "HOSPITAL_REJECTED")
  return []` is dead code that can never be true.
- **Fix:** call `POST /emergency/:id/hospital-response` with `{ hospitalId, response: "REJECTED",
  rejectionReason? }` (`hospital.routes.ts:47`). Rejection lives on the candidate, not the emergency
  status — by design.

### B3 — Ambulance "Notify Hospital" can create an inconsistent record 🟠 Latent / data-integrity
- FE: `Ambulance Side/src/app/App.tsx:122-124` raw PATCH to `HOSPITAL_NOTIFIED`.
- `SEVERITY_SELECTED → HOSPITAL_NOTIFIED` *is* legal (`enum:68-70`), so this can succeed even when
  `assignedHospitalId` is `null` and no candidate exists → status says "hospital notified" but no
  hospital is attached.
- The correct endpoint `POST /emergency/:id/notify-hospital` guards this: `hospital.service.ts:801-807`
  throws `NO_HOSPITAL_ASSIGNED`, and also computes the real transport ETA. The generic PATCH bypasses
  both.
- **Fix:** call `notify-hospital`, not a raw status PATCH.

---

## C. Hardcoded / ID mismatches

### C1 — Hospital app hardcodes `assignedHospitalId: "hosp-1"`; seeds are `hosp-001`…`hosp-010` 🔴 Blocks flow
- FE: `Hospital Side/src/app/App.tsx:122`. BE seed confirmed `prisma/seed.ts:97` `id: "hosp-001"`.
- `Emergency.assignedHospitalId` is a real FK → writing `hosp-1` throws Prisma **P2003**, which nothing
  catches → falls to `error-handler.middleware.ts:52` as a **raw 500** (`INTERNAL_SERVER_ERROR`), not a
  clean 400.
- **Fix:** use the real accepting hospital ID (from candidate/console context) via `hospital-response`.
  Separately, catch `P2003` → 400 in the error handler.

### C2 — Patient app hardcodes `patientId: "patient-arjun-001"`; no existence check 🟠 Latent
- FE: `Patient Side/src/app/App.tsx:35`. Matches `seed.ts:23`, so it works today, but it's the single
  hardcoded identity for every user (no auth).
- `createEmergencySchema` only checks non-empty string; `emergency.repository.ts:41-63` inserts the FK
  straight from client input with no `Patient` lookup → unknown ID = same unhandled P2003 → 500.

### C3 — Stale committed `active-emergency.json` 🟠 Onboarding blocker
- `Front End/active-emergency.json` pins a UUID that a fresh `seed.ts` does not create. Every app boots
  to "no active emergency" until `seed-test-data.js` regenerates it. There's no self-contained cold-start.

---

## D. Response envelope / shape

### D1 — Envelope is consistent ✅ Verified OK, not a bug
All controllers use only `successResponse`/`errorResponse` (`api-response.ts`); all 3 `api.ts` unwrap
`data.data` and `data.error.message` (`api.ts:24-27`). Matches. No action needed.

### D2 — Frontend types are `string`, not literal unions 🟠 Root cause of A/B
- `api.ts:89-90` type `status`/`severity` as plain `string`; `updateStatus` input (`api.ts:57-67`) too.
  TypeScript therefore gave zero protection against `"HOSPITAL_REJECTED"`, `"critical"`, `"hosp-1"`.
- **Fix:** shared literal-union types mirroring the Prisma enums (ideally one shared package). This is
  what would have caught A1/B1/B2 at compile time.

---

## E. Fully-built backend that no frontend uses

- **E1 — P2:** `POST /emergency/:id/assign-ambulance` and `GET /ambulances` — never called by any app
  (grep-confirmed). The whole race-safe atomic-assignment engine is unreachable from the UI.
  **This is why the chain dies right after SOS.**
- **E2 — P3:** `find-hospitals`, `hospital-response`, `notify-hospital`, `GET /hospital/:id/requests` —
  never called. The Hospital console fabricates a fake single request from the raw emergency
  (`Hospital Side/App.tsx:80-81` hardcodes `rank: 1, icon: "activity"`) instead of rendering real ranked
  candidates.
- **E3 — P4:** No `socket.io-client` in any frontend `package.json` (grep returned NONE FOUND). All three
  still `setInterval(…, 3000)` poll. The socket gateway runs server-side with zero clients.

---

## F. Other correctness issues

- **F1 — Patient app relative bootstrap fetch 🟠 Latent:** `Patient Side/App.tsx:58`
  `fetch("/active-emergency.json")` works only via the Vite dev proxy (`vite.config.ts:40`); breaks under
  `vite build`/preview/static hosting. The other two apps use an absolute URL (`Ambulance/App.tsx:15`,
  `Hospital/App.tsx:29`). Also all 3 `vite.config.ts` proxy `/api` → :3000, but `api.ts:8` hardcodes the
  absolute URL, so that proxy entry is dead.
- **F2 — Ambulance app swallows all errors silently 🟠 UX:** `Ambulance Side/App.tsx:50-51` only
  `console.error`s. The one app that hits the most 400s (A1+B1) shows the user nothing. Patient app uses
  `setError`, Hospital uses `toast.error` — Ambulance should too.
- **F3 — Hospital console shows fabricated data:** `rank`/`icon` hardcoded (E2); vitals block
  `App.tsx:99` is static `{bp:"120/80",…}`. Cosmetic but misleading for a showcase.
- **F4 — No auth anywhere; CORS `*` in dev** (`app.ts:30`). Fine for MVP demo, flagged for completeness.
- **F5 — Express pinned to v4 on purpose** (`validate.middleware` reassigns `req.query/params`). Not a
  bug — a guardrail. Do NOT "upgrade" it.

---

## MVP fix checklist (in dependency order)

### Must-fix — required for a working end-to-end demo
1. **Wire ambulance assignment** — call `POST /emergency/:id/assign-ambulance` (nothing advances past SOS). *[E1]*
2. **Add an "En Route" action** in the ambulance app → PATCH `AMBULANCE_EN_ROUTE` before pickup *[B1]*
   (also unblocks auto hospital-search).
3. **Fix severity mapping** (bidirectional RED↔critical etc.) in `api.ts`. *[A1, A2]*
4. **Hospital accept/reject** → use `POST /hospital-response` with real `hosp-0NN` IDs, not status writes
   with `hosp-1`. *[B2, C1]*
5. **Notify** → use `POST /notify-hospital`, not a raw status PATCH. *[B3]*

### Strongly recommended before showcase
6. Cold-start path that doesn't depend on a stale JSON + manual DB pokes. *[C3]*
7. Surface errors in the ambulance app (toast/inline). *[F2]*
8. Catch Prisma `P2003` → 400 in the error handler. *[C1, C2]*
9. Shared literal-union types for status/severity. *[D2]*

### Nice-to-have
10. Swap 3s polling for the existing Socket.IO gateway. *[E3]*
11. Fix Patient app's relative bootstrap fetch. *[F1]*
12. Replace hardcoded hospital-console mock data with real candidates. *[E2, F3]*

---

*Generated from a read-only audit. No source files were modified.*
