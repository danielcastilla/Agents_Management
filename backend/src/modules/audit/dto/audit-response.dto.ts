// ===========================================
// Audit Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, EntityType } from '@prisma/client';

export class AuditUserDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Admin User' })
  name?: string;
}

export class AuditResponseDto {
  @ApiProperty({
    description: 'Audit log ID',
    example: 'uuid-here',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'User ID who performed the action',
    example: 'uuid-here',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'User details',
    type: AuditUserDto,
  })
  user?: AuditUserDto;

  @ApiProperty({
    description: 'Action performed',
    enum: AuditAction,
    example: 'CREATE',
  })
  action: AuditAction;

  @ApiProperty({
    description: 'Entity type affected',
    enum: EntityType,
    example: 'AGENT',
  })
  entityType: EntityType;

  @ApiProperty({
    description: 'Entity ID affected',
    example: 'uuid-here',
  })
  entityId: string;

  @ApiPropertyOptional({
    description: 'Previous value (for updates/deletes)',
    example: { name: 'Old Name' },
  })
  oldValue?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'New value (for creates/updates)',
    example: { name: 'New Name' },
  })
  newValue?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { method: 'POST', path: '/api/agents', duration: 125 },
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Client IP address',
    example: '192.168.1.100',
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
    example: 'Mozilla/5.0...',
  })
  userAgent?: string;

  @ApiProperty({
    description: 'Timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}

export class AuditStatsDto {
  @ApiProperty({
    description: 'Statistics period',
    example: { days: 30, startDate: '2024-01-01', endDate: '2024-01-31' },
  })
  period: {
    days: number;
    startDate: Date;
    endDate: Date;
  };

  @ApiProperty({
    description: 'Total audit logs in period',
    example: 5000,
  })
  totalLogs: number;

  @ApiProperty({
    description: 'Counts by action type',
    example: { CREATE: 1000, UPDATE: 2500, DELETE: 500, LOGIN: 800, LOGOUT: 200 },
  })
  byAction: Record<string, number>;

  @ApiProperty({
    description: 'Counts by entity type',
    example: { AGENT: 2000, USER: 500, TOOL: 300, RUN: 2200 },
  })
  byEntityType: Record<string, number>;

  @ApiProperty({
    description: 'Top active users',
    example: [{ userId: 'uuid', email: 'admin@example.com', name: 'Admin', count: 500 }],
  })
  topUsers: Array<{
    userId: string;
    email: string;
    name?: string;
    count: number;
  }>;

  @ApiProperty({
    description: 'Daily activity counts',
    example: [{ date: '2024-01-15', count: 250 }],
  })
  dailyActivity: Array<{
    date: string;
    count: number;
  }>;
}
