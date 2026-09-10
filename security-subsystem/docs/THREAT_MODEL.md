# Docsahab Threat Model

## Actors

- Malicious patient
- Malicious ambulance user
- Malicious hospital user
- Compromised account
- Stolen credential/session
- Unauthorized client
- Malicious external provider
- Malicious internal service
- Replay attacker
- Automated abuse client

## Threats

| # | Threat | Asset | Attack Path | Control | Severity | Test Coverage |
|---|--------|-------|-------------|---------|----------|---------------|
| 1 | IDOR/BOLA | emergency, invitation, live status | Guess IDs; access by ID | ResourceRelationshipResolver | HIGH | adversarial + smoke |
| 2 | Privilege escalation | admin/system | Client-asserted role | Role-action map; server-side identity | CRITICAL | adversarial |
| 3 | Identity forgery | session | Fake identity claim | AuthenticationProvider; ServiceIdentityVerifier | CRITICAL | adversarial |
| 4 | Role forgery | role | Forge role claim | authorizeByRole against server context | CRITICAL | adversarial |
| 5 | Account takeover | account | Reused/guessed OTP | OTP TTL, brute-force limit, invalidation | HIGH | adversarial |
| 6 | Token/session theft | session | Leakage in logs/headers | Never log tokens; short TTL; revoke | HIGH | audit redaction |
| 7 | Replay | acceptance, pickup, webhook | Replay signed request | IdempotencyStore; WebhookVerifier | HIGH | adversarial + webhook tests |
| 8 | Cross-emergency access | emergency | Wrong relationship | hasRelationship | CRITICAL | smoke |
| 9 | State manipulation | lifecycle | Direct status write | StateTransitionAuthorizer | HIGH | adversarial |
| 10 | Hospital-status manipulation | live status | Unauthorized update | own-hospital relationship | HIGH | smoke |
| 11 | Unauthorized hospital acceptance | invitation | Accept others' invitation | invitation relationship + idempotency | HIGH | smoke |
| 12 | Locked-destination modification | destination | Post-lock change | StateTransitionAuthorizer | CRITICAL | adversarial |
| 13 | Sensitive-data leakage | medical/location | Oversized DTOs | SensitiveDataPolicy | HIGH | smoke |
| 14 | Rate-limit bypass | abuse control | Distributed/forged IP | Bucket per actor+resource | MEDIUM | adversarial |
| 15 | Secret leakage | secrets | Logs, source control | No secret logging; env config | CRITICAL | config tests |
| 16 | Insecure config | production | Demo OTP/wildcard CORS | assertSafeStartup | CRITICAL | config tests |
| 17 | Realtime room injection | socket rooms | Join arbitrary room | RealtimeAuthorizer | HIGH | smoke |
| 18 | Websocket flood | realtime | Event flood | socket rate limit | MEDIUM | rate-limit tests |
| 19 | Malformed input | API | NaN/Infinity/bad enums | Zod schemas | MEDIUM | validation coverage* |
| 20 | Inner-service impersonation | internal API | Forged service call | ServiceIdentityVerifier | HIGH | adversarial |

\* Validation schema negative cases are contractually enforced at integration time per the integration guide (validation adapter responsibility).