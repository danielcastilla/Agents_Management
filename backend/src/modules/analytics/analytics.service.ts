// ===========================================
// Analytics Service
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RunStatus, Prisma } from '@prisma/client';
import {
  DashboardDto,
  TimeSeriesQueryDto,
  AgentAnalyticsDto,
} from './dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // =========================================
  // Dashboard Overview
  // =========================================

  async getDashboard(days: number = 30, userId?: string): Promise<DashboardDto> {
    const cacheKey = `analytics:dashboard:${days}:${userId || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const startDate = this.getStartDate(days);
    const previousStartDate = this.getStartDate(days * 2);

    const where: Prisma.AgentRunWhereInput = {
      startedAt: { gte: startDate },
      ...(userId && { agent: { createdById: userId } }),
    };

    const previousWhere: Prisma.AgentRunWhereInput = {
      startedAt: { gte: previousStartDate, lt: startDate },
      ...(userId && { agent: { createdById: userId } }),
    };

    const [
      totalAgents,
      activeAgents,
      totalRuns,
      previousRuns,
      successfulRuns,
      previousSuccessfulRuns,
      totalTokens,
      previousTokens,
      totalTools,
      recentErrors,
    ] = await Promise.all([
      this.prisma.agent.count({
        where: userId ? { createdById: userId } : undefined,
      }),
      this.prisma.agent.count({
        where: {
          ...(userId && { createdById: userId }),
          runs: { some: { startedAt: { gte: startDate } } },
        },
      }),
      this.prisma.agentRun.count({ where }),
      this.prisma.agentRun.count({ where: previousWhere }),
      this.prisma.agentRun.count({
        where: { ...where, status: RunStatus.COMPLETED },
      }),
      this.prisma.agentRun.count({
        where: { ...previousWhere, status: RunStatus.COMPLETED },
      }),
      this.prisma.tokenUsage.aggregate({
        where: { date: { gte: startDate } },
        _sum: { tokensUsed: true },
      }),
      this.prisma.tokenUsage.aggregate({
        where: { date: { gte: previousStartDate, lt: startDate } },
        _sum: { tokensUsed: true },
      }),
      this.prisma.tool.count({ where: { isActive: true } }),
      this.prisma.agentRun.count({
        where: {
          ...where,
          status: RunStatus.FAILED,
          startedAt: { gte: this.getStartDate(1) },
        },
      }),
    ]);

    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
    const previousSuccessRate = previousRuns > 0 
      ? (previousSuccessfulRuns / previousRuns) * 100 
      : 0;

    const dashboard: DashboardDto = {
      period: { days, startDate, endDate: new Date() },
      summary: {
        totalAgents,
        activeAgents,
        totalRuns,
        successRate: Math.round(successRate * 100) / 100,
        totalTokens: totalTokens._sum?.tokensUsed || 0,
        totalTools,
        recentErrors,
      },
      trends: {
        runs: this.calculateTrend(totalRuns, previousRuns),
        successRate: this.calculateTrend(successRate, previousSuccessRate),
        tokens: this.calculateTrend(
          totalTokens._sum?.tokensUsed || 0,
          previousTokens._sum?.tokensUsed || 0,
        ),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(dashboard), this.CACHE_TTL);
    return dashboard;
  }

  // =========================================
  // Runs Analytics
  // =========================================

  async getRunsTimeSeries(
    query: TimeSeriesQueryDto,
    userId?: string,
  ): Promise<Array<{ date: string; count: number; success: number; failed: number }>> {
    const { days = 30, granularity = 'day' } = query;
    const startDate = this.getStartDate(days);
    
    const result: Array<{ date: string; count: number; success: number; failed: number }> = [];
    const intervals = this.getTimeIntervals(startDate, new Date(), granularity);

    for (const interval of intervals) {
      const where: Prisma.AgentRunWhereInput = {
        startedAt: { gte: interval.start, lt: interval.end },
        ...(userId && { agent: { createdById: userId } }),
      };

      const [total, success, failed] = await Promise.all([
        this.prisma.agentRun.count({ where }),
        this.prisma.agentRun.count({ where: { ...where, status: RunStatus.COMPLETED } }),
        this.prisma.agentRun.count({ where: { ...where, status: RunStatus.FAILED } }),
      ]);

      result.push({
        date: interval.label,
        count: total,
        success,
        failed,
      });
    }

    return result;
  }

  async getRunsByStatus(
    days: number,
    userId?: string,
  ): Promise<Record<string, number>> {
    const startDate = this.getStartDate(days);

    const results = await this.prisma.agentRun.groupBy({
      by: ['status'],
      where: {
        startedAt: { gte: startDate },
        ...(userId && { agent: { createdById: userId } }),
      },
      _count: { status: true },
    });

    return results.reduce(
      (acc, item) => ({
        ...acc,
        [item.status]: item._count.status,
      }),
      {} as Record<string, number>,
    );
  }

  async getRunsPerformance(
    days: number,
    userId?: string,
  ): Promise<{
    avgDuration: number;
    successRate: number;
    p50Duration: number;
    p95Duration: number;
    totalRuns: number;
  }> {
    const startDate = this.getStartDate(days);
    const where: Prisma.AgentRunWhereInput = {
      startedAt: { gte: startDate },
      status: { in: [RunStatus.COMPLETED, RunStatus.FAILED] },
      ...(userId && { agent: { createdById: userId } }),
    };

    const [totalCount, runs] = await Promise.all([
      this.prisma.agentRun.count({ where }),
      this.prisma.agentRun.findMany({
        where,
        select: { startedAt: true, finishedAt: true, status: true },
      }),
    ]);

    // Calculate durations from startedAt and finishedAt
    const durations = runs
      .filter((r) => r.finishedAt)
      .map((r) => r.finishedAt!.getTime() - r.startedAt.getTime())
      .sort((a, b) => a - b);

    const successCount = runs.filter((r) => r.status === RunStatus.COMPLETED).length;
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    return {
      avgDuration: Math.round(avgDuration),
      successRate: runs.length > 0 
        ? Math.round((successCount / runs.length) * 10000) / 100 
        : 0,
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      totalRuns: totalCount,
    };
  }

  // =========================================
  // Agent Analytics
  // =========================================

  async getTopAgents(
    days: number,
    limit: number,
    userId?: string,
  ): Promise<AgentAnalyticsDto[]> {
    const startDate = this.getStartDate(days);

    const agents = await this.prisma.agent.findMany({
      where: userId ? { createdById: userId } : undefined,
      select: {
        id: true,
        name: true,
        modelProvider: true,
        modelName: true,
        environment: true,
        _count: {
          select: { runs: true },
        },
        runs: {
          where: { startedAt: { gte: startDate } },
          select: {
            status: true,
            startedAt: true,
            finishedAt: true,
            tokensUsed: true,
          },
        },
      },
      orderBy: {
        runs: { _count: 'desc' },
      },
      take: limit,
    });

    return agents.map((agent) => {
      const successRuns = agent.runs.filter((r) => r.status === RunStatus.COMPLETED).length;
      const totalTokens = agent.runs.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);
      const durations = agent.runs
        .filter((r) => r.finishedAt)
        .map((r) => r.finishedAt!.getTime() - r.startedAt.getTime());
      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;

      return {
        agentId: agent.id,
        name: agent.name,
        model: `${agent.modelProvider}/${agent.modelName}`,
        environment: agent.environment,
        totalRuns: agent.runs.length,
        successRate: agent.runs.length > 0
          ? Math.round((successRuns / agent.runs.length) * 10000) / 100
          : 0,
        avgDuration: Math.round(avgDuration),
        totalTokens,
      };
    });
  }

  async getAgentStats(agentId: string, days: number) {
    const startDate = this.getStartDate(days);

    const [agent, runsByStatus, dailyRuns, tokenUsage] = await Promise.all([
      this.prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          name: true,
          modelProvider: true,
          modelName: true,
          createdAt: true,
          _count: { select: { runs: true } },
        },
      }),

      this.prisma.agentRun.groupBy({
        by: ['status'],
        where: { agentId, startedAt: { gte: startDate } },
        _count: { status: true },
      }),

      this.getRunsTimeSeries({ days, granularity: 'day' }),

      this.prisma.tokenUsage.aggregate({
        where: {
          agentId,
          date: { gte: startDate },
        },
        _sum: { tokensUsed: true },
      }),
    ]);

    return {
      agent,
      runsByStatus: runsByStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count.status }),
        {},
      ),
      dailyRuns,
      tokenUsage: {
        total: tokenUsage._sum?.tokensUsed || 0,
      },
    };
  }

  // =========================================
  // Tools Analytics
  // =========================================

  async getTopTools(days: number, limit: number) {
    const startDate = this.getStartDate(days);

    const tools = await this.prisma.tool.findMany({
      select: {
        id: true,
        name: true,
        method: true,
        _count: {
          select: { invocations: true },
        },
        invocations: {
          where: { createdAt: { gte: startDate } },
          select: { success: true, duration: true },
        },
      },
      orderBy: {
        invocations: { _count: 'desc' },
      },
      take: limit,
    });

    return tools.map((tool) => {
      const successCount = tool.invocations.filter((i) => i.success).length;
      const avgDuration = tool.invocations.length > 0
        ? tool.invocations.reduce((sum, i) => sum + (i.duration || 0), 0) / tool.invocations.length
        : 0;

      return {
        toolId: tool.id,
        name: tool.name,
        method: tool.method,
        invocations: tool._count.invocations,
        successRate: tool.invocations.length > 0
          ? Math.round((successCount / tool.invocations.length) * 10000) / 100
          : 0,
        avgDuration: Math.round(avgDuration),
      };
    });
  }

  async getToolSuccessRates(days: number) {
    const startDate = this.getStartDate(days);

    const tools = await this.prisma.tool.findMany({
      select: {
        id: true,
        name: true,
        invocations: {
          where: { createdAt: { gte: startDate } },
          select: { success: true },
        },
      },
    });

    return tools
      .filter((t) => t.invocations.length > 0)
      .map((tool) => {
        const successCount = tool.invocations.filter((i) => i.success).length;
        return {
          toolId: tool.id,
          name: tool.name,
          total: tool.invocations.length,
          success: successCount,
          failed: tool.invocations.length - successCount,
          successRate: Math.round((successCount / tool.invocations.length) * 10000) / 100,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  // =========================================
  // User Analytics
  // =========================================

  async getUserActivity(days: number) {
    const startDate = this.getStartDate(days);

    const [totalUsers, activeUsers, newUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          OR: [
            { agents: { some: { runs: { some: { startedAt: { gte: startDate } } } } } },
            { updatedAt: { gte: startDate } },
          ],
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsers,
      activeRate: totalUsers > 0
        ? Math.round((activeUsers / totalUsers) * 10000) / 100
        : 0,
    };
  }

  async getTopUsers(days: number, limit: number) {
    const startDate = this.getStartDate(days);

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        agents: {
          select: {
            _count: {
              select: { runs: true },
            },
          },
        },
      },
      take: 100,
    });

    return users
      .map((user) => ({
        userId: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        agentCount: user.agents.length,
        runCount: user.agents.reduce((sum, a) => sum + a._count.runs, 0),
      }))
      .sort((a, b) => b.runCount - a.runCount)
      .slice(0, limit);
  }

  // =========================================
  // Private Helpers
  // =========================================

  private getStartDate(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  private getTimeIntervals(
    start: Date,
    end: Date,
    granularity: 'hour' | 'day' | 'week' | 'month',
  ): Array<{ start: Date; end: Date; label: string }> {
    const intervals: Array<{ start: Date; end: Date; label: string }> = [];
    const current = new Date(start);

    while (current < end) {
      const intervalStart = new Date(current);
      let intervalEnd: Date;
      let label: string;

      switch (granularity) {
        case 'hour':
          intervalEnd = new Date(current.setHours(current.getHours() + 1));
          label = intervalStart.toISOString().slice(0, 13) + ':00';
          break;
        case 'day':
          intervalEnd = new Date(current.setDate(current.getDate() + 1));
          label = intervalStart.toISOString().split('T')[0];
          break;
        case 'week':
          intervalEnd = new Date(current.setDate(current.getDate() + 7));
          label = `W${this.getWeekNumber(intervalStart)}`;
          break;
        case 'month':
          intervalEnd = new Date(current.setMonth(current.getMonth() + 1));
          label = intervalStart.toISOString().slice(0, 7);
          break;
      }

      intervals.push({ start: intervalStart, end: intervalEnd, label });
    }

    return intervals;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
