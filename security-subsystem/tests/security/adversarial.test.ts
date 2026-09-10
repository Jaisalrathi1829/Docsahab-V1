import {
  AuthenticationProvider,
  InsecureDemoOTPProvider,
  SecureOTPProvider,
  InMemorySessionProvider,
  StateTransitionAuthorizer,
  InMemoryRateLimiter,
  InMemoryIdempotencyStore,
  RequestSecurityProcessor,
  InMemoryAuditLogger,
  authorizeByRole,
  SecurityContext,
  ServiceIdentityVerifier,
  StaticServiceIdentityRegistry,
} from '../../src/index';

describe('Adversarial Security Tests', () => {
  test('Identity forgery: client cannot assert arbitrary role', () => {
    const patientContext: SecurityContext = {
      subjectId: 'P1',
      role: 'PATIENT',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'OTP',
    };
    const hospitalAction = authorizeByRole(patientContext, 'UPDATE_OWN_LIVE_STATUS');
    expect(hospitalAction.allowed).toBe(false);
  });

  test('Role forgery: ambulance cannot act as hospital', () => {
    const ambulanceContext: SecurityContext = {
      subjectId: 'AMB-1',
      role: 'AMBULANCE',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'OTP',
    };
    expect(authorizeByRole(ambulanceContext, 'ACCEPT_INVITATION').allowed).toBe(false);
    expect(authorizeByRole(ambulanceContext, 'REJECT_INVITATION').allowed).toBe(false);
  });

  test('Role forgery: hospital cannot create patient SOS', () => {
    const hospitalContext: SecurityContext = {
      subjectId: 'HOSP-1',
      role: 'HOSPITAL',
      hospitalId: 'H-1',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'OTP',
    };
    expect(authorizeByRole(hospitalContext, 'CREATE_SOS').allowed).toBe(false);
  });

  test('Emergency ID guessing fails without relationship', async () => {
    const sessions = new InMemorySessionProvider();
    const processor = new RequestSecurityProcessor(
      sessions,
      {
        async hasRelationship(context: SecurityContext, _resourceType: string, resourceId: string) {
          return context.subjectId === 'P2' && resourceId === 'EMG-2';
        },
      },
      new InMemoryRateLimiter(),
      new InMemoryAuditLogger()
    );
    const context: SecurityContext = {
      subjectId: 'P2',
      role: 'PATIENT',
      patientId: 'EMG-2',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'OTP',
    };
    await sessions.createSession(context, 3600000);
    await expect(
      processor.authorizeResource(context, 'EMERGENCY', 'EMG-999')
    ).rejects.toThrow('Resource access denied');
  });

  test('Hospital lock cannot be bypassed to reassign', () => {
    const authorizer = new StateTransitionAuthorizer();
    const ambulance: SecurityContext = {
      subjectId: 'AMB-1',
      role: 'AMBULANCE',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'OTP',
    };
    const reassignAfterLock = authorizer.authorizeTransition(ambulance, 'HOSPITAL_LOCKED', 'TEMPORARY_ASSIGNMENT');
    expect(reassignAfterLock.allowed).toBe(false);
  });

  test('Duplicate SUCCESSFUL privileged event is blocked by idempotency', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.isDuplicate('acceptance-evt-42', 'HOSPITAL_ACCEPTANCE')).toBe(false);
    await store.markProcessed('acceptance-evt-42', 'HOSPITAL_ACCEPTANCE');
    expect(await store.isDuplicate('acceptance-evt-42', 'HOSPITAL_ACCEPTANCE')).toBe(true);
  });

  test('OTP brute-force is rate limited', async () => {
    const limiter = new InMemoryRateLimiter();
    const key = 'otp:9999999999';
    let allowedCount = 0;
    let blocked = false;
    for (let i = 0; i < 6; i++) {
      const r = await limiter.consume(key, 5, 60000);
      if (r.allowed) allowedCount++;
      else blocked = true;
    }
    expect(allowedCount).toBe(5);
    expect(blocked).toBe(true);
  });

  test('Demo OTP is isolated and MUST NOT silently power production', () => {
    const demo = new InsecureDemoOTPProvider();
    const secure = new SecureOTPProvider();
    expect(demo.generateOtp()).toBe('123456');
    const secureOtp = secure.generateOtp();
    expect(secureOtp).toMatch(/^\d{6}$/);
    expect(secureOtp).not.toBe('123456');
  });

  test('Revoked session cannot authenticate', async () => {
    const sessions = new InMemorySessionProvider();
    const record = await sessions.createSession(
      {
        subjectId: 'P1',
        role: 'PATIENT',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        authMethod: 'OTP',
      },
      3600000
    );
    expect(await sessions.validate(record.sessionId)).not.toBeNull();
    await sessions.revoke(record.sessionId);
    expect(await sessions.validate(record.sessionId)).toBeNull();
  });

  test('Expired session cannot authenticate', async () => {
    const sessions = new InMemorySessionProvider();
    const record = await sessions.createSession(
      {
        subjectId: 'P1',
        role: 'PATIENT',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        authMethod: 'OTP',
      },
      -1000
    );
    expect(await sessions.validate(record.sessionId)).toBeNull();
  });

  test('Unknown service identity fails closed', () => {
    const verifier = new ServiceIdentityVerifier(new StaticServiceIdentityRegistry(new Map()));
    const result = verifier.verify('unknown-svc', 'sig', Date.now(), 'body', 60000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unknown');
  });

  test('Replayed acceptance does not change state twice', async () => {
    const store = new InMemoryIdempotencyStore();
    const key = 'acceptance-candidate-7';
    const first = !(await store.isDuplicate(key, 'HOSPITAL_ACCEPTANCE'));
    if (first) await store.markProcessed(key, 'HOSPITAL_ACCEPTANCE');
    const second = await store.isDuplicate(key, 'HOSPITAL_ACCEPTANCE');
    expect(second).toBe(true);
  });

  test('Patient cannot set hospital-assignment fields', () => {
    const patient: SecurityContext = {
      subjectId: 'P1',
      role: 'PATIENT',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      authMethod: 'OTP',
    };
    expect(authorizeByRole(patient, 'SET_SEVERITY').allowed).toBe(false);
    expect(authorizeByRole(patient, 'UPDATE_EMERGENCY_FIELD').allowed).toBe(false);
  });

  test('Rate limit flood on sensitive endpoint blocks', async () => {
    const limiter = new InMemoryRateLimiter();
    const key = 'sos:1.2.3.4';
    let blockedCount = 0;
    for (let i = 0; i < 30; i++) {
      const r = await limiter.consume(key, 10, 60000);
      if (!r.allowed) blockedCount++;
    }
    expect(blockedCount).toBe(20);
  });
});