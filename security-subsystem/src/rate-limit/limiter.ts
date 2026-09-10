export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private records = new Map<string, { count: number; resetTime: number }>();

  async consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record || now > record.resetTime) {
      this.records.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }

    if (record.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    record.count++;
    return { allowed: true, remaining: limit - record.count };
  }

  clear(): void {
    this.records.clear();
  }
}
