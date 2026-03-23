// ===========================================
// Create Agent DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AgentEnvironment } from '@prisma/client';

export class CreateAgentDto {
  @ApiProperty({
    description: 'Agent name',
    example: 'Customer Support Agent',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Agent description',
    example: 'Handles customer inquiries and support tickets',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'LLM provider',
    example: 'openai',
    enum: ['openai', 'anthropic', 'azure', 'custom'],
  })
  @IsString()
  @IsNotEmpty()
  modelProvider: string;

  @ApiProperty({
    description: 'Model name',
    example: 'gpt-4-turbo',
  })
  @IsString()
  @IsNotEmpty()
  modelName: string;

  @ApiPropertyOptional({
    description: 'Temperature for response generation (0-2)',
    example: 0.7,
    default: 0.7,
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
    example: 4096,
    default: 4096,
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
    example: 'You are a helpful customer support assistant...',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Enable conversation memory',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Deployment environment',
    enum: AgentEnvironment,
    default: 'DEVELOPMENT',
  })
  @IsOptional()
  @IsEnum(AgentEnvironment)
  environment?: AgentEnvironment;

  @ApiPropertyOptional({
    description: 'Daily token usage limit',
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyTokenLimit?: number;
}
