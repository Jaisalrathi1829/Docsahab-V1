# Changes Done — Docsahab MVP Fixes

> Tracks what has actually been implemented from `changes to be done.md`, with exact
> file/line references and the reasoning behind each change. Update this file as more
> items from the fix checklist are completed — don't create a second log.

---

## ✅ Fixed: A1 / A2 — Severity enum mismatch (`RED/YELLOW/GREEN` ↔ `critical/high/moderate`)

**Problem (from the audit):**
- Backend `Severity` enum (Prisma/DB) is `RED | YELLOW | GREEN`.
- All three frontends send/read `critical | high | moderate`.
- Ambulance app's severity buttons (`ScreenPickedUp.tsx`) sent `"critical"/"high"/"moderate"`
  straight to the backend → Zod validation rejected it with a 400 **before the controller**,
  so `SEVERITY_SELECTED` never actually happened. This is what stalled the entire lifecycle
  after ambulance pickup.
- Hospital app's `IncomingQueue.tsx` keyed a `severityStyles` lookup only by
  `critical|high|moderate` — once a real `"RED"` value arrived it would resolve to
  `undefined` and throw a `TypeError` on `.bg`, blanking the whole console.

**Fix chosen:** the audit's recommended fix, **not** touching the backend enum (per
`CLAUDE.md`'s explicit "Never change" rule — `Severity = RED/YELLOW/GREEN` is a DB enum;
changing it needs a migration and touches validators/seed/hospital-ranking logic across the
backend). Instead: translate at the network boundary, in each frontend's `api.ts`, so the
backend never sees frontend vocabulary and no UI component needs to change.

### What was changed

All three of these files are byte-identical copies (per `CLAUDE.md`'s documented project
layout) and got the **same edit**:

- `Front End/Ambulance Side/src/app/api.ts`
- `Front End/Hospital Side/src/app/api.ts`
- `Front End/Patient Side/src/app/api.ts`

**1. Added a translation layer** (new code, inserted right after the generic `api()` fetch
wrapper, before the exported endpoint functions — lines ~30–55 in each file):

```ts
const SEVERITY_TO_BACKEND: Record<string, string> = {
  critical: "RED",
  high: "YELLOW",
  moderate: "GREEN",
};

const SEVERITY_FROM_BACKEND: Record<string, string> = {
  RED: "critical",
  YELLOW: "high",
  GREEN: "moderate",
};

function toBackendSeverity(severity: string): string {
  return SEVERITY_TO_BACKEND[severity] ?? severity;
}

function fromBackendSeverity<T extends { severity?: string | null }>(entity: T): T {
  if (!entity?.severity) return entity;
  return { ...entity, severity: SEVERITY_FROM_BACKEND[entity.severity] ?? entity.severity };
}
```

**2. Applied it on the three functions that carry `severity` across the wire:**

- **`createEmergency()`** — response now passed through `fromBackendSeverity()` before
  returning, so any `severity` the backend sends back is already translated to frontend
  vocabulary.
- **`getEmergency()`** — same: response wrapped in `fromBackendSeverity()`.
- **`updateStatus()`** — this is the **write** path (used by the Ambulance app's severity
  buttons and the Hospital app's status updates). Before sending, if `input.severity` is
  present it's translated via `toBackendSeverity()` into a new body object; the response is
  then also translated back via `fromBackendSeverity()` for symmetry.

```ts
export async function updateStatus(id: string, input: {...}) {
  const body = input.severity ? { ...input, severity: toBackendSeverity(input.severity) } : input;
  const emergency = await api("PATCH", `/emergency/${id}/status`, body);
  return fromBackendSeverity(emergency);
}
```

### Why this closes both A1 and A2

- **A1 (Ambulance app 400 on severity):** `ScreenPickedUp.tsx` still calls
  `onSeveritySelect?.("critical")` etc. unchanged; `App.tsx` still calls
  `handleStatusUpdate("SEVERITY_SELECTED", { severity })` unchanged. The translation now
  happens invisibly inside `updateStatus()`, so the backend receives `"RED"` and the Zod
  validator (which builds its enum from `Object.values(Severity)`) accepts it. The
  `SEVERITY_SELECTED` transition now actually fires, which also unblocks the auto
  hospital-search that's wired to fire off that event (per the audit's B1 note).
- **A2 (Hospital app latent crash):** `Hospital Side/App.tsx:74` does
  `emergency.severity?.toLowerCase()` — since `getEmergency()` now returns an already-
  translated `"critical"/"high"/"moderate"` string, `.toLowerCase()` is a harmless no-op on
  an already-lowercase string, and `IncomingQueue.tsx`'s `severityStyles[r.severity]` lookup
  resolves correctly instead of hitting `undefined`. Verified this call site directly before
  finishing — no other change needed there.

### Not changed (intentionally)

- Backend `Severity` enum, validators, Prisma schema — untouched, per `CLAUDE.md`.
- Every UI component that reads/writes `critical/high/moderate` (`ScreenPickedUp.tsx`,
  `ScreenEnRoute.tsx`, `IncomingQueue.tsx`, `RequestDetails.tsx`, `ActionPanel.tsx`) —
  untouched. They keep speaking frontend vocabulary; the seam is entirely inside `api.ts`.

### Verification status

- No backend files touched, so no backend test/typecheck impact.
- Could **not** run a frontend typecheck — these Vite apps have no `tsc`/typecheck script
  (`package.json` only defines `build`/`dev`) and no local `typescript` binary is installed
  in `node_modules`. Recommended before demo: `npm run build` in each of the three
  `Front End/*/` apps as a build-level sanity check.
- Manually re-read the edited `Ambulance Side/src/app/api.ts` after the edit to confirm the
  translation functions and their call sites are correctly wired (see excerpt above).

---

## Still open (from `changes to be done.md`)

Everything else in the MVP fix checklist is untouched so far:

- **B1** — Ambulance app has no `AMBULANCE_EN_ROUTE` action (skips straight from
  ASSIGNED → PICKED_UP).
- **B2** — Hospital app writes fake status `HOSPITAL_REJECTED` instead of calling
  `hospital-response`.
- **B3** — Ambulance app's "Notify Hospital" bypasses the real `notify-hospital` endpoint.
- **C1** — Hospital app hardcodes `hosp-1` instead of a real seeded `hosp-0NN` ID.
- **C2** — Patient app hardcodes `patient-arjun-001` with no existence check.
- **C3** — Stale committed `active-emergency.json` blocks a self-contained cold start.
- **E1** — No frontend calls `POST /assign-ambulance` (nothing advances past SOS).
- **E2** — No frontend calls the P3 hospital endpoints (`find-hospitals`, `hospital-response`,
  `notify-hospital`, `GET /hospital/:id/requests`).
- **E3** — No frontend uses the Socket.IO gateway; all three still poll every 3s.
- **D2** — Frontend types are loose `string`, not literal unions mirroring the Prisma enums.
- **F1–F5** — Patient app's relative bootstrap fetch, Ambulance app swallowing errors
  silently, Hospital console's fabricated mock data, no-auth/CORS-`*` (informational), and
  the Express-v4 pin (informational, not a bug).

See `changes to be done.md` for full detail and the priority order.
