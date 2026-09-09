# Docsahab Integration Guide

This guide outlines how to integrate the standalone Hospital Decision Engine into the Docsahab backend.

## 1. Domain Boundaries
The standalone engine owns the core decision logic:
- Requirements matching and eligibility filtering
- Multi-factor scoring and deterministic ranking
- Top-N invitation generation
- Response evaluation, temporary assignment, and pickup lock enforcement

The Docsahab application owns:
- Persistence (Prisma / PostgreSQL models for Emergency, TimelineEvent, Hospital, Candidate)
- Orchestration and network dispatching (WebSockets, push notifications, HTTP APIs)
- State progression of Patient and Ambulance lifecycles

## 2. Ports Implementation
Docsahab implements the following port interfaces:
- **HospitalProfileProvider**: Reads hospital profiles from the database.
- **HospitalLiveStatusProvider**: Reads and updates dynamic operational states.
- **ETAProvider**: Adapts routing providers (e.g., Google Maps, Mapbox, or Haversine).
- **HospitalInvitationDispatcher**: Dispatches invitations to hospitals over WebSockets or notification systems.
- **ClockProvider**: Provides current system time.

## 3. Workflow Sequence
1. Ambulance transitions to `AMBULANCE_EN_ROUTE_TO_PATIENT`.
2. Docsahab constructs `EmergencyRequirement` from structured emergency data and ambulance location.
3. Docsahab calls `HospitalRankingEngine.rankHospitals()`.
4. Docsahab persists candidates and passes the top candidates to `HospitalSelectionEngine.initializeSelection()`.
5. External dispatcher sends parallel invitations to candidates.
6. When a hospital responds (ACCEPT/REJECT), Docsahab forwards the response to `HospitalSelectionEngine.processResponse()`.
7. Docsahab persists temporary assignment or reassignment updates and broadcasts timeline events.
8. At ambulance arrival/pickup, Docsahab invokes `HospitalSelectionEngine.processPickup()`, permanently locking the destination hospital.
