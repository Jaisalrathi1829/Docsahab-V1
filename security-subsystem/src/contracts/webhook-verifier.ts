import { createHmac, timingSafeEqual } from 'crypto';
import { ServiceIdentityRegistry } from '../identity/service-identity';

export interface WebhookVerificationRequest {
  providerId: string;
  signature: string;
  timestampMs: number;
  eventId: string;
  rawBody: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reason: string;
}

export class WebhookVerifier {
  constructor(
    private readonly registry: ServiceIdentityRegistry,
    private readonly config: {
      maxClockSkewMs: number;
      replayWindowMs: number;
    }
  ) {}

  verify(request: WebhookVerificationRequest, seenEventIds: Set<string>): WebhookVerificationResult {
    const secret = this.registry.getSecret(request.providerId);
    if (!secret) {
      return { valid: false, reason: 'Unknown provider' };
    }

    const now = Date.now();
    if (Math.abs(now - request.timestampMs) > this.config.maxClockSkewMs) {
      return { valid: false, reason: 'Timestamp out of skew window' };
    }

    const payload = `${request.providerId}:${request.timestampMs}:${request.eventId}:${request.rawBody}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const provided = Buffer.from(request.signature, 'hex');
    const computed = Buffer.from(expected, 'hex');

    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    if (now - request.timestampMs > this.config.replayWindowMs) {
      return { valid: false, reason: 'Event too old (replay window exceeded)' };
    }

    if (seenEventIds.has(request.eventId)) {
      return { valid: false, reason: 'Duplicate event ID (replay)' };
    }

    seenEventIds.add(request.eventId);
    return { valid: true, reason: 'Webhook verified' };
  }
}