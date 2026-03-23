// ===========================================
// Agents Query DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { AgentEnvironment, AgentStatus } from '@prisma/client';
import { PaginationDto } from '@/common/dto';

export class AgentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name or description',
    example: 'support',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by environment',
    enum: AgentEnvironment,
  })
  @IsOptional()
  @IsEnum(AgentEnvironment)
  environment?: AgentEnvironment;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: AgentStatus,
  })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional({
    description: 'Filter by model provider',
    example: 'openai',
    enum: ['openai', 'anthropic', 'azure', 'custom'],
  })
  @IsOptional()
  @IsString()
  modelProvider?: string;

  @ApiPropertyOptional({
    description: 'Filter by creator ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  createdById?: string;
}
