// ===========================================
// Clone Agent DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { AgentEnvironment } from '@prisma/client';

export class CloneAgentDto {
  @ApiPropertyOptional({
    description: 'Name for the cloned agent (defaults to "[Original Name] (Copy)")',
    example: 'Customer Support Agent - Production',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description for the cloned agent',
    example: 'Production version of customer support agent',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Environment for the cloned agent',
    enum: AgentEnvironment,
  })
  @IsOptional()
  @IsEnum(AgentEnvironment)
  environment?: AgentEnvironment;
}
