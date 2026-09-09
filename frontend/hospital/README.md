# Docsahab — Hospital App

React + Vite + TypeScript, using shadcn/ui. The hospital console: a real ranked queue of
incoming acceptance requests, with accept/decline driving the backend's actual hospital
acceptance workflow.

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

- There is no auth layer yet: this console is pinned to one real seeded hospital
  (`hosp-001`, AIIMS Delhi) — acceptance writes a genuine foreign key, so this must stay a real
  seeded ID.
- The incoming queue is the backend's actual ranked candidate list
  (`GET /hospital/:hospitalId/requests`), not mock data — capability match, ETA, and resource
  scoring all come from the Hospital Ranking module.
- Accept/decline go through `POST /emergency/:id/hospital-response`, which is transactional and
  idempotent on the backend (handles the atomic first-accept claim, locking after patient
  pickup, and late-acceptance edge cases).
- The "accepted cases" panel is kept as a separate snapshot rather than derived from the
  pending queue — an accepted request leaves the pending inbox immediately, so deriving it from
  the live queue would make it vanish on success.
