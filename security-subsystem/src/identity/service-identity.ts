import { createHmac, timingSafeEqual } from 'crypto';

export interface ServiceIdentityRegistry {
  getSecret(serviceId: string): string | undefined;
}

export class StaticServiceIdentityRegistry implements ServiceIdentityRegistry {
  constructor(private readonly secrets: ReadonlyMap<string, string>) {}

  getSecret(serviceId: string): string | undefined {
    return this.secrets.get(serviceId);
  }
}

export class ServiceIdentityVerifier {
  constructor(private readonly registry: ServiceIdentityRegistry) {}

  verify(serviceId: string, providedSignature: string, timestampMs: number, body: string, maxClockSkewMs: number): { valid: boolean; reason: string } {
    const secret = this.registry.getSecret(serviceId);
    if (!secret) {
      return { valid: false, reason: 'Unknown service identity' };
    }

    const now = Date.now();
    if (Math.abs(now - timestampMs) > maxClockSkewMs) {
      return { valid: false, reason: 'Timestamp out of acceptable skew' };
    }

    const payload = `${serviceId}:${timestampMs}:${body}`;
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');
    const actual = Buffer.from(providedSignature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true, reason: 'Service identity verified' };
  }
}