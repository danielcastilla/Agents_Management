// ===========================================
// Agent Permissions Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '@/common/decorators';

export interface AgentPermissionDto {
  userId: string;
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  canDelete: boolean;
}

export interface AgentPermissionResponse {
  id: string;
  userId: string;
  userEmail: string;
  agentId: string;
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
  canDelete: boolean;
  createdAt: Date;
}

@Injectable()
export class AgentPermissionsService {
  private readonly logger = new Logger(AgentPermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permissions for an agent
   */
  async getPermissions(
    agentId: string,
    user: CurrentUserData,
  ): Promise<AgentPermissionResponse[]> {
    await this.verifyAdminAccess(agentId, user);

    const permissions = await this.prisma.agentPermission.findMany({
      where: { agentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return permissions.map(p => ({
      id: p.id,
      userId: p.userId,
      userEmail: p.user.email,
      agentId: p.agentId,
      canRead: p.canRead,
      canWrite: p.canWrite,
      canExecute: p.canExecute,
      canDelete: p.canDelete,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Add permission for a user on an agent
   */
  async addPermission(
    agentId: string,
    permissionDto: AgentPermissionDto,
    user: CurrentUserData,
  ): Promise<AgentPermissionResponse> {
    await this.verifyAdminAccess(agentId, user);

    // Check if user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: permissionDto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${permissionDto.userId} not found`);
    }

    // Check if permission already exists
    const existing = await this.prisma.agentPermission.findUnique({
      where: {
        userId_agentId: {
          userId: permissionDto.userId,
          agentId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Permission already exists for this user');
    }

    const permission = await this.prisma.agentPermission.create({
      data: {
        userId: permissionDto.userId,
        agentId,
        canRead: permissionDto.canRead,
        canWrite: permissionDto.canWrite,
        canExecute: permissionDto.canExecute,
        canDelete: permissionDto.canDelete,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.createAuditLog(user.id, agentId, null, permissionDto);

    this.logger.log(`Permission added for user ${permissionDto.userId} on agent ${agentId}`);

    return {
      id: permission.id,
      userId: permission.userId,
      userEmail: permission.user.email,
      agentId: permission.agentId,
      canRead: permission.canRead,
      canWrite: permission.canWrite,
      canExecute: permission.canExecute,
      canDelete: permission.canDelete,
      createdAt: permission.createdAt,
    };
  }

  /**
   * Update permission
   */
  async updatePermission(
    agentId: string,
    userId: string,
    permissionDto: Partial<AgentPermissionDto>,
    currentUser: CurrentUserData,
  ): Promise<AgentPermissionResponse> {
    await this.verifyAdminAccess(agentId, currentUser);

    const existing = await this.prisma.agentPermission.findUnique({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Permission not found');
    }

    const permission = await this.prisma.agentPermission.update({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
      data: {
        canRead: permissionDto.canRead ?? existing.canRead,
        canWrite: permissionDto.canWrite ?? existing.canWrite,
        canExecute: permissionDto.canExecute ?? existing.canExecute,
        canDelete: permissionDto.canDelete ?? existing.canDelete,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.createAuditLog(currentUser.id, agentId, existing, permissionDto);

    return {
      id: permission.id,
      userId: permission.userId,
      userEmail: permission.user.email,
      agentId: permission.agentId,
      canRead: permission.canRead,
      canWrite: permission.canWrite,
      canExecute: permission.canExecute,
      canDelete: permission.canDelete,
      createdAt: permission.createdAt,
    };
  }

  /**
   * Remove permission
   */
  async removePermission(
    agentId: string,
    userId: string,
    currentUser: CurrentUserData,
  ): Promise<void> {
    await this.verifyAdminAccess(agentId, currentUser);

    const existing = await this.prisma.agentPermission.findUnique({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Permission not found');
    }

    await this.prisma.agentPermission.delete({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
    });

    // Audit log
    await this.createAuditLog(currentUser.id, agentId, existing, null);

    this.logger.log(`Permission removed for user ${userId} on agent ${agentId}`);
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    agentId: string,
    userId: string,
    permissionType: 'read' | 'write' | 'execute' | 'delete',
  ): Promise<boolean> {
    const permission = await this.prisma.agentPermission.findUnique({
      where: {
        userId_agentId: {
          userId,
          agentId,
        },
      },
    });

    if (!permission) return false;

    switch (permissionType) {
      case 'read': return permission.canRead;
      case 'write': return permission.canWrite;
      case 'execute': return permission.canExecute;
      case 'delete': return permission.canDelete;
      default: return false;
    }
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private async verifyAdminAccess(
    agentId: string,
    user: CurrentUserData,
  ): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Only admin, supervisor, or owner can manage permissions
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPERVISOR &&
      agent.createdById !== user.id
    ) {
      throw new ForbiddenException('You do not have permission to manage agent permissions');
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
        entityType: EntityType.AGENT,
        entityId: agentId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
        metadata: {
          timestamp: new Date().toISOString(),
          action: 'permission_change',
        },
      },
    });
  }
}
