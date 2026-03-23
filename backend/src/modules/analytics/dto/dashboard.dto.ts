// ===========================================
// Dashboard DTO
// ===========================================

import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({ example: 25 })
  totalAgents: number;

  @ApiProperty({ example: 18 })
  activeAgents: number;

  @ApiProperty({ example: 1500 })
  totalRuns: number;

  @ApiProperty({ example: 94.5 })
  successRate: number;

  @ApiProperty({ example: 2500000 })
  totalTokens: number;

  @ApiProperty({ example: 12 })
  totalTools: number;

  @ApiProperty({ example: 3 })
  recentErrors: number;
}

export class DashboardTrendsDto {
  @ApiProperty({ description: 'Runs change percentage', example: 15.5 })
  runs: number;

  @ApiProperty({ description: 'Success rate change', example: 2.3 })
  successRate: number;

  @ApiProperty({ description: 'Token usage change percentage', example: -5.2 })
  tokens: number;
}

export class DashboardDto {
  @ApiProperty({
    description: 'Analysis period',
    example: { days: 30, startDate: '2024-01-01', endDate: '2024-01-31' },
  })
  period: {
    days: number;
    startDate: Date;
    endDate: Date;
  };

  @ApiProperty({ type: DashboardSummaryDto })
  summary: DashboardSummaryDto;

  @ApiProperty({ type: DashboardTrendsDto })
  trends: DashboardTrendsDto;
}
