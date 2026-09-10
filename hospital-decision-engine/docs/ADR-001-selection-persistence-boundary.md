# ADR-001: Split the selection engine into a pure reducer + a persistence-port orchestrator

- Status: Accepted (remediation v2.0.0)
- Date: 2026-09-10

## Context
The v1 `HospitalSelectionEngine` held all selection state in a private, in-process
`Map`. An audit proved this fails deterministically across processes: a response
that lands on a second backend instance throws "No selection state for emergency."
It also conflated three separable concerns — the decision, its durability, and its
concurrency — inside one class with no seam to fix any of them.

## Decision
Split selection into two layers:

1. **Pure reducer** (`domain/selection/reducer.ts`): synchronous, deterministic
   functions of `(snapshot, input, now)` → `{ snapshot, decision }`. No I/O, no
   clock reads, no shared state. This is the single home of decision correctness
   and is trivially unit- and property-testable.
2. **Async orchestrator** (`domain/selection/engine.ts`): `load → reduce →
   compareAndSwap` with bounded retry against an injected `SelectionStateStore`
   port. A no-op decision (`stateChanged === false`) skips the write, making
   duplicate/obsolete responses idempotent under retries.

Concurrency responsibility is now explicit:
- **A. determinism** — reducer (proven).
- **B. in-process** — single reduce+CAS cycle.
- **C. persistent atomicity / D. multi-instance** — the store's `compareAndSwap`,
  which Docsahab implements transactionally against Postgres (row-version CAS).
- **E. replay/idempotency** — `decision.stateChanged` gating.

## Consequences
- The engine core imports no infrastructure; the default in-memory store is
  labelled TEST/DEV ONLY.
- Multi-instance safety is now an *achievable integration property* (implement the
  port transactionally) rather than a false in-memory claim.
- Public selection methods became `async` — the in-repo test suite was rewritten
  accordingly. No product behavior changed.
- `REASSIGNED` became a reachable state (set on replacement); `canTransition` is
  now enforced (`assertSelectionTransition`) at every mutation, so it is no longer
  dead code.
