# Trust Boundaries

## Boundary Model

| Component | Trust Level | Auth Requirement | Notes |
|-----------|-------------|------------------|-------|
| Patient frontend | UNTRUSTED | OTP/session | Must not self-assign roles |
| Ambulance frontend | UNTRUSTED | OTP/session | Must not self-attach to emergency |
| Hospital frontend/extension | UNTRUSTED | OTP/session + hospital association | Must only touch own hospital resources |
| Admin tools | PARTIALLY TRUSTED | Admin session + audit | Elevated actions audited |
| Browser/mobile client | UNTRUSTED | — | Never trust client identity/role/ownership |
| Docsahab API | TRUSTED (within boundary) | Service identity where needed | Owns orchestration; delegates decisions |
| Realtime server | TRUSTED | Socket auth → room auth | Must authorize every join/broadcast |
| Hospital engine | TRUSTED internal | Service identity | Security sits BEFORE the engine; security does NOT change decision logic |
| Hospital-status provider | PARTIALLY TRUSTED | Webhook/signature | External; signed callbacks only |
| ETA provider | PARTIALLY TRUSTED | Service credential | Read-only routing data |
| OTP provider | PARTIALLY TRUSTED | Provider credential | Must not log OTPs |
| Database (PostgreSQL) | TRUSTED | App credentials | Owned by Docsahab |
| Redis/distributed store | TRUSTED | App credentials | Owned by Docsahab; never in-memory-only in production |
| External hospital system | UNTRUSTED | Signature verification | Webhook contract enforced |

## Boundary Requirements Checklist

For every boundary, enforce:
1. Authentication — who is calling.
2. Authorization — may they perform THIS action on THIS resource.
3. Validation — input is well formed.
4. Integrity — payload/signature verified.
5. Confidentiality — only consenting data flows.
6. Replay protection — timestamp + event ID + idempotency.
7. Audit — every sensitive decision is recorded.