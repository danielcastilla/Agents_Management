// ===========================================
// Agent Versions Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AgentVersionResponseDto } from './dto/agent-version-response.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { CurrentUserData } from '@/common/decorators';

@Injectable()
export class AgentVersionsService {
  private readonly logger = new Logger(AgentVersionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all versions for an agent
   */
  async getVersions(
    agentId: string,
    user: CurrentUserData,
  ): Promise<AgentVersionResponseDto[]> {
    // Verify agent exists and user has access
    await this.verifyAccess(agentId, user);

    const versions = await this.prisma.agentVersion.findMany({
      where: { agentId },
      orderBy: { version: 'desc' },
    });

    return versions.map(v => ({
      id: v.id,
      agentId: v.agentId,
      version: v.version,
      configuration: v.configuration as Record<string, unknown>,
      changelog: v.changelog ?? undefined,
      createdAt: v.createdAt,
    }));
  }

  /**
   * Get specific version
   */
  async getVersion(
    agentId: string,
    version: number,
    user: CurrentUserData,
  ): Promise<AgentVersionResponseDto> {
    await this.verifyAccess(agentId, user);

    const agentVersion = await this.prisma.agentVersion.findUnique({
      where: {
        agentId_version: {
          agentId,
          version,
        },
      },
    });

    if (!agentVersion) {
      throw new NotFoundException(`Version ${version} not found for agent ${agentId}`);
    }

    return {
      id: agentVersion.id,
      agentId: agentVersion.agentId,
      version: agentVersion.version,
      configuration: agentVersion.configuration as Record<string, unknown>,
      changelog: agentVersion.changelog ?? undefined,
      createdAt: agentVersion.createdAt,
    };
  }

  /**
   * Restore agent to a previous version
   */
  async restoreVersion(
    agentId: string,
    version: number,
    user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    // Verify access
    const agent = await this.verifyAccess(agentId, user, true);

    // Get the version to restore
    const targetVersion = await this.prisma.agentVersion.findUnique({
      where: {
        agentId_version: {
          agentId,
          version,
        },
      },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Version ${version} not found for agent ${agentId}`);
    }

    const config = targetVersion.configuration as Record<string, unknown>;
    const newVersion = agent.version + 1;

    // Update agent with version configuration
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        name: config.name as string,
        description: config.description as string | null,
        modelProvider: config.modelProvider as string,
        modelName: config.modelName as string,
        temperature: config.temperature as number,
        maxTokens: config.maxTokens as number,
        systemPrompt: config.systemPrompt as string | null,
        memoryEnabled: config.memoryEnabled as boolean,
        environment: config.environment as 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION',
        dailyTokenLimit: config.dailyTokenLimit as number | null,
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

    // Create new version snapshot
    await this.prisma.agentVersion.create({
      data: {
        agentId,
        version: newVersion,
        configuration: config as any,
        changelog: `Restored from version ${version}`,
      },
    });

    // Invalidate cache
    await this.redis.del(`agent:${agentId}`);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: EntityType.AGENT,
        entityId: agentId,
        oldValue: { version: agent.version },
        newValue: { version: newVersion, restoredFrom: version },
        metadata: {
          timestamp: new Date().toISOString(),
          action: 'version_restore',
        },
      },
    });

    this.logger.log(`Agent ${agentId} restored to version ${version} by ${user.id}`);

    return this.mapToResponse(updatedAgent);
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    agentId: string,
    version1: number,
    version2: number,
    user: CurrentUserData,
  ): Promise<{
    version1: Record<string, unknown>;
    version2: Record<string, unknown>;
    differences: string[];
  }> {
    await this.verifyAccess(agentId, user);

    const [v1, v2] = await Promise.all([
      this.getVersion(agentId, version1, user),
      this.getVersion(agentId, version2, user),
    ]);

    const differences: string[] = [];
    const config1 = v1.configuration;
    const config2 = v2.configuration;

    // Compare all keys
    const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);
    
    for (const key of allKeys) {
      if (JSON.stringify(config1[key]) !== JSON.stringify(config2[key])) {
        differences.push(key);
      }
    }

    return {
      version1: config1,
      version2: config2,
      differences,
    };
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private async verifyAccess(
    agentId: string,
    user: CurrentUserData,
    requireWrite = false,
  ): Promise<any> {
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
      return agent;
    }

    // Owner has access
    if (agent.createdById === user.id) {
      return agent;
    }

    // Check permissions
    const permission = agent.permissions.find(p => p.userId === user.id);
    if (!permission) {
      throw new ForbiddenException('You do not have access to this agent');
    }

    if (requireWrite && !permission.canWrite) {
      throw new ForbiddenException('You do not have write access to this agent');
    }

    if (!permission.canRead) {
      throw new ForbiddenException('You do not have access to this agent');
    }

    return agent;
  }

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
}
