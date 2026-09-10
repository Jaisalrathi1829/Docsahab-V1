import { ResourceRelationshipResolver, ResourceType, SecurityContext } from '../contracts/security-context';

export interface RelationshipRule {
  evaluate(context: SecurityContext, resourceType: ResourceType, resourceId: string): Promise<boolean>;
}

export class PolicyResourceRelationshipResolver implements ResourceRelationshipResolver {
  constructor(private readonly rules: ReadonlyMap<ResourceType, RelationshipRule>) {}

  async hasRelationship(context: SecurityContext, resourceType: ResourceType, resourceId: string): Promise<boolean> {
    const rule = this.rules.get(resourceType);
    if (!rule) return false;
    return rule.evaluate(context, resourceType, resourceId);
  }
}

export class OwnerOnlyRelationshipRule implements RelationshipRule {
  constructor(private readonly ownerResolver: (context: SecurityContext, resourceId: string) => Promise<string | null>) {}

  async evaluate(context: SecurityContext, resourceType: ResourceType, resourceId: string): Promise<boolean> {
    const owner = await this.ownerResolver(context, resourceId);
    if (owner === null) return false;
    return owner === context.subjectId;
  }
}