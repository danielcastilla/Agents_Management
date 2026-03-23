// ===========================================
// Health Check Service
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  message?: string;
  latency?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const components = { database, redis };
    const allHealthy = Object.values(components).every(c => c.status === 'healthy');
    const anyHealthy = Object.values(components).some(c => c.status === 'healthy');

    let status: 'healthy' | 'unhealthy' | 'degraded';
    if (allHealthy) {
      status = 'healthy';
    } else if (anyHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      components,
    };
  }

  async checkReadiness(): Promise<HealthStatus> {
    return this.check();
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        latency: Date.now() - start,
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const client = this.redis.getClient();
      await client.ping();
      return {
        status: 'healthy',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        message: 'Redis connection failed',
        latency: Date.now() - start,
      };
    }
  }
}
