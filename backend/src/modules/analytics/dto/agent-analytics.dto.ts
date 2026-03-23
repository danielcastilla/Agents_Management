// ===========================================
// Agent Analytics DTO
// ===========================================

import { ApiProperty } from '@nestjs/swagger';
import { AgentEnvironment } from '@prisma/client';

export class AgentAnalyticsDto {
  @ApiProperty({ example: 'uuid-here' })
  agentId: string;

  @ApiProperty({ example: 'Customer Support Agent' })
  name: string;

  @ApiProperty({ example: 'gpt-4o' })
  model: string;

  @ApiProperty({ enum: AgentEnvironment, example: 'production' })
  environment: AgentEnvironment;

  @ApiProperty({ example: 500 })
  totalRuns: number;

  @ApiProperty({ example: 95.5 })
  successRate: number;

  @ApiProperty({ description: 'Average duration in ms', example: 2500 })
  avgDuration: number;

  @ApiProperty({ example: 150000 })
  totalTokens: number;
}
