# DOCSAHAB_SECURITY_INTEGRATION_GUIDE.md

This guide is the authoritative integration contract for integrating the
`docsahab-security` subsystem into the existing Docsahab backend.

## Phase 1 — Install/Import the Security Package
```bash
npm install ./security-subsystem
```
```ts
import {
  RequestSecurityProcessor,
  InMemorySessionProvider,
  InMemoryRateLimiter,
  InMemoryAuditLogger,
  validateProductionConfig,
  StateTransitionAuthorizer,
  SensitiveDataPolicy,
  InMemoryIdempotencyStore,
} from 'docsahab-security';
```

## Phase 2 — Connect the Docsahab Identity Source
Implement `AuthenticationProvider` backed by Docsahab's User/Patient/Ambulance/Hospital tables.
Roles and resource associations are ALWAYS resolved from the server-side database, never from the client.

## Phase 3 — Configure Authentication
- DEMO/TEST: `InsecureDemoOTPProvider` (explicit, isolated).
- PRODUCTION: `SecureOTPProvider` or a real provider adapter.
- Configure issuer, audience, session TTL, refresh policy, and rejection of weak secrets.

## Phase 4 — Mount Express Security Middleware
Use `RequestSecurityProcessor`:
```ts
const processor = new RequestSecurityProcessor(sessions, relationshipResolver, limiter, audit);
// In route handler (or your security middleware):
const ctx = await processor.authenticate(req.headers.authorization);
await processor.authorizeAction(ctx, 'ACCEPT_INVITATION');
await processor.authorizeResource(ctx, 'EMERGENCY', emergencyId);
await processor.enforceRateLimit(`accept:${ctx.subjectId}`, 10, 60000);
```

## Phase 5 — Attach RBAC Policies
`ROLE_ACTION_MAP` in `authorization/policy.ts` defines which roles may perform which actions.
Extend the map for new Docsahab roles without weakening existing constraints.

## Phase 6 — Attach Resource Relationship Resolver
Implement `ResourceRelationshipResolver.hasRelationship()` against Docsahab's Prisma models.
Rules MUST be expressed as "identity + role → relationship → resource → allowed action".

## Phase 7 — Protect Emergency Resources
Every emergency endpoint must pass `authorizeResource(ctx, 'EMERGENCY', emergencyId)`.
Never rely on the client-supplied emergency ID alone.

## Phase 8 — Protect State Transitions
Use `StateTransitionAuthorizer.authorizeTransition(ctx, fromState, toState)`.
The security layer authorizes; Docsahab's state machine still owns state transitions.

## Phase 9 — Attach Validation Schemas
Validate all input with the Zod schemas in `validation/schemas.ts`.
Reject NaN, Infinity, oversized payloads, invalid enums, and impossible timestamps.

## Phase 10 — Attach Rate Limiter
- DEVELOPMENT: `InMemoryRateLimiter`.
- PRODUCTION: Redis adapter implementing the `RateLimiter` interface.
Protect OTP, SOS, hospital acceptance/rejection, live-status updates.

## Phase 11 — Attach Persistent Idempotency Store
- DEVELOPMENT: `InMemoryIdempotencyStore`.
- PRODUCTION: Redis/DB adapter implementing `IdempotencyStore`.
Apply to acceptance, rejection, pickup, and lock operations.

## Phase 12 — Attach Audit Logger
- Write every authentication, authorization denial, state mutation, invitation, acceptance, and lock event.
- Never log OTPs, tokens, passwords, auth headers, medical details, or precise location.

## Phase 13 — Protect Socket.IO
At connection time: authenticate the socket; attach the resolved `SecurityContext`.
At every join: `RealtimeAuthorizer.canJoinRoom(ctx, room, resourceType, resourceId)`.
Never allow arbitrary room joins.

## Phase 14 — Apply Role-Specific Output Policies
Use `SensitiveDataPolicy.filterForRole` to build role-appropriate DTOs before returning data.

## Phase 15 — Connect External Provider / Webhook Verification
Use `WebhookVerifier` to authenticate and authorize external hospital-status, live-status,
and provider callbacks. Verify provider identity, signature, timestamp, and event ID.

## Phase 16 — Run Integration Smoke Tests
Run `tests/integration/smoke-harness.test.ts` against the live backend.

## Phase 17 — Run Complete Security Regression Suite
Run `npm test` — every control (auth, RBAC, BOLA, state, realtime, idempotency, config) must pass.

## Phase 18 — Run Final Security Review
Review: production config (`assertSafeStartup`), secret rotation, CORS, cookies, and the audit log.
Classify every control: IMPLEMENTED / PARTIAL / MOCKED / MISSING / NOT PROVEN.