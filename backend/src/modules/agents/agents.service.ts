// ===========================================
// Agents Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuditAction, EntityType, AgentStatus, UserRole, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CloneAgentDto } from './dto/clone-agent.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { AgentsQueryDto } from './dto/agents-query.dto';
import { PaginatedResult, createPaginatedResult } from '@/common/dto';
import { CurrentUserData } from '@/common/decorators';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all agents with pagination and filtering
   */
  async findAll(
    query: AgentsQueryDto,
    user: CurrentUserData,
  ): Promise<PaginatedResult<AgentResponseDto>> {
    const { 
      page, limit, sortBy, sortOrder, search, 
      environment, status, modelProvider, createdById 
    } = query;

    // Build where clause
    const where: Prisma.AgentWhereInput = {};

    // Non-admins can only see their own agents or agents they have permission to
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERVISOR) {
      where.OR = [
        { createdById: user.id },
        { permissions: { some: { userId: user.id, canRead: true } } },
      ];
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (environment) {
      where.environment = environment;
    }

    if (status) {
      where.status = status;
    }

    if (modelProvider) {
      where.modelProvider = modelProvider;
    }

    if (createdById) {
      where.createdById = createdById;
    }

    // Get total count and agents
    const [total, agents] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          tools: {
            include: {
              tool: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              runs: true,
              versions: true,
            },
          },
        },
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        skip: query.skip,
        take: query.take,
      }),
    ]);

    const mappedAgents = agents.map(agent => this.mapToResponse(agent));

    return createPaginatedResult(mappedAgents, total, query);
  }

  /**
   * Get agent by ID
   */
  async findOne(id: string, user: CurrentUserData): Promise<AgentResponseDto> {
    // Check cache
    const cached = await this.redis.get<AgentResponseDto>(`agent:${id}`);
    if (cached) {
      // Verify access
      if (!this.canAccess(cached, user)) {
        throw new ForbiddenException('You do not have access to this agent');
      }
      return cached;
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tools: {
          include: {
            tool: true,
          },
        },
        permissions: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            runs: true,
            versions: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    const response = this.mapToResponse(agent);

    // Verify access
    if (!this.canAccess(response, user)) {
      throw new ForbiddenException('You do not have access to this agent');
    }

    // Cache
    await this.redis.set(`agent:${id}`, response, this.CACHE_TTL);

    return response;
  }

  /**
   * Create new agent
   */
  async create(
    createAgentDto: CreateAgentDto,
    createdById: string,
  ): Promise<AgentResponseDto> {
    const agent = await this.prisma.agent.create({
      data: {
        name: createAgentDto.name,
        description: createAgentDto.description,
        modelProvider: createAgentDto.modelProvider,
        modelName: createAgentDto.modelName,
        temperature: createAgentDto.temperature ?? 0.7,
        maxTokens: createAgentDto.maxTokens ?? 4096,
        systemPrompt: createAgentDto.systemPrompt,
        memoryEnabled: createAgentDto.memoryEnabled ?? false,
        environment: createAgentDto.environment ?? 'DEVELOPMENT',
        dailyTokenLimit: createAgentDto.dailyTokenLimit,
        createdById,
        version: 1,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            runs: true,
            versions: true,
          },
        },
      },
    });

    // Create initial version snapshot
    await this.createVersionSnapshot(agent.id, 1, 'Initial version');

    // Create audit log
    await this.createAuditLog(
      createdById,
      AuditAction.CREATE,
      agent.id,
      null,
      { name: agent.name, modelProvider: agent.modelProvider },
    );

    this.logger.log(`Agent created: ${agent.name} by ${createdById}`);

    return this.mapToResponse(agent);
  }

  /**
   * Update agent
   */
  async update(
    id: string,
    updateAgentDto: UpdateAgentDto,
    user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    // Get current agent
    const currentAgent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });

    if (!currentAgent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Check permission
    if (!this.canModify(currentAgent, user)) {
      throw new ForbiddenException('You do not have permission to modify this agent');
    }

    // Increment version
    const newVersion = currentAgent.version + 1;

    // Update agent
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...updateAgentDto,
        version: newVersion,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tools: {
          include: {
            tool: true,
          },
        },
        _count: {
          select: {
            runs: true,
            versions: true,
          },
        },
      },
    });

    // Create version snapshot
    await this.createVersionSnapshot(
      id, 
      newVersion, 
      updateAgentDto.changelog || 'Configuration updated',
    );

    // Invalidate cache
    await this.redis.del(`agent:${id}`);

    // Create audit log
    await this.createAuditLog(
      user.id,
      AuditAction.UPDATE,
      id,
      { version: currentAgent.version },
      { version: newVersion, changes: Object.keys(updateAgentDto) },
    );

    this.logger.log(`Agent updated: ${agent.name} to v${newVersion} by ${user.id}`);

    return this.mapToResponse(agent);
  }

  /**
   * Delete agent (soft delete)
   */
  async remove(id: string, user: CurrentUserData): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Check permission
    if (!this.canDelete(agent, user)) {
      throw new ForbiddenException('You do not have permission to delete this agent');
    }

    // Soft delete by setting status to DEPRECATED
    await this.prisma.agent.update({
      where: { id },
      data: { status: AgentStatus.DEPRECATED },
    });

    // Invalidate cache
    await this.redis.del(`agent:${id}`);

    // Create audit log
    await this.createAuditLog(
      user.id,
      AuditAction.DELETE,
      id,
      { name: agent.name },
      null,
    );

    this.logger.log(`Agent deleted: ${agent.name} by ${user.id}`);
  }

  /**
   * Clone agent
   */
  async clone(
    id: string,
    cloneDto: CloneAgentDto,
    userId: string,
  ): Promise<AgentResponseDto> {
    const sourceAgent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        tools: true,
      },
    });

    if (!sourceAgent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Create cloned agent
    const clonedAgent = await this.prisma.agent.create({
      data: {
        name: cloneDto.name || `${sourceAgent.name} (Copy)`,
        description: cloneDto.description || sourceAgent.description,
        modelProvider: sourceAgent.modelProvider,
        modelName: sourceAgent.modelName,
        temperature: sourceAgent.temperature,
        maxTokens: sourceAgent.maxTokens,
        systemPrompt: sourceAgent.systemPrompt,
        memoryEnabled: sourceAgent.memoryEnabled,
        environment: cloneDto.environment || sourceAgent.environment,
        dailyTokenLimit: sourceAgent.dailyTokenLimit,
        createdById: userId,
        parentId: sourceAgent.id,
        version: 1,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            runs: true,
            versions: true,
          },
        },
      },
    });

    // Clone tool associations
    if (sourceAgent.tools.length > 0) {
      await this.prisma.agentTool.createMany({
        data: sourceAgent.tools.map(at => ({
          agentId: clonedAgent.id,
          toolId: at.toolId,
          isEnabled: at.isEnabled,
          priority: at.priority,
          config: at.config as Prisma.JsonObject | undefined,
        })),
      });
    }

    // Create initial version
    await this.createVersionSnapshot(clonedAgent.id, 1, `Cloned from ${sourceAgent.name}`);

    // Create audit log
    await this.createAuditLog(
      userId,
      AuditAction.CLONE,
      clonedAgent.id,
      { sourceId: sourceAgent.id, sourceName: sourceAgent.name },
      { name: clonedAgent.name },
    );

    this.logger.log(`Agent cloned: ${sourceAgent.name} -> ${clonedAgent.name} by ${userId}`);

    return this.mapToResponse(clonedAgent);
  }

  /**
   * Set agent status
   */
  async setStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED',
    user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Check permission
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERVISOR) {
      throw new ForbiddenException('Only admins and supervisors can change agent status');
    }

    const updatedAgent = await this.prisma.agent.update({
      where: { id },
      data: { status: AgentStatus[status] },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tools: {
          include: {
            tool: true,
          },
        },
        _count: {
          select: {
            runs: true,
            versions: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.redis.del(`agent:${id}`);

    // Determine audit action
    let action: AuditAction;
    switch (status) {
      case 'ACTIVE':
        action = AuditAction.ACTIVATE;
        break;
      case 'INACTIVE':
        action = AuditAction.DEACTIVATE;
        break;
      default:
        action = AuditAction.UPDATE;
    }

    // Create audit log
    await this.createAuditLog(
      user.id,
      action,
      id,
      { status: agent.status },
      { status: updatedAgent.status },
    );

    this.logger.log(`Agent status changed: ${agent.name} -> ${status} by ${user.id}`);

    return this.mapToResponse(updatedAgent);
  }

  /**
   * Get agent statistics
   */
  async getStats(
    id: string,
    user: CurrentUserData,
  ): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
  }> {
    // Verify access
    await this.findOne(id, user);

    const stats = await this.prisma.agentRun.aggregate({
      where: { agentId: id },
      _count: { id: true },
      _sum: {
        tokensUsed: true,
        cost: true,
      },
    });

    const statusCounts = await this.prisma.agentRun.groupBy({
      by: ['status'],
      where: { agentId: id },
      _count: { id: true },
    });

    // Calculate average latency
    const completedRuns = await this.prisma.agentRun.findMany({
      where: {
        agentId: id,
        status: 'COMPLETED',
        finishedAt: { not: null },
      },
      select: {
        startedAt: true,
        finishedAt: true,
      },
    });

    let averageLatency = 0;
    if (completedRuns.length > 0) {
      const totalLatency = completedRuns.reduce((sum, run) => {
        if (run.finishedAt) {
          return sum + (run.finishedAt.getTime() - run.startedAt.getTime());
        }
        return sum;
      }, 0);
      averageLatency = Math.round(totalLatency / completedRuns.length);
    }

    const successfulRuns = statusCounts.find(s => s.status === 'COMPLETED')?._count.id || 0;
    const failedRuns = statusCounts.find(s => s.status === 'FAILED')?._count.id || 0;

    return {
      totalRuns: stats._count.id,
      successfulRuns,
      failedRuns,
      totalTokens: stats._sum.tokensUsed || 0,
      totalCost: Number(stats._sum.cost || 0),
      averageLatency,
    };
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private mapToResponse(agent: any): AgentResponseDto {
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      modelProvider: agent.modelProvider,
      modelName: agent.modelName,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      systemPrompt: agent.systemPrompt,
      memoryEnabled: agent.memoryEnabled,
      environment: agent.environment,
      status: agent.status,
      dailyTokenLimit: agent.dailyTokenLimit,
      version: agent.version,
      parentId: agent.parentId,
      createdBy: agent.createdBy,
      createdById: agent.createdById,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      runsCount: agent._count?.runs,
      versionsCount: agent._count?.versions,
      tools: agent.tools?.map((at: any) => ({
        id: at.tool?.id || at.toolId,
        name: at.tool?.name,
        isEnabled: at.isEnabled,
        priority: at.priority,
      })),
    };
  }

  private canAccess(agent: any, user: CurrentUserData): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return true;
    }
    if (agent.createdById === user.id) {
      return true;
    }
    // Check permissions
    if (agent.permissions) {
      return agent.permissions.some(
        (p: any) => p.userId === user.id && p.canRead,
      );
    }
    return false;
  }

  private canModify(agent: any, user: CurrentUserData): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return true;
    }
    if (agent.createdById === user.id) {
      return true;
    }
    if (agent.permissions) {
      return agent.permissions.some(
        (p: any) => p.userId === user.id && p.canWrite,
      );
    }
    return false;
  }

  private canDelete(agent: any, user: CurrentUserData): boolean {
    if (user.role === UserRole.ADMIN) {
      return true;
    }
    if (user.role === UserRole.SUPERVISOR && agent.createdById === user.id) {
      return true;
    }
    return false;
  }

  private async createVersionSnapshot(
    agentId: string,
    version: number,
    changelog: string,
  ): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (agent) {
      await this.prisma.agentVersion.create({
        data: {
          agentId,
          version,
          configuration: {
            name: agent.name,
            description: agent.description,
            modelProvider: agent.modelProvider,
            modelName: agent.modelName,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            systemPrompt: agent.systemPrompt,
            memoryEnabled: agent.memoryEnabled,
            environment: agent.environment,
            dailyTokenLimit: agent.dailyTokenLimit,
          },
          changelog,
        },
      });
    }
  }

  private async createAuditLog(
    userId: string,
    action: AuditAction,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: EntityType.AGENT,
        entityId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
