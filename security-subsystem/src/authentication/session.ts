import { SecurityContext } from '../contracts/security-context';

export interface SessionRecord {
  sessionId: string;
  context: SecurityContext;
  createdAt: Date;
  expiresAt: Date;
  revoked: boolean;
}

export interface SessionProvider {
  createSession(context: SecurityContext, ttlMs: number): Promise<SessionRecord>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  validate(sessionId: string): Promise<SecurityContext | null>;
  revoke(sessionId: string): Promise<boolean>;
}

export class InMemorySessionProvider implements SessionProvider {
  private sessions = new Map<string, SessionRecord>();

  async createSession(context: SecurityContext, ttlMs: number): Promise<SessionRecord> {
    const now = new Date();
    const sessionId = this.generateSessionId();
    const record: SessionRecord = {
      sessionId,
      context,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      revoked: false,
    };
    this.sessions.set(sessionId, record);
    return record;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async validate(sessionId: string): Promise<SecurityContext | null> {
    const record = this.sessions.get(sessionId);
    if (!record || record.revoked || record.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return record.context;
  }

  async revoke(sessionId: string): Promise<boolean> {
    const record = this.sessions.get(sessionId);
    if (!record) return false;
    record.revoked = true;
    return true;
  }

  private generateSessionId(): string {
    return `SES-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}