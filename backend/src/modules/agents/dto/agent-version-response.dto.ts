// ===========================================
// Agent Version Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentVersionResponseDto {
  @ApiProperty({
    description: 'Version record unique identifier',
    example: 'uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Agent ID',
    example: 'uuid-here',
  })
  agentId: string;

  @ApiProperty({
    description: 'Version number',
    example: 3,
  })
  version: number;

  @ApiProperty({
    description: 'Agent configuration at this version',
    example: {
      name: 'Customer Support Agent',
      modelProvider: 'openai',
      modelName: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: 'You are a helpful assistant...',
      memoryEnabled: true,
      environment: 'PRODUCTION',
    },
  })
  configuration: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Changelog for this version',
    example: 'Updated system prompt for better responses',
  })
  changelog?: string;

  @ApiProperty({
    description: 'Version creation date',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;
}
