// ===========================================
// Runs Query DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { RunStatus } from '@prisma/client';
import { PaginationDto } from '@/common/dto';

export class RunsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: RunStatus,
  })
  @IsOptional()
  @IsEnum(RunStatus)
  status?: RunStatus;

  @ApiPropertyOptional({
    description: 'Filter by agent ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'Filter runs started after this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter runs started before this date',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
