// ===========================================
// Metrics Service (System Metrics)
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { RedisService } from '@/modules/redis/redis.service';
import { SystemMetricsDto } from './dto';
import * as os from 'os';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // =========================================
  // System Metrics
  // =========================================

  async getSystemMetrics(): Promise<SystemMetricsDto> {
    const [dbStats, redisInfo, queueStats] = await Promise.all([
      this.getDatabaseStats(),
      this.getRedisStats(),
      this.getQueueStats(),
    ]);

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuUsage: this.getCpuUsage(),
        memoryUsage: this.getMemoryUsage(),
        loadAverage: os.loadavg(),
      },
      database: dbStats,
      redis: redisInfo,
      queue: queueStats,
    };
  }

  // =========================================
  // Health Indicators
  // =========================================

  async getHealthIndicators(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { status: string; latency?: number; error?: string }>;
  }> {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Database check
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error.message,
      };
    }

    // Redis check
    try {
      const redisStart = Date.now();
      await this.redis.get('health-check');
      checks.redis = {
        status: 'healthy',
        latency: Date.now() - redisStart,
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        error: error.message,
      };
    }

    // Memory check
    const memUsage = this.getMemoryUsage();
    const memStatus = memUsage.percentage < 80 ? 'healthy' : 
                      memUsage.percentage < 90 ? 'degraded' : 'unhealthy';
    checks.memory = {
      status: memStatus,
    };

    // Determine overall status
    const statuses = Object.values(checks).map((c) => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      checks,
    };
  }

  // =========================================
  // Database Stats
  // =========================================

  private async getDatabaseStats(): Promise<{
    connected: boolean;
    tables: Record<string, number>;
  }> {
    try {
      const [
        userCount,
        agentCount,
        runCount,
        toolCount,
        auditCount,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.agent.count(),
        this.prisma.agentRun.count(),
        this.prisma.tool.count(),
        this.prisma.auditLog.count(),
      ]);

      return {
        connected: true,
        tables: {
          users: userCount,
          agents: agentCount,
          runs: runCount,
          tools: toolCount,
          auditLogs: auditCount,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return {
        connected: false,
        tables: {},
      };
    }
  }

  // =========================================
  // Redis Stats
  // =========================================

  private async getRedisStats(): Promise<{
    connected: boolean;
    usedMemory?: string;
    connectedClients?: number;
  }> {
    try {
      // Try to get Redis info (implementation depends on redis service)
      await this.redis.get('ping');
      
      return {
        connected: true,
        usedMemory: 'N/A',
        connectedClients: 1,
      };
    } catch (error) {
      return {
        connected: false,
      };
    }
  }

  // =========================================
  // Queue Stats
  // =========================================

  private async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    // This would integrate with BullMQ queue if available
    // For now, return placeholder
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };
  }

  // =========================================
  // System Helpers
  // =========================================

  private getCpuUsage(): { user: number; system: number } {
    const cpuUsage = process.cpuUsage();
    return {
      user: Math.round(cpuUsage.user / 1000000 * 100) / 100,
      system: Math.round(cpuUsage.system / 1000000 * 100) / 100,
    };
  }

  private getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    heap: { used: number; total: number };
  } {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round((usedMem / totalMem) * 10000) / 100,
      heap: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    };
  }
}
