export interface AuditEvent {
  eventId: string;
  requestId?: string;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  emergencyId?: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  reason?: string;
  timestamp: Date;
  ip?: string;
}

export interface AuditLogger {
  log(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<void>;
}

export class InMemoryAuditLogger implements AuditLogger {
  private events: AuditEvent[] = [];

  async log(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      eventId: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date(),
    };
    this.events.push(fullEvent);
  }

  getEvents(): ReadonlyArray<AuditEvent> {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }
}
