// ===========================================
// Runs Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { RunStatus, UserRole, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RunResponseDto } from './dto/run-response.dto';
import { RunsQueryDto } from './dto/runs-query.dto';
import { PaginatedResult, createPaginatedResult } from '@/common/dto';
import { CurrentUserData } from '@/common/decorators';

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all runs with pagination and filtering
   */
  async findAll(
    query: RunsQueryDto,
    user: CurrentUserData,
  ): Promise<PaginatedResult<RunResponseDto>> {
    const { 
      page, limit, sortBy, sortOrder, 
      status, agentId, startDate, endDate 
    } = query;

    // Build where clause
    const where: Prisma.AgentRunWhereInput = {};

    // Non-admins can only see runs from their agents
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERVISOR) {
      where.agent = {
        OR: [
          { createdById: user.id },
          { permissions: { some: { userId: user.id, canRead: true } } },
        ],
      };
    }

    if (status) {
      where.status = status;
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        where.startedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.startedAt.lte = new Date(endDate);
      }
    }

    const [total, runs] = await Promise.all([
      this.prisma.agentRun.count({ where }),
      this.prisma.agentRun.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              modelProvider: true,
              modelName: true,
            },
          },
          _count: {
            select: {
              toolInvocations: true,
            },
          },
        },
        orderBy: {
          [sortBy || 'startedAt']: sortOrder || 'desc',
        },
        skip: query.skip,
        take: query.take,
      }),
    ]);

    const mappedRuns = runs.map(run => this.mapToResponse(run));

    return createPaginatedResult(mappedRuns, total, query);
  }

  /**
   * Get run by ID
   */
  async findOne(id: string, user: CurrentUserData): Promise<RunResponseDto> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            modelProvider: true,
            modelName: true,
            createdById: true,
          },
        },
        toolInvocations: {
          include: {
            tool: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${id} not found`);
    }

    // Check access
    if (!this.canAccess(run, user)) {
      throw new ForbiddenException('You do not have access to this run');
    }

    return this.mapToResponse(run);
  }

  /**
   * Get runs by agent
   */
  async findByAgent(
    agentId: string,
    query: RunsQueryDto,
    user: CurrentUserData,
  ): Promise<PaginatedResult<RunResponseDto>> {
    // Verify agent access
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        permissions: true,
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    if (!this.canAccessAgent(agent, user)) {
      throw new ForbiddenException('You do not have access to this agent');
    }

    const queryWithAgent = Object.assign(new RunsQueryDto(), query, { agentId });
    return this.findAll(queryWithAgent, user);
  }

  /**
   * Get messages from a run
   */
  async getMessages(
    id: string,
    user: CurrentUserData,
  ): Promise<{ messages: unknown[] }> {
    const run = await this.findOne(id, user);
    
    return {
      messages: (run.input as any)?.messages || [],
    };
  }

  /**
   * Get tool invocations from a run
   */
  async getToolInvocations(
    id: string,
    user: CurrentUserData,
  ): Promise<unknown[]> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            createdById: true,
          },
        },
        toolInvocations: {
          include: {
            tool: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${id} not found`);
    }

    if (!this.canAccess(run, user)) {
      throw new ForbiddenException('You do not have access to this run');
    }

    return (run as any).toolInvocations.map((inv: any) => ({
      id: inv.id,
      tool: inv.tool,
      input: inv.input,
      output: inv.output,
      success: inv.success,
      error: inv.errorMessage,
      duration: inv.duration,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Delete run
   */
  async remove(id: string, user: CurrentUserData): Promise<void> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${id} not found`);
    }

    // Only admins can delete runs
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete runs');
    }

    // Delete tool invocations first
    await this.prisma.toolInvocation.deleteMany({
      where: { agentRunId: id },
    });

    // Delete run
    await this.prisma.agentRun.delete({
      where: { id },
    });

    this.logger.log(`Run ${id} deleted by ${user.id}`);
  }

  /**
   * Update run status
   */
  async updateStatus(
    id: string,
    status: RunStatus,
    additionalData?: Partial<{
      output: string;
      error: string;
      tokensUsed: number;
      cost: number;
      finishedAt: Date;
    }>,
  ): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id },
      data: {
        status,
        ...(additionalData as any),
      },
    });

    // Publish status update via Redis pub/sub
    await this.redis.publish(`run:${id}:status`, {
      status,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Create a new run record
   */
  async createRun(data: {
    agentId: string;
    userId: string;
    input: unknown;
  }): Promise<string> {
    const run = await this.prisma.agentRun.create({
      data: {
        agentId: data.agentId,
        userId: data.userId,
        input: JSON.stringify(data.input),
        status: RunStatus.PENDING,
        startedAt: new Date(),
      },
    });

    return run.id;
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private mapToResponse(run: any): RunResponseDto {
    const durationMs = run.finishedAt
      ? run.finishedAt.getTime() - run.startedAt.getTime()
      : undefined;

    return {
      id: run.id,
      agentId: run.agentId,
      agent: run.agent
        ? {
            id: run.agent.id,
            name: run.agent.name,
            modelProvider: run.agent.modelProvider,
            modelName: run.agent.modelName,
          }
        : undefined,
      status: run.status,
      input: run.input,
      output: run.output,
      error: run.errorMessage,
      tokensUsed: run.tokensUsed,
      cost: run.cost ? Number(run.cost) : undefined,
      triggeredBy: run.userId,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs,
      toolInvocationsCount: run._count?.toolInvocations,
      toolInvocations: run.toolInvocations?.map((inv: any) => ({
        id: inv.id,
        toolId: inv.toolId,
        toolName: inv.tool?.name,
        status: inv.success ? 'COMPLETED' : 'FAILED',
        startedAt: inv.createdAt,
        finishedAt: inv.createdAt,
      })),
    };
  }

  private canAccess(run: any, user: CurrentUserData): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return true;
    }
    if (run.agent?.createdById === user.id) {
      return true;
    }
    return false;
  }

  private canAccessAgent(agent: any, user: CurrentUserData): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return true;
    }
    if (agent.createdById === user.id) {
      return true;
    }
    if (agent.permissions) {
      return agent.permissions.some(
        (p: any) => p.userId === user.id && p.canRead,
      );
    }
    return false;
  }
}
