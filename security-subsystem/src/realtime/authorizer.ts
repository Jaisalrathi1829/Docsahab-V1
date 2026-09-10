import { SecurityContext } from '../contracts/security-context';
import { ResourceRelationshipResolver } from '../contracts/security-context';
import { RateLimiter } from '../rate-limit/limiter';

export class RealtimeAuthorizer {
  constructor(
    private readonly relationshipResolver: ResourceRelationshipResolver,
    private readonly rateLimiter: RateLimiter
  ) {}

  async canJoinRoom(context: SecurityContext, room: string, resourceType: 'EMERGENCY' | 'PATIENT' | 'AMBULANCE' | 'HOSPITAL', resourceId: string): Promise<boolean> {
    const rateResult = await this.rateLimiter.consume(`socket-room:${context.subjectId}:${room}`, 10, 60000);
    if (!rateResult.allowed) return false;

    return this.relationshipResolver.hasRelationship(context, resourceType, resourceId);
  }
}