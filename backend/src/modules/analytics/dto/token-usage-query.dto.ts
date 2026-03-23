// ===========================================
// Token Usage Query DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsUUID, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class TokenUsageQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days to analyze',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({
    description: 'Filter by agent ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by model name',
    example: 'gpt-4o',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
