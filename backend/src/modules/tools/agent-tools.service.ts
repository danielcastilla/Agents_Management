// ===========================================
// Agent-Tools Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { UserRole, AuditAction, EntityType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AssignToolDto } from './dto/assign-tool.dto';
import { CurrentUserData } from '@/common/decorators';

export interface AgentToolResponse {
  id: string;
  toolId: string;
  toolName: string;
  toolDescription: string | undefined;
  isEnabled: boolean;
  priority: number;
  config: Record<string, unknown> | undefined;
  createdAt: Date;
}

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all tools assigned to an agent
   */
  async getAgentTools(
    agentId: string,
    user: CurrentUserData,
  ): Promise<AgentToolResponse[]> {
    // Verify agent exists and user has access
    await this.verifyAgentAccess(agentId, user);

    const agentTools = await this.prisma.agentTool.findMany({
      where: { agentId },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            description: true,
            endpoint: true,
            method: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        priority: 'asc',
      },
    });

    return agentTools.map(at => ({
      id: at.id,
      toolId: at.tool.id,
      toolName: at.tool.name,
      toolDescription: at.tool.description ?? undefined,
      isEnabled: at.isEnabled,
      priority: at.priority,
      config: at.config as Record<string, unknown> | undefined,
      createdAt: at.createdAt,
    }));
  }

  /**
   * Assign a tool to an agent
   */
  async assignTool(
    agentId: string,
    assignDto: AssignToolDto,
    user: CurrentUserData,
  ): Promise<AgentToolResponse> {
    // Verify agent access
    await this.verifyAgentAccess(agentId, user, true);

    // Verify tool exists
    const tool = await this.prisma.tool.findUnique({
      where: { id: assignDto.toolId },
    });

    if (!tool) {
      throw new NotFoundException(`Tool with ID ${assignDto.toolId} not found`);
    }

    // Check if already assigned
    const existing = await this.prisma.agentTool.findUnique({
      where: {
        agentId_toolId: {
          agentId,
          toolId: assignDto.toolId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Tool is already assigned to this agent');
    }

    // Get next priority if not specified
    let priority = assignDto.priority;
    if (priority === undefined) {
      const maxPriority = await this.prisma.agentTool.aggregate({
        where: { agentId },
        _max: { priority: true },
      });
      priority = (maxPriority._max.priority || 0) + 1;
    }

    // Create assignment
    const agentTool = await this.prisma.agentTool.create({
      data: {
        agentId,
        toolId: assignDto.toolId,
        isEnabled: assignDto.isEnabled ?? true,
        priority,
        config: assignDto.config as Prisma.JsonObject | undefined,
      },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Audit log
    await this.createAuditLog(user.id, agentId, null, {
      toolId: tool.id,
      toolName: tool.name,
      action: 'assign',
    });

    this.logger.log(`Tool ${tool.name} assigned to agent ${agentId} by ${user.id}`);

    return {
      id: agentTool.id,
      toolId: agentTool.tool.id,
      toolName: agentTool.tool.name,
      toolDescription: agentTool.tool.description ?? undefined,
      isEnabled: agentTool.isEnabled,
      priority: agentTool.priority,
      config: agentTool.config as Record<string, unknown> | undefined,
      createdAt: agentTool.createdAt,
    };
  }

  /**
   * Update tool assignment
   */
  async updateAssignment(
    agentId: string,
    toolId: string,
    updateDto: Partial<AssignToolDto>,
    user: CurrentUserData,
  ): Promise<AgentToolResponse> {
    // Verify agent access
    await this.verifyAgentAccess(agentId, user, true);

    // Check if assignment exists
    const existing = await this.prisma.agentTool.findUnique({
      where: {
        agentId_toolId: {
          agentId,
          toolId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Tool assignment not found');
    }

    // Update assignment
    const agentTool = await this.prisma.agentTool.update({
      where: {
        agentId_toolId: {
          agentId,
          toolId,
        },
      },
      data: {
        isEnabled: updateDto.isEnabled ?? existing.isEnabled,
        priority: updateDto.priority ?? existing.priority,
        config: (updateDto.config as Prisma.JsonObject | undefined) ?? (existing.config as Prisma.JsonObject | undefined),
      },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Audit log
    await this.createAuditLog(user.id, agentId, existing, updateDto);

    this.logger.log(`Tool assignment updated for agent ${agentId} by ${user.id}`);

    return {
      id: agentTool.id,
      toolId: agentTool.tool.id,
      toolName: agentTool.tool.name,
      toolDescription: agentTool.tool.description ?? undefined,
      isEnabled: agentTool.isEnabled,
      priority: agentTool.priority,
      config: agentTool.config as Record<string, unknown> | undefined,
      createdAt: agentTool.createdAt,
    };
  }

  /**
   * Remove tool from agent
   */
  async removeFromAgent(
    agentId: string,
    toolId: string,
    user: CurrentUserData,
  ): Promise<void> {
    // Verify agent access
    await this.verifyAgentAccess(agentId, user, true);

    // Check if assignment exists
    const existing = await this.prisma.agentTool.findUnique({
      where: {
        agentId_toolId: {
          agentId,
          toolId,
        },
      },
      include: {
        tool: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Tool assignment not found');
    }

    // Delete assignment
    await this.prisma.agentTool.delete({
      where: {
        agentId_toolId: {
          agentId,
          toolId,
        },
      },
    });

    // Audit log
    await this.createAuditLog(user.id, agentId, {
      toolId,
      toolName: existing.tool.name,
    }, null);

    this.logger.log(`Tool ${existing.tool.name} removed from agent ${agentId} by ${user.id}`);
  }

  /**
   * Reorder tools for an agent
   */
  async reorderTools(
    agentId: string,
    toolIds: string[],
    user: CurrentUserData,
  ): Promise<AgentToolResponse[]> {
    // Verify agent access
    await this.verifyAgentAccess(agentId, user, true);

    // Update priorities
    await Promise.all(
      toolIds.map((toolId, index) =>
        this.prisma.agentTool.update({
          where: {
            agentId_toolId: {
              agentId,
              toolId,
            },
          },
          data: {
            priority: index + 1,
          },
        }),
      ),
    );

    this.logger.log(`Tools reordered for agent ${agentId} by ${user.id}`);

    return this.getAgentTools(agentId, user);
  }

  /**
   * Get enabled tools for an agent (for execution)
   */
  async getEnabledTools(agentId: string): Promise<any[]> {
    const agentTools = await this.prisma.agentTool.findMany({
      where: {
        agentId,
        isEnabled: true,
        tool: {
          isActive: true,
        },
      },
      include: {
        tool: true,
      },
      orderBy: {
        priority: 'asc',
      },
    });

    return agentTools.map(at => ({
      ...at.tool,
      config: at.config,
    }));
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private async verifyAgentAccess(
    agentId: string,
    user: CurrentUserData,
    requireWrite = false,
  ): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        permissions: true,
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Admins and supervisors have full access
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return;
    }

    // Owner has access
    if (agent.createdById === user.id) {
      return;
    }

    // Check permissions
    const permission = agent.permissions.find(p => p.userId === user.id);
    if (!permission || !permission.canRead) {
      throw new ForbiddenException('You do not have access to this agent');
    }

    if (requireWrite && !permission.canWrite) {
      throw new ForbiddenException('You do not have write access to this agent');
    }
  }

  private async createAuditLog(
    userId: string,
    agentId: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.CONFIG_CHANGE,
        entityType: EntityType.TOOL,
        entityId: agentId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
        metadata: {
          timestamp: new Date().toISOString(),
          action: 'tool_assignment',
        },
      },
    });
  }
}
