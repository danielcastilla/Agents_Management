// ===========================================
// Tools Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AuditAction, EntityType, HttpMethod, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolResponseDto } from './dto/tool-response.dto';
import { ToolsQueryDto } from './dto/tools-query.dto';
import { PaginatedResult, createPaginatedResult } from '@/common/dto';
import { CurrentUserData } from '@/common/decorators';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all tools with pagination and filtering
   */
  async findAll(
    query: ToolsQueryDto,
    user: CurrentUserData,
  ): Promise<PaginatedResult<ToolResponseDto>> {
    const { page, limit, sortBy, sortOrder, search, method, isActive } = query;

    // Build where clause
    const where: Prisma.ToolWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (method) {
      where.method = method;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [total, tools] = await Promise.all([
      this.prisma.tool.count({ where }),
      this.prisma.tool.findMany({
        where,
        include: {
          _count: {
            select: {
              agents: true,
              invocations: true,
            },
          },
        },
        orderBy: {
          [sortBy || 'name']: sortOrder || 'asc',
        },
        skip: query.skip,
        take: query.take,
      }),
    ]);

    const mappedTools = tools.map(tool => this.mapToResponse(tool));

    return createPaginatedResult(mappedTools, total, query);
  }

  /**
   * Get tool by ID
   */
  async findOne(id: string): Promise<ToolResponseDto> {
    // Check cache
    const cached = await this.redis.get<ToolResponseDto>(`tool:${id}`);
    if (cached) {
      return cached;
    }

    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            agents: true,
            invocations: true,
          },
        },
      },
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    const response = this.mapToResponse(tool);

    // Cache
    await this.redis.set(`tool:${id}`, response, this.CACHE_TTL);

    return response;
  }

  /**
   * Get tool by name
   */
  async findByName(name: string): Promise<ToolResponseDto | null> {
    const tool = await this.prisma.tool.findUnique({
      where: { name },
      include: {
        _count: {
          select: {
            agents: true,
            invocations: true,
          },
        },
      },
    });

    if (!tool) {
      return null;
    }

    return this.mapToResponse(tool);
  }

  /**
   * Create new tool
   */
  async create(
    createToolDto: CreateToolDto,
    userId: string,
  ): Promise<ToolResponseDto> {
    // Check for duplicate name
    const existing = await this.findByName(createToolDto.name);
    if (existing) {
      throw new ConflictException(`Tool with name "${createToolDto.name}" already exists`);
    }

    // Validate JSON schema if provided
    if (createToolDto.schema) {
      this.validateJsonSchema(createToolDto.schema);
    }

    const tool = await this.prisma.tool.create({
      data: {
        name: createToolDto.name,
        description: createToolDto.description,
        endpoint: createToolDto.endpoint,
        method: createToolDto.method || HttpMethod.POST,
        headers: createToolDto.headers as Prisma.JsonObject | undefined,
        schema: createToolDto.schema as Prisma.JsonObject,
        timeout: createToolDto.timeout || 30000,
        retryCount: createToolDto.retryCount || 3,
        isActive: createToolDto.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            agents: true,
            invocations: true,
          },
        },
      },
    });

    // Audit log
    await this.createAuditLog(userId, AuditAction.CREATE, tool.id, null, {
      name: tool.name,
      endpoint: tool.endpoint,
    });

    this.logger.log(`Tool created: ${tool.name} by ${userId}`);

    return this.mapToResponse(tool);
  }

  /**
   * Update tool
   */
  async update(
    id: string,
    updateToolDto: UpdateToolDto,
    user: CurrentUserData,
  ): Promise<ToolResponseDto> {
    const currentTool = await this.prisma.tool.findUnique({
      where: { id },
    });

    if (!currentTool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    // Check for name conflict if changing name
    if (updateToolDto.name && updateToolDto.name !== currentTool.name) {
      const existing = await this.findByName(updateToolDto.name);
      if (existing) {
        throw new ConflictException(`Tool with name "${updateToolDto.name}" already exists`);
      }
    }

    // Validate JSON schema if provided
    if (updateToolDto.schema) {
      this.validateJsonSchema(updateToolDto.schema);
    }

    const tool = await this.prisma.tool.update({
      where: { id },
      data: {
        name: updateToolDto.name,
        description: updateToolDto.description,
        endpoint: updateToolDto.endpoint,
        method: updateToolDto.method,
        headers: updateToolDto.headers as Prisma.JsonObject | undefined,
        schema: updateToolDto.schema as Prisma.JsonObject | undefined,
        timeout: updateToolDto.timeout,
        retryCount: updateToolDto.retryCount,
        isActive: updateToolDto.isActive,
      },
      include: {
        _count: {
          select: {
            agents: true,
            invocations: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.redis.del(`tool:${id}`);

    // Audit log
    await this.createAuditLog(user.id, AuditAction.UPDATE, id, 
      { name: currentTool.name },
      { name: tool.name, changes: Object.keys(updateToolDto) },
    );

    this.logger.log(`Tool updated: ${tool.name} by ${user.id}`);

    return this.mapToResponse(tool);
  }

  /**
   * Delete tool
   */
  async remove(id: string, user: CurrentUserData): Promise<void> {
    const tool = await this.prisma.tool.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${id} not found`);
    }

    // Check if tool is assigned to agents
    if (tool._count.agents > 0) {
      throw new ConflictException(
        `Cannot delete tool that is assigned to ${tool._count.agents} agent(s)`,
      );
    }

    // Delete invocations first
    await this.prisma.toolInvocation.deleteMany({
      where: { toolId: id },
    });

    // Delete tool
    await this.prisma.tool.delete({
      where: { id },
    });

    // Invalidate cache
    await this.redis.del(`tool:${id}`);

    // Audit log
    await this.createAuditLog(user.id, AuditAction.DELETE, id, 
      { name: tool.name },
      null,
    );

    this.logger.log(`Tool deleted: ${tool.name} by ${user.id}`);
  }

  /**
   * Get tool invocation history
   */
  async getInvocations(id: string, query: ToolsQueryDto): Promise<unknown[]> {
    await this.findOne(id); // Verify exists

    const invocations = await this.prisma.toolInvocation.findMany({
      where: { toolId: id },
      orderBy: {
        createdAt: 'desc',
      },
      skip: query.skip,
      take: query.take,
    });

    return invocations.map(inv => ({
      id: inv.id,
      agentRunId: inv.agentRunId,
      input: inv.input,
      output: inv.output,
      success: inv.success,
      errorMessage: inv.errorMessage,
      duration: inv.duration,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Get tool statistics
   */
  async getStats(id: string): Promise<{
    totalInvocations: number;
    successRate: number;
    avgDurationMs: number;
    agentsUsing: number;
  }> {
    await this.findOne(id); // Verify exists

    const [invocationStats, agentCount, completedInvocations] = await Promise.all([
      this.prisma.toolInvocation.groupBy({
        by: ['success'],
        where: { toolId: id },
        _count: { id: true },
      }),
      this.prisma.agentTool.count({
        where: { toolId: id, isEnabled: true },
      }),
      this.prisma.toolInvocation.findMany({
        where: {
          toolId: id,
          success: true,
          duration: { not: null },
        },
        select: {
          duration: true,
        },
      }),
    ]);

    const totalInvocations = invocationStats.reduce(
      (sum, s) => sum + s._count.id,
      0,
    );
    const successfulInvocations =
      invocationStats.find(s => s.success === true)?._count.id || 0;
    const successRate =
      totalInvocations > 0
        ? Math.round((successfulInvocations / totalInvocations) * 100)
        : 0;

    let avgDurationMs = 0;
    if (completedInvocations.length > 0) {
      const totalDuration = completedInvocations.reduce((sum, inv) => {
        return sum + (inv.duration || 0);
      }, 0);
      avgDurationMs = Math.round(totalDuration / completedInvocations.length);
    }

    return {
      totalInvocations,
      successRate,
      avgDurationMs,
      agentsUsing: agentCount,
    };
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private mapToResponse(tool: any): ToolResponseDto {
    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      endpoint: tool.endpoint,
      method: tool.method,
      headers: tool.headers,
      schema: tool.schema,
      timeout: tool.timeout,
      retryCount: tool.retryCount,
      isActive: tool.isActive,
      isMock: tool.isMock,
      mockResponse: tool.mockResponse,
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
      agentsCount: tool._count?.agents,
      invocationsCount: tool._count?.invocations,
    };
  }

  private validateJsonSchema(schema: Record<string, unknown>): void {
    // Basic JSON Schema validation
    if (!schema.type) {
      throw new ConflictException('JSON Schema must have a "type" property');
    }

    const validTypes = ['object', 'array', 'string', 'number', 'boolean', 'null'];
    if (!validTypes.includes(schema.type as string)) {
      throw new ConflictException(`Invalid JSON Schema type: ${schema.type}`);
    }

    if (schema.type === 'object' && schema.properties) {
      if (typeof schema.properties !== 'object') {
        throw new ConflictException('JSON Schema "properties" must be an object');
      }
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
        entityType: EntityType.TOOL,
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
