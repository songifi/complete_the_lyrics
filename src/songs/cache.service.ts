import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private cache = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  getSize(): number {
    return this.cache.size;
  }

  // Start cleanup interval (call this in module initialization)
  startCleanupInterval(intervalMs: number = 60000): void {
    // Return early if interval already exists (idempotent)
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);

    // Prevent the timer from keeping the event loop alive
    this.cleanupInterval.unref();
  }

  // Stop the cleanup interval
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Cleanup on module destroy
  onModuleDestroy(): void {
    this.stopCleanupInterval();
  }
}
