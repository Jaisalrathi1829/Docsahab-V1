# Security Architecture Decision Record (ADR) - Docsahab

## 1. Authentication Mechanism & Session/Token Model
- **Chosen Approach**: Pluggable authentication supporting opaque session identifiers and cryptographically signed JWTs, with explicit SessionStore and TokenProvider abstraction interfaces.
- **Alternatives Considered**: Stateless JWT only (risk of inability to revoke instantly), sticky session cookies only (scaling limits in distributed setups).
- **Why Chosen**: Balances immediate revocation capability via sessions/store with high-performance stateless verification where appropriate.
- **Threat Model Impact**: Mitigates token theft, session fixation, and unrevoked compromised sessions.

## 2. Role Source of Truth & Identity Lifecycle
- **Chosen Approach**: Server-side authoritative roles and resource associations (Patient, Ambulance/Medic, Hospital, System/Admin). Client cannot self-assign roles.
- **Alternatives Considered**: Client-asserted JWT claims for roles.
- **Why Chosen**: Prevents privilege escalation and role forgery.

## 3. Authorization Model & Resource-Level Authorization (BOLA/IDOR Defense)
- **Chosen Approach**: Explicit policy engine combined with dynamic ResourceRelationshipResolver evaluating identity, role, and relationship to the resource.
- **Alternatives Considered**: Endpoint-only checks without object relationship validation.
- **Why Chosen**: Hard defense against BOLA/IDOR.

## 4. Rate Limiting & Idempotency
- **Chosen Approach**: Abstracted rate limiter and idempotency store with in-memory development adapters and Redis production adapters.
- **Alternatives Considered**: Hardcoded in-memory limits.
- **Why Chosen**: Allows distributed production deployments without coupling core security to Redis.

## 5. Audit Logging
- **Chosen Approach**: Structured, strongly-typed audit logger with mandatory redaction for secrets, tokens, raw OTPs, and sensitive medical data.
- **Alternatives Considered**: Unstructured console.log.
- **Why Chosen**: Compliance, tamper-evidence, and security incident forensics.
