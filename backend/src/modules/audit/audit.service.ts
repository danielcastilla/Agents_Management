// ===========================================
// Audit Service
// ===========================================

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, EntityType, Prisma } from '@prisma/client';
import {
  AuditQueryDto,
  AuditResponseDto,
  CreateAuditDto,
  AuditStatsDto,
} from './dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================
  // Create Audit Log
  // =========================================

  async create(dto: CreateAuditDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: dto.userId,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          oldValue: (dto.oldValue ?? undefined) as any,
          newValue: (dto.newValue ?? undefined) as any,
          metadata: (dto.metadata ?? undefined) as any,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit should not break main operations
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }

  // =========================================
  // Log Helpers
  // =========================================

  async logCreate(
    userId: string,
    entityType: EntityType,
    entityId: string,
    newValue: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.CREATE,
      entityType,
      entityId,
      newValue: this.sanitizeValue(newValue),
      metadata,
    });
  }

  async logUpdate(
    userId: string,
    entityType: EntityType,
    entityId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.UPDATE,
      entityType,
      entityId,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
      metadata,
    });
  }

  async logDelete(
    userId: string,
    entityType: EntityType,
    entityId: string,
    oldValue: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.DELETE,
      entityType,
      entityId,
      oldValue: this.sanitizeValue(oldValue),
      metadata,
    });
  }

  async logLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.LOGIN,
      entityType: EntityType.USER,
      entityId: userId,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  async logLogout(
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.LOGOUT,
      entityType: EntityType.USER,
      entityId: userId,
      metadata,
    });
  }

  async logAccess(
    userId: string,
    entityType: EntityType,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.EXECUTE,
      entityType,
      entityId,
      metadata,
    });
  }

  async logExecute(
    userId: string,
    entityType: EntityType,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.create({
      userId,
      action: AuditAction.EXECUTE,
      entityType,
      entityId,
      metadata,
    });
  }

  // =========================================
  // Query Audit Logs
  // =========================================

  async findAll(
    query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditResponseDto>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map(this.toResponseDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<AuditResponseDto> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Audit log with ID "${id}" not found`);
    }

    return this.toResponseDto(log);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditResponseDto>> {
    return this.findAll({
      ...query,
      entityType: entityType as EntityType,
      entityId,
    } as AuditQueryDto);
  }

  async findByUser(
    userId: string,
    query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditResponseDto>> {
    return this.findAll({
      ...query,
      userId,
    } as AuditQueryDto);
  }

  // =========================================
  // Statistics
  // =========================================

  async getStats(days: number = 30): Promise<AuditStatsDto> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalLogs,
      actionCounts,
      entityCounts,
      topUsers,
      dailyActivity,
    ] = await Promise.all([
      // Total logs in period
      this.prisma.auditLog.count({
        where: { createdAt: { gte: startDate } },
      }),

      // Counts by action
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: startDate } },
        _count: { action: true },
      }),

      // Counts by entity type
      this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where: { createdAt: { gte: startDate } },
        _count: { entityType: true },
      }),

      // Top active users
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: startDate } },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),

      // Daily activity (last 7 days)
      this.getDailyActivity(7),
    ]);

    // Get user details for top users
    const userIds = topUsers.map((u) => u.userId).filter(Boolean) as string[];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      period: { days, startDate, endDate: new Date() },
      totalLogs,
      byAction: actionCounts.reduce(
        (acc, item) => ({
          ...acc,
          [item.action]: item._count.action,
        }),
        {} as Record<string, number>,
      ),
      byEntityType: entityCounts.reduce(
        (acc, item) => ({
          ...acc,
          [item.entityType]: item._count.entityType,
        }),
        {} as Record<string, number>,
      ),
      topUsers: topUsers.map((item) => {
        const user = userMap.get(item.userId!);
        return {
          userId: item.userId!,
          email: user?.email || 'Unknown',
          name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'Unknown',
          count: item._count.userId,
        };
      }),
      dailyActivity,
    };
  }

  private async getDailyActivity(
    days: number,
  ): Promise<Array<{ date: string; count: number }>> {
    const result: Array<{ date: string; count: number }> = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const count = await this.prisma.auditLog.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      result.push({
        date: startOfDay.toISOString().split('T')[0],
        count,
      });
    }

    return result;
  }

  // =========================================
  // Export
  // =========================================

  async exportToCsv(query: AuditQueryDto): Promise<string> {
    const where = this.buildWhereClause(query);

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit export size
    });

    const headers = [
      'ID',
      'Timestamp',
      'User Email',
      'User Name',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.user?.email || '',
      log.user?.firstName ? `${log.user.firstName} ${log.user.lastName || ''}`.trim() : log.user?.email || '',
      log.action,
      log.entityType,
      log.entityId,
      log.ipAddress || '',
      log.userAgent || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    return csvContent;
  }

  async exportToJson(query: AuditQueryDto): Promise<AuditResponseDto[]> {
    const where = this.buildWhereClause(query);

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    return logs.map(this.toResponseDto);
  }

  // =========================================
  // Cleanup
  // =========================================

  async cleanup(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} audit logs older than ${days} days`);

    return result.count;
  }

  // =========================================
  // Private Helpers
  // =========================================

  private buildWhereClause(query: AuditQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.OR = [
        { entityId: { contains: query.search, mode: 'insensitive' } },
        { ipAddress: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private sanitizeValue(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
    ];

    const sanitized = { ...value };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private toResponseDto(log: any): AuditResponseDto {
    return {
      id: log.id,
      userId: log.userId,
      user: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            name: log.user.firstName ? `${log.user.firstName} ${log.user.lastName || ''}`.trim() : log.user.email,
          }
        : undefined,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }
}
