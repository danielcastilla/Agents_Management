// ===========================================
// Redis Cache Service
// ===========================================

import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {
    this.redis.on('connect', () => {
      this.logger.log('✅ Redis connection established');
    });

    this.redis.on('error', (error) => {
      this.logger.error('❌ Redis connection error:', error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('🔌 Redis connection closed');
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Delete keys by pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  /**
   * Increment counter with expiration
   */
  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();
    return results?.[0]?.[1] as number || 0;
  }

  /**
   * Get hash field
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.redis.hget(key, field);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: unknown): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.redis.hset(key, field, serialized);
  }

  /**
   * Get all hash fields
   */
  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    const result = await this.redis.hgetall(key);
    if (!result || Object.keys(result).length === 0) return null;

    const parsed: Record<string, T> = {};
    for (const [field, value] of Object.entries(result)) {
      try {
        parsed[field] = JSON.parse(value) as T;
      } catch {
        parsed[field] = value as unknown as T;
      }
    }
    return parsed;
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: unknown): Promise<void> {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message);
    await this.redis.publish(channel, serialized);
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis {
    return this.redis;
  }
}
