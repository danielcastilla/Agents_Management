// ===========================================
// Audit Query DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString, IsString } from 'class-validator';
import { AuditAction, EntityType } from '@prisma/client';
import { PaginationDto } from '@/common/dto';

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AuditAction,
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: EntityType,
  })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Search in entity ID or IP address',
    example: '192.168',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
