// ===========================================
// Create Run DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsObject,
  IsUUID,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
  @ApiProperty({
    description: 'Message role',
    example: 'user',
    enum: ['system', 'user', 'assistant', 'function', 'tool'],
  })
  @IsString()
  @IsNotEmpty()
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, how can you help me today?',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Function/tool name (for function/tool messages)',
    example: 'get_weather',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Tool call ID (for tool messages)',
    example: 'call_abc123',
  })
  @IsOptional()
  @IsString()
  tool_call_id?: string;
}

export class CreateRunDto {
  @ApiProperty({
    description: 'Agent ID to execute',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  agentId: string;

  @ApiProperty({
    description: 'Input messages for the agent',
    type: [MessageDto],
    example: [
      { role: 'user', content: 'What is the weather in Tokyo?' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({
    description: 'Additional context for the run',
    example: { userId: 'user123', sessionId: 'session456' },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Metadata to attach to the run',
    example: { source: 'api', version: '1.0' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Override temperature for this run (0-2)',
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
    description: 'Override max tokens for this run',
    example: 2048,
    minimum: 1,
    maximum: 128000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Queue priority (1=highest, 10=lowest)',
    example: 1,
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Parent run ID (for retries or chained runs)',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  parentRunId?: string;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds for sync execution',
    example: 60000,
    minimum: 1000,
    maximum: 300000,
    default: 120000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  timeout?: number;
}
