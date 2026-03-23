// ===========================================
// Chat Request DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChatMessageDto {
  @ApiProperty({
    enum: ['system', 'user', 'assistant', 'tool'],
    example: 'user',
  })
  @IsString()
  role: 'system' | 'user' | 'assistant' | 'tool';

  @ApiProperty({ example: 'Hello, how are you?' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'function_name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'call_abc123' })
  @IsOptional()
  @IsString()
  toolCallId?: string;
}

class FunctionDefinitionDto {
  @ApiProperty({ example: 'get_weather' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Get current weather for a location' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: {
      type: 'object',
      properties: { location: { type: 'string' } },
      required: ['location'],
    },
  })
  @IsOptional()
  parameters?: Record<string, unknown>;
}

class ToolDefinitionDto {
  @ApiProperty({ enum: ['function'], example: 'function' })
  @IsString()
  type: 'function';

  @ApiProperty({ type: FunctionDefinitionDto })
  @ValidateNested()
  @Type(() => FunctionDefinitionDto)
  function: FunctionDefinitionDto;
}

export class ChatRequestDto {
  @ApiProperty({
    description: 'Model to use',
    example: 'gpt-4o',
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({
    description: 'Chat messages',
    type: [ChatMessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({
    description: 'System prompt (added to beginning of messages)',
    example: 'You are a helpful assistant.',
  })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({
    description: 'Sampling temperature (0-2)',
    example: 0.7,
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum tokens to generate',
    example: 1000,
    minimum: 1,
    maximum: 128000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Tools available for the model',
    type: [ToolDefinitionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolDefinitionDto)
  tools?: ToolDefinitionDto[];

  @ApiPropertyOptional({
    description: 'Tool choice strategy',
    example: 'auto',
  })
  @IsOptional()
  toolChoice?: 'auto' | 'none' | 'required';
}
