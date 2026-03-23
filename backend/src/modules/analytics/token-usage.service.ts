// ===========================================
// Token Usage Service
// ===========================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Prisma } from '@prisma/client';

export interface TokenUsageResponse {
  date: Date;
  agentId: string;
  tokensUsed: number;
  cost: number;
  runCount: number;
}

export interface TokenUsageSummary {
  totalTokens: number;
  totalCost: number;
  totalRuns: number;
  dailyAverage: number;
  topAgents: Array<{ agentId: string; agentName: string; tokens: number; cost: number }>;
}

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get token usage for a specific period
   */
  async getTokenUsage(
    startDate: Date,
    endDate: Date,
    agentId?: string,
  ): Promise<TokenUsageResponse[]> {
    const where: Prisma.TokenUsageWhereInput = {
      date: { gte: startDate, lte: endDate },
      ...(agentId && { agentId }),
    };

    const usage = await this.prisma.tokenUsage.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return usage.map((u) => ({
      date: u.date,
      agentId: u.agentId,
      tokensUsed: u.tokensUsed,
      cost: Number(u.cost),
      runCount: u.runCount,
    }));
  }

  /**
   * Get token usage summary for a period
   */
  async getTokenUsageSummary(
    days: number,
    agentId?: string,
  ): Promise<TokenUsageSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const cacheKey = `token-usage:summary:${days}:${agentId || 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }

    const where: Prisma.TokenUsageWhereInput = {
      date: { gte: startDate },
      ...(agentId && { agentId }),
    };

    const [totals, byAgent] = await Promise.all([
      this.prisma.tokenUsage.aggregate({
        where,
        _sum: { tokensUsed: true, runCount: true, cost: true },
      }),
      this.prisma.tokenUsage.groupBy({
        by: ['agentId'],
        where,
        _sum: { tokensUsed: true, cost: true },
        orderBy: { _sum: { tokensUsed: 'desc' } },
        take: 10,
      }),
    ]);

    // Get agent names for top agents
    const agentIds = byAgent.map((a) => a.agentId);
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });

    const agentMap = new Map(agents.map((a) => [a.id, a.name]));

    const totalTokens = totals._sum?.tokensUsed || 0;
    const totalCost = Number(totals._sum?.cost || 0);
    const totalRuns = totals._sum?.runCount || 0;

    const summary: TokenUsageSummary = {
      totalTokens,
      totalCost,
      totalRuns,
      dailyAverage: days > 0 ? Math.round(totalTokens / days) : 0,
      topAgents: byAgent.map((a) => ({
        agentId: a.agentId,
        agentName: agentMap.get(a.agentId) || 'Unknown',
        tokens: a._sum?.tokensUsed || 0,
        cost: Number(a._sum?.cost || 0),
      })),
    };

    await this.redis.set(cacheKey, JSON.stringify(summary), this.CACHE_TTL);
    return summary;
  }

  /**
   * Record token usage for a run
   */
  async recordUsage(
    agentId: string,
    tokensUsed: number,
    cost: number,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.tokenUsage.upsert({
      where: {
        agentId_date: {
          agentId,
          date: today,
        },
      },
      update: {
        tokensUsed: { increment: tokensUsed },
        cost: { increment: cost },
        runCount: { increment: 1 },
      },
      create: {
        agentId,
        date: today,
        tokensUsed,
        cost,
        runCount: 1,
      },
    });

    // Invalidate cache - using simple approach without keys method
    // Cache will expire naturally based on TTL
    this.logger.debug('Token usage recorded, cache will expire based on TTL');
  }

  /**
   * Get daily token usage for an agent
   */
  async getDailyUsage(
    agentId: string,
    days: number,
  ): Promise<Array<{ date: string; tokens: number; cost: number; runs: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const usage = await this.prisma.tokenUsage.findMany({
      where: {
        agentId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return usage.map((u) => ({
      date: u.date.toISOString().split('T')[0],
      tokens: u.tokensUsed,
      cost: Number(u.cost),
      runs: u.runCount,
    }));
  }

  /**
   * Get token usage for the current billing period
   */
  async getCurrentPeriodUsage(agentId?: string): Promise<{
    period: { start: Date; end: Date };
    usage: TokenUsageSummary;
  }> {
    // Assume monthly billing starting from the 1st
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const days = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const usage = await this.getTokenUsageSummary(days, agentId);

    return {
      period: { start, end },
      usage,
    };
  }

  /**
   * Check if agent has exceeded daily token limit
   */
  async checkDailyLimit(agentId: string, dailyLimit: number): Promise<{
    exceeded: boolean;
    used: number;
    remaining: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.tokenUsage.findUnique({
      where: {
        agentId_date: {
          agentId,
          date: today,
        },
      },
    });

    const used = usage?.tokensUsed || 0;
    return {
      exceeded: used >= dailyLimit,
      used,
      remaining: Math.max(0, dailyLimit - used),
    };
  }

  /**
   * Get usage for analytics controller
   */
  async getUsage(query: any, userId?: string): Promise<any[]> {
    const startDate = query.startDate ? new Date(query.startDate) : this.getDefaultStartDate(30);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    return this.getTokenUsage(startDate, endDate, query.agentId || userId);
  }

  /**
   * Get time series for analytics
   */
  async getTimeSeries(query: any, userId?: string): Promise<any[]> {
    const days = query.days || 30;
    const agentId = query.agentId;
    if (agentId) {
      return this.getDailyUsage(agentId, days);
    }
    const startDate = this.getDefaultStartDate(days);
    return this.getTokenUsage(startDate, new Date(), userId);
  }

  /**
   * Get usage by model (stub)
   */
  async getByModel(_days?: number, _userId?: string): Promise<any[]> {
    // This would require model info in TokenUsage - returning empty for now
    return [];
  }

  /**
   * Get cost estimates
   */
  async getCostEstimates(days: number = 30): Promise<any> {
    const summary = await this.getTokenUsageSummary(days);
    return {
      currentCost: summary.totalCost,
      projectedCost: summary.totalCost * (30 / Math.max(days, 1)),
      averageDailyCost: summary.totalCost / Math.max(days, 1),
    };
  }

  private getDefaultStartDate(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
