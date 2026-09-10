import {
  SecurityContext,
  ResourceRelationshipResolver,
  ResourceType,
  InMemorySessionProvider,
  InMemoryRateLimiter,
  InMemoryAuditLogger,
  RequestSecurityProcessor,
  RealtimeAuthorizer,
  StateTransitionAuthorizer,
  SensitiveDataPolicy,
  InMemoryIdempotencyStore,
  authorizeByRole,
} from '../../src/index';

const patientCtx = (id: string, patientId: string): SecurityContext => ({
  subjectId: id,
  role: 'PATIENT',
  patientId,
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
  authMethod: 'OTP',
});

const ambulanceCtx = (id: string): SecurityContext => ({
  subjectId: id,
  role: 'AMBULANCE',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
  authMethod: 'OTP',
});

const hospitalCtx = (id: string, hospitalId: string): SecurityContext => ({
  subjectId: id,
  role: 'HOSPITAL',
  hospitalId,
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
  authMethod: 'OTP',
});

const createResolver = (assignments: Record<string, string>): ResourceRelationshipResolver => ({
  async hasRelationship(context: SecurityContext, resourceType: ResourceType, resourceId: string): Promise<boolean> {
    if (resourceType === 'EMERGENCY') {
      if (context.role === 'PATIENT' && context.patientId === resourceId) return true;
      if (context.role === 'AMBULANCE' && assignments[resourceId] === context.subjectId) return true;
      if (context.role === 'HOSPITAL' && assignments[resourceId] === context.hospitalId) return true;
    }
    if (resourceType === 'HOSPITAL') {
      return context.hospitalId === resourceId;
    }
    return false;
  },
});

describe('Docsahab Security Integration Smoke Harness', () => {
  test('1. Authenticated patient can access own emergency', async () => {
    const resolver = createResolver({});
    const has = await resolver.hasRelationship(patientCtx('P1', 'EMG-1'), 'EMERGENCY', 'EMG-1');
    expect(has).toBe(true);
  });

  test('2. Patient cannot access another emergency', async () => {
    const resolver = createResolver({});
    const has = await resolver.hasRelationship(patientCtx('P1', 'EMG-1'), 'EMERGENCY', 'EMG-2');
    expect(has).toBe(false);
  });

  test('3. Assigned ambulance can access its emergency', async () => {
    const resolver = createResolver({ 'EMG-1': 'AMB-9' });
    const has = await resolver.hasRelationship(ambulanceCtx('AMB-9'), 'EMERGENCY', 'EMG-1');
    expect(has).toBe(true);
  });

  test('4. Unassigned ambulance cannot', async () => {
    const resolver = createResolver({ 'EMG-1': 'AMB-9' });
    const has = await resolver.hasRelationship(ambulanceCtx('AMB-2'), 'EMERGENCY', 'EMG-1');
    expect(has).toBe(false);
  });

  test('5. Authorized hospital can access its invitation', async () => {
    const resolver = createResolver({ 'EMG-1': 'H-1' });
    const has = await resolver.hasRelationship(hospitalCtx('HOSP-1', 'H-1'), 'EMERGENCY', 'EMG-1');
    expect(has).toBe(true);
  });

  test('6. Unauthorized hospital cannot', async () => {
    const resolver = createResolver({ 'EMG-1': 'H-1' });
    const has = await resolver.hasRelationship(hospitalCtx('HOSP-2', 'H-2'), 'EMERGENCY', 'EMG-1');
    expect(has).toBe(false);
  });

  test('7. Hospital can update only own live status', async () => {
    const resolver = createResolver({});
    const own = await resolver.hasRelationship(hospitalCtx('HOSP-1', 'H-1'), 'HOSPITAL', 'H-1');
    const other = await resolver.hasRelationship(hospitalCtx('HOSP-1', 'H-1'), 'HOSPITAL', 'H-2');
    expect(own).toBe(true);
    expect(other).toBe(false);
  });

  test('8. Role escalation fails', async () => {
    const patient = patientCtx('P1', 'EMG-1');
    const result = authorizeByRole(patient, 'ACCEPT_INVITATION');
    expect(result.allowed).toBe(false);
  });

  test('9. Invalid state mutation fails', async () => {
    const authorizer = new StateTransitionAuthorizer();
    const ambulance = ambulanceCtx('AMB-1');
    const result = authorizer.authorizeTransition(ambulance, 'EMERGENCY_CREATED', 'HOSPITAL_LOCKED');
    expect(result.allowed).toBe(false);
  });

  test('10. Locked destination cannot change', async () => {
    const authorizer = new StateTransitionAuthorizer();
    const ambulance = ambulanceCtx('AMB-1');
    const result = authorizer.authorizeTransition(ambulance, 'HOSPITAL_LOCKED', 'TEMPORARY_ASSIGNMENT');
    expect(result.allowed).toBe(false);
  });

  test('11. Sensitive output is role-filtered', async () => {
    const policy = new SensitiveDataPolicy();
    const data = { name: 'Jane', preciseLocation: { lat: 1, lng: 2 }, allergies: ['penicillin'] };
    const hospitalView = policy.filterForRole(data, 'HOSPITAL', [
      { dataField: 'preciseLocation', sensitiveField: 'PRECISE_LOCATION' },
      { dataField: 'allergies', sensitiveField: 'ALLERGIES' },
    ]);
    expect(hospitalView).toHaveProperty('allergies');
    expect(hospitalView).not.toHaveProperty('preciseLocation');
  });

  test('12. Audit events are generated', async () => {
    const logger = new InMemoryAuditLogger();
    await logger.log({ actorId: 'P1', actorRole: 'PATIENT', action: 'READ_OWN_EMERGENCY', resourceType: 'EMERGENCY', resourceId: 'EMG-1', outcome: 'SUCCESS' });
    expect(logger.getEvents().length).toBe(1);
  });

  test('13. Rate limits activate', async () => {
    const limiter = new InMemoryRateLimiter();
    const key = `otp:1234567890`;
    let blocked = false;
    for (let i = 0; i < 5; i++) {
      const r = await limiter.consume(key, 3, 60000);
      if (!r.allowed) blocked = true;
    }
    expect(blocked).toBe(true);
  });

  test('14. Replay/idempotency controls activate', async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.isDuplicate('evt-1', 'ACCEPTANCE')).toBe(false);
    await store.markProcessed('evt-1', 'ACCEPTANCE');
    expect(await store.isDuplicate('evt-1', 'ACCEPTANCE')).toBe(true);
  });

  test('15. Realtime room authorization works', async () => {
    const resolver = createResolver({ 'EMG-1': 'AMB-9' });
    const limiter = new InMemoryRateLimiter();
    const authz = new RealtimeAuthorizer(resolver, limiter);
    expect(await authz.canJoinRoom(ambulanceCtx('AMB-9'), 'emg-1', 'EMERGENCY', 'EMG-1')).toBe(true);
    expect(await authz.canJoinRoom(ambulanceCtx('AMB-2'), 'emg-1', 'EMERGENCY', 'EMG-1')).toBe(false);
  });

  test('16. Alternate access paths are rejected', async () => {
    const ctx = patientCtx('P1', 'EMG-1');
    const hospital = hospitalCtx('HOSP-1', 'H-1');
    const patientHospital = authorizeByRole(ctx, 'UPDATE_OWN_LIVE_STATUS');
    const hospitalSos = authorizeByRole(hospital, 'CREATE_SOS');
    expect(patientHospital.allowed).toBe(false);
    expect(hospitalSos.allowed).toBe(false);
  });
});