# Docsahab — Patient App

React + Vite + TypeScript, using shadcn/ui. Lets a patient trigger an SOS and track the
emergency through the backend's real lifecycle (ambulance dispatch, hospital assignment,
notification).

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

- There is no auth layer yet: this app acts as one hardcoded demo patient
  (`patient-arjun-001`, matching the backend seed data).
- Severity and status values are typed as literal unions mirroring the backend's Prisma enums
  in `src/app/api.ts` — this is what prevents invalid values from ever reaching the API.
- Updates are via polling (`GET /emergencies/active`, then `GET /emergency/:id` every 3s). The
  backend's Socket.IO gateway exists but is not yet consumed here.
