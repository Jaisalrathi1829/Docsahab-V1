import { SecurityContext, Action, ResourceType, AuthorizationDecision } from '../../contracts/security-context';
import { SessionProvider } from '../../authentication/session';
import { authorizeByRole } from '../../authorization/policy';
import { ResourceRelationshipResolver } from '../../contracts/security-context';
import { RateLimiter } from '../../rate-limit/limiter';
import { AuditLogger } from '../../audit/logger';

export const AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED';
export const FORBIDDEN = 'FORBIDDEN';
export const RATE_LIMITED = 'RATE_LIMITED';

export class RequestSecurityProcessor {
  constructor(
    private readonly sessions: SessionProvider,
    private readonly relationshipResolver: ResourceRelationshipResolver,
    private readonly rateLimiter: RateLimiter,
    private readonly auditLogger: AuditLogger
  ) {}

  async authenticate(authorizationHeader?: string): Promise<SecurityContext> {
    if (!authorizationHeader) {
      throw new SecurityError(AUTHENTICATION_REQUIRED, 'Authentication required');
    }
    const token = authorizationHeader.replace(/^Bearer\s+/i, '');
    const context = await this.sessions.validate(token);
    if (!context) {
      throw new SecurityError(AUTHENTICATION_REQUIRED, 'Invalid or expired session');
    }
    return context;
  }

  async authorizeAction(context: SecurityContext, action: Action): Promise<void> {
    const decision = authorizeByRole(context, action);
    if (!decision.allowed) {
      await this.auditLogger.log({
        actorId: context.subjectId,
        actorRole: context.role,
        action,
        resourceType: 'EMERGENCY',
        outcome: 'DENIED',
        reason: decision.reason,
      });
      throw new SecurityError(FORBIDDEN, decision.reason);
    }
  }

  async authorizeResource(context: SecurityContext, resourceType: ResourceType, resourceId: string): Promise<void> {
    const has = await this.relationshipResolver.hasRelationship(context, resourceType, resourceId);
    if (!has) {
      await this.auditLogger.log({
        actorId: context.subjectId,
        actorRole: context.role,
        action: 'RESOURCE_ACCESS',
        resourceType,
        resourceId,
        outcome: 'DENIED',
        reason: 'No relationship to resource',
      });
      throw new SecurityError(FORBIDDEN, 'Resource access denied');
    }
  }

  async enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
    const result = await this.rateLimiter.consume(key, limit, windowMs);
    if (!result.allowed) {
      throw new SecurityError(RATE_LIMITED, 'Rate limit exceeded');
    }
  }
}

export class SecurityError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}