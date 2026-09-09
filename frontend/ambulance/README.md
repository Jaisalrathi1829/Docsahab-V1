# Docsahab — Ambulance App

React + Vite + TypeScript, using shadcn/ui. The ambulance crew console: dispatch (en route),
patient pickup, severity triage, and hospital notification.

Part of the [Docsahab](../../README.md) monorepo — see the root README for overall
architecture and setup, and
[`docs/DOCSAHAB_CURRENT_STATE_AUDIT.md`](../../docs/DOCSAHAB_CURRENT_STATE_AUDIT.md) for the
current, verified state of the frontend↔backend integration.

## Run

```bash
npm install
npm run dev
```

Connects to the backend at `http://localhost:3000/api/v1` — start `../../backend` first.

## Notes

- Discovers the in-progress emergency via `GET /emergencies/active` **once, on mount** — if
  this app is opened before an emergency exists, refresh it after triggering an SOS from the
  Patient app. See the current-state audit for the exact behavior and fix options.
- Action buttons are guarded by the emergency's actual current status (e.g. "Patient Picked Up"
  is disabled unless the ambulance is en route or a hospital has already accepted early) — they
  are not just decorative; they reflect the backend's real state machine.
- "Notify Hospital" calls the dedicated `POST /emergency/:id/notify-hospital` endpoint (not a
  raw status update), so it's disabled until both severity and an assigned hospital exist.
