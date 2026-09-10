export interface IdempotencyStore {
  isDuplicate(key: string, operation: string): Promise<boolean>;
  markProcessed(key: string, operation: string): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private processed = new Map<string, Set<string>>();

  async isDuplicate(key: string, operation: string): Promise<boolean> {
    return this.processed.get(operation)?.has(key) ?? false;
  }

  async markProcessed(key: string, operation: string): Promise<void> {
    const existing = this.processed.get(operation) ?? new Set();
    existing.add(key);
    this.processed.set(operation, existing);
  }

  clear(): void {
    this.processed.clear();
  }
}