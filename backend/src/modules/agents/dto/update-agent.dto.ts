// ===========================================
// Update Agent DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AgentEnvironment, AgentStatus } from '@prisma/client';

export class UpdateAgentDto {
  @ApiPropertyOptional({
    description: 'Agent name',
    example: 'Customer Support Agent v2',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Agent description',
    example: 'Updated agent for handling complex support tickets',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'LLM provider',
    example: 'anthropic',
    enum: ['openai', 'anthropic', 'azure', 'custom'],
  })
  @IsOptional()
  @IsString()
  modelProvider?: string;

  @ApiPropertyOptional({
    description: 'Model name',
    example: 'claude-3-opus',
  })
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional({
    description: 'Temperature for response generation (0-2)',
    example: 0.5,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum tokens for response',
    example: 8192,
    minimum: 1,
    maximum: 128000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'System prompt for the agent',
    example: 'You are an expert customer support assistant...',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Enable conversation memory',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Deployment environment',
    enum: AgentEnvironment,
  })
  @IsOptional()
  @IsEnum(AgentEnvironment)
  environment?: AgentEnvironment;

  @ApiPropertyOptional({
    description: 'Agent status',
    enum: AgentStatus,
  })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional({
    description: 'Daily token usage limit',
    example: 150000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyTokenLimit?: number;

  @ApiPropertyOptional({
    description: 'Changelog for this update',
    example: 'Updated system prompt for better responses',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changelog?: string;
}
