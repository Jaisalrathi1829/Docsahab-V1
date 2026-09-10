import {
  validateProductionConfig,
  assertSafeStartup,
  WebhookVerifier,
  StaticServiceIdentityRegistry,
} from '../../src/index';

describe('Production Configuration Security', () => {
  test('Production fails startup on demo OTP', () => {
    const config = {
      environment: 'PRODUCTION' as const,
      allowDemoOtp: true,
      corsOrigins: ['https://docsahab.app'],
      debugErrors: false,
      auditLoggingEnabled: true,
      rateLimiterType: 'REDIS' as const,
      cookieSecure: true,
      sessionSecret: 's'.repeat(64),
    };
    expect(assertSafeStartup).toThrow();
    const result = validateProductionConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('Demo OTP');
  });

  test('Production fails startup on wildcard CORS', () => {
    const config = {
      environment: 'PRODUCTION' as const,
      allowDemoOtp: false,
      corsOrigins: ['*'],
      debugErrors: false,
      auditLoggingEnabled: true,
      rateLimiterType: 'REDIS' as const,
      cookieSecure: true,
      sessionSecret: 's'.repeat(64),
    };
    const result = validateProductionConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('Wildcard CORS');
  });

  test('Production fails startup on disabled audit logging', () => {
    const config = {
      environment: 'PRODUCTION' as const,
      allowDemoOtp: false,
      corsOrigins: ['https://docsahab.app'],
      debugErrors: false,
      auditLoggingEnabled: false,
      rateLimiterType: 'REDIS' as const,
      cookieSecure: true,
      sessionSecret: 's'.repeat(64),
    };
    const result = validateProductionConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('Audit logging');
  });

  test('Production fails startup on in-memory rate limiting', () => {
    const config = {
      environment: 'PRODUCTION' as const,
      allowDemoOtp: false,
      corsOrigins: ['https://docsahab.app'],
      debugErrors: false,
      auditLoggingEnabled: true,
      rateLimiterType: 'IN_MEMORY' as const,
      cookieSecure: true,
      sessionSecret: 's'.repeat(64),
    };
    const result = validateProductionConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('In-memory rate limit');
  });

  test('Production fails startup on weak session secret', () => {
    const config = {
      environment: 'PRODUCTION' as const,
      allowDemoOtp: false,
      corsOrigins: ['https://docsahab.app'],
      debugErrors: false,
      auditLoggingEnabled: true,
      rateLimiterType: 'REDIS' as const,
      cookieSecure: true,
      sessionSecret: 'short',
    };
    const result = validateProductionConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('session secret');
  });

  test('Production accepts a fully secure configuration', () => {
    const config = {
      environment: 'PRODUCTION' as const,
      allowDemoOtp: false,
      corsOrigins: ['https://docsahab.app'],
      debugErrors: false,
      auditLoggingEnabled: true,
      rateLimiterType: 'REDIS' as const,
      cookieSecure: true,
      sessionSecret: 'x'.repeat(64),
    };
    const result = validateProductionConfig(config);
    expect(result.valid).toBe(true);
    expect(() => assertSafeStartup(config)).not.toThrow();
  });
});

describe('Webhook Verification', () => {
  const secret = 'provider-secret-1';
  const registry = new StaticServiceIdentityRegistry(new Map([['hospital-status', secret]]));
  const verifier = new WebhookVerifier(registry, { maxClockSkewMs: 60000, replayWindowMs: 5 * 60 * 1000 });
  const seen = new Set<string>();

  const sign = (provider: string, ts: number, eventId: string, body: string) => {
    const { createHmac } = require('crypto');
    return createHmac('sha256', secret).update(`${provider}:${ts}:${eventId}:${body}`).digest('hex');
  };

  test('Valid provider webhook is accepted once', () => {
    const ts = Date.now();
    const eventId = 'evt-1';
    const body = JSON.stringify({ hospitalId: 'H-1', accepting: true });
    const sig = sign('hospital-status', ts, eventId, body);
    const result = verifier.verify({ providerId: 'hospital-status', signature: sig, timestampMs: ts, eventId, rawBody: body }, seen);
    expect(result.valid).toBe(true);
  });

  test('Replayed event ID is rejected', () => {
    const ts = Date.now();
    const eventId = 'evt-1';
    const body = JSON.stringify({ hospitalId: 'H-1', accepting: true });
    const sig = sign('hospital-status', ts, eventId, body);
    const result = verifier.verify({ providerId: 'hospital-status', signature: sig, timestampMs: ts, eventId, rawBody: body }, seen);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('replay');
  });

  test('Tampered payload signature is rejected', () => {
    const ts = Date.now();
    const body = JSON.stringify({ hospitalId: 'H-2', accepting: true });
    const sig = sign('hospital-status', ts, 'evt-2', body);
    const tampered = verifier.verify({ providerId: 'hospital-status', signature: sig, timestampMs: ts, eventId: 'evt-2', rawBody: JSON.stringify({ hospitalId: 'H-3', accepting: true }) }, seen);
    expect(tampered.valid).toBe(false);
  });

  test('Future/far-past timestamp is rejected', () => {
    const ts = Date.now() + 10 * 60 * 1000;
    const body = JSON.stringify({ hospitalId: 'H-1' });
    const sig = sign('hospital-status', ts, 'evt-3', body);
    const result = verifier.verify({ providerId: 'hospital-status', signature: sig, timestampMs: ts, eventId: 'evt-3', rawBody: body }, seen);
    expect(result.valid).toBe(false);
  });
});