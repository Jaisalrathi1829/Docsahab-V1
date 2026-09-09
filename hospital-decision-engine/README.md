# Docsahab Core Hospital Decision Engine

A standalone, deterministic, explainable, strongly typed, modular, testable, concurrency-safe, data-freshness-aware TypeScript decision engine for hospital emergency coordination in Docsahab.

## What It Is
An operational decision subsystem responsible for filtering, ranking, selecting, and managing hospital assignments during emergency medical progression.

## What It Is Not
- Not an ambulance booking app
- Not a hospital directory
- Not an AI/ML/LLM model
- Not a clinical diagnosis engine
- Not persistence-bound or HTTP framework-bound

## Architecture
- **Domain Core**: Pure domain models, rules, policies, ranking calculation, and selection state machine (free of infrastructure and HTTP frameworks).
- **Ports (Interfaces)**: Abstractions for HospitalProfileProvider, HospitalLiveStatusProvider, ETAProvider, InvitationDispatcher, and ClockProvider.
- **Infrastructure (In-Memory)**: Reference implementations for testing and local simulation.

## Ranking Process
1. Retrieve hospital profiles and live statuses.
2. Validate data freshness (FRESH vs STALE vs EXPIRED).
3. Calculate emergency-specific ETA via ETAProvider.
4. Apply hard eligibility filters (mandatory capabilities, department status, accepting status, max ETA/distance).
5. Score eligible hospitals using weighted normalized factors (Default: Capability 50%, ETA 30%, Resources 20%).
6. Rank deterministically (with tie-breaking).
7. Produce Top-N candidates.

## Selection Lifecycle
- **SEARCHING -> INVITED -> TEMPORARILY_ASSIGNED -> REASSIGNED -> LOCKED -> EXHAUSTED**
- Candidate States: **PENDING -> ACCEPTED -> REJECTED -> SUPERSEDED -> LOCKED -> EXPIRED**
- Pre-pickup: Better-ranked acceptance replaces current temporary assignment. Lower-ranked acceptance cannot replace a higher assignment.
- Patient Pickup: Irreversibly locks the current assigned hospital. Post-pickup responses cannot reassign.

## Concurrency & Idempotency
Handles simultaneous hospital responses, out-of-order deliveries, duplicate accepts/rejections, and state transitions deterministically through version-safe candidate state validation.

## Why AI is Excluded
Enforces strict deterministic rules, explainability, auditability, and reproducible decisions without opaque probabilistic black-box ranking.
