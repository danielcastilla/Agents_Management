// ===========================================
// Agent Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentEnvironment, AgentStatus } from '@prisma/client';

export class AgentCreatorDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string;
}

export class AgentToolDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiPropertyOptional({ example: 'Web Search' })
  name?: string;

  @ApiProperty({ example: true })
  isEnabled: boolean;

  @ApiProperty({ example: 1 })
  priority: number;
}

export class AgentResponseDto {
  @ApiProperty({
    description: 'Agent unique identifier',
    example: 'uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Agent name',
    example: 'Customer Support Agent',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Agent description',
    example: 'Handles customer inquiries and support tickets',
  })
  description?: string;

  @ApiProperty({
    description: 'LLM provider',
    example: 'openai',
  })
  modelProvider: string;

  @ApiProperty({
    description: 'Model name',
    example: 'gpt-4-turbo',
  })
  modelName: string;

  @ApiProperty({
    description: 'Temperature for response generation',
    example: 0.7,
  })
  temperature: number;

  @ApiProperty({
    description: 'Maximum tokens for response',
    example: 4096,
  })
  maxTokens: number;

  @ApiPropertyOptional({
    description: 'System prompt for the agent',
    example: 'You are a helpful customer support assistant...',
  })
  systemPrompt?: string;

  @ApiProperty({
    description: 'Conversation memory enabled',
    example: true,
  })
  memoryEnabled: boolean;

  @ApiProperty({
    description: 'Deployment environment',
    enum: AgentEnvironment,
    example: 'PRODUCTION',
  })
  environment: AgentEnvironment;

  @ApiProperty({
    description: 'Agent status',
    enum: AgentStatus,
    example: 'ACTIVE',
  })
  status: AgentStatus;

  @ApiPropertyOptional({
    description: 'Daily token usage limit',
    example: 100000,
  })
  dailyTokenLimit?: number;

  @ApiProperty({
    description: 'Current version number',
    example: 3,
  })
  version: number;

  @ApiPropertyOptional({
    description: 'Parent agent ID (if cloned)',
    example: 'uuid-here',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Agent creator',
    type: AgentCreatorDto,
  })
  createdBy: AgentCreatorDto;

  @ApiProperty({
    description: 'Creator ID',
    example: 'uuid-here',
  })
  createdById: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-20T15:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Total number of runs',
    example: 150,
  })
  runsCount?: number;

  @ApiPropertyOptional({
    description: 'Total number of versions',
    example: 3,
  })
  versionsCount?: number;

  @ApiPropertyOptional({
    description: 'Associated tools',
    type: [AgentToolDto],
  })
  tools?: AgentToolDto[];
}
