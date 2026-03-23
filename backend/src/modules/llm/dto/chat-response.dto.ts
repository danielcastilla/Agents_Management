// ===========================================
// Chat Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LlmProviderType } from '../llm.constants';

class ToolCallDto {
  @ApiProperty({ example: 'call_abc123' })
  id: string;

  @ApiProperty({ example: 'function' })
  type: 'function';

  @ApiProperty({
    example: { name: 'get_weather', arguments: '{"location":"London"}' },
  })
  function: {
    name: string;
    arguments: string;
  };
}

class MessageDto {
  @ApiProperty({ enum: ['assistant'], example: 'assistant' })
  role: 'assistant';

  @ApiProperty({ example: 'Hello! I am doing well, thank you for asking.' })
  content: string;

  @ApiPropertyOptional({ type: [ToolCallDto] })
  toolCalls?: ToolCallDto[];
}

class UsageDto {
  @ApiProperty({ example: 50 })
  promptTokens: number;

  @ApiProperty({ example: 25 })
  completionTokens: number;

  @ApiProperty({ example: 75 })
  totalTokens: number;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'Response ID',
    example: 'chatcmpl-abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Model used',
    example: 'gpt-4o',
  })
  model: string;

  @ApiProperty({
    description: 'Provider used',
    enum: LlmProviderType,
    example: 'openai',
  })
  provider: LlmProviderType;

  @ApiProperty({
    description: 'Assistant message',
    type: MessageDto,
  })
  message: MessageDto;

  @ApiProperty({
    description: 'Reason for finishing',
    enum: ['stop', 'length', 'tool_calls', 'content_filter'],
    example: 'stop',
  })
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;

  @ApiProperty({
    description: 'Token usage',
    type: UsageDto,
  })
  usage: UsageDto;
}
