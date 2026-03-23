// ===========================================
// Run Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RunStatus } from '@prisma/client';

export class RunAgentDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'Customer Support Agent' })
  name: string;

  @ApiProperty({ example: 'openai' })
  modelProvider: string;

  @ApiProperty({ example: 'gpt-4-turbo' })
  modelName: string;
}

export class ToolInvocationSummaryDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'uuid-here' })
  toolId: string;

  @ApiPropertyOptional({ example: 'web_search' })
  toolName?: string;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  startedAt: Date;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:02.000Z' })
  finishedAt?: Date;
}

export class RunResponseDto {
  @ApiProperty({
    description: 'Run unique identifier',
    example: 'uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Agent ID',
    example: 'uuid-here',
  })
  agentId: string;

  @ApiPropertyOptional({
    description: 'Agent details',
    type: RunAgentDto,
  })
  agent?: RunAgentDto;

  @ApiProperty({
    description: 'Run status',
    enum: RunStatus,
    example: 'COMPLETED',
  })
  status: RunStatus;

  @ApiProperty({
    description: 'Input data (messages, context)',
    example: {
      messages: [{ role: 'user', content: 'Hello' }],
      context: {},
    },
  })
  input: unknown;

  @ApiPropertyOptional({
    description: 'Output response from the agent',
    example: {
      role: 'assistant',
      content: 'Hello! How can I help you today?',
    },
  })
  output?: unknown;

  @ApiPropertyOptional({
    description: 'Error message if run failed',
    example: 'Rate limit exceeded',
  })
  error?: string;

  @ApiPropertyOptional({
    description: 'Total tokens used',
    example: 1250,
  })
  tokensUsed?: number;

  @ApiPropertyOptional({
    description: 'Cost in USD',
    example: 0.025,
  })
  cost?: number;

  @ApiPropertyOptional({
    description: 'User ID who triggered the run',
    example: 'uuid-here',
  })
  triggeredBy?: string;

  @ApiPropertyOptional({
    description: 'Parent run ID (for retries)',
    example: 'uuid-here',
  })
  parentRunId?: string;

  @ApiProperty({
    description: 'Run start time',
    example: '2024-01-15T10:00:00.000Z',
  })
  startedAt: Date;

  @ApiPropertyOptional({
    description: 'Run completion time',
    example: '2024-01-15T10:00:05.000Z',
  })
  finishedAt?: Date;

  @ApiPropertyOptional({
    description: 'Duration in milliseconds',
    example: 5000,
  })
  durationMs?: number;

  @ApiPropertyOptional({
    description: 'Number of tool invocations',
    example: 3,
  })
  toolInvocationsCount?: number;

  @ApiPropertyOptional({
    description: 'Tool invocation details',
    type: [ToolInvocationSummaryDto],
  })
  toolInvocations?: ToolInvocationSummaryDto[];
}
