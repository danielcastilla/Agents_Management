// ===========================================
// System Metrics DTO
// ===========================================

import { ApiProperty } from '@nestjs/swagger';

export class SystemInfoDto {
  @ApiProperty({ example: 'linux' })
  platform: string;

  @ApiProperty({ example: 'x64' })
  arch: string;

  @ApiProperty({ example: 'v20.10.0' })
  nodeVersion: string;

  @ApiProperty({ example: { user: 1.5, system: 0.5 } })
  cpuUsage: { user: number; system: number };

  @ApiProperty({
    example: { used: 512, total: 16384, percentage: 3.1, heap: { used: 100, total: 200 } },
  })
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
    heap: { used: number; total: number };
  };

  @ApiProperty({ example: [0.5, 0.7, 0.6] })
  loadAverage: number[];
}

export class DatabaseStatsDto {
  @ApiProperty({ example: true })
  connected: boolean;

  @ApiProperty({
    example: { users: 100, agents: 50, runs: 5000, tools: 20, auditLogs: 10000 },
  })
  tables: Record<string, number>;
}

export class RedisStatsDto {
  @ApiProperty({ example: true })
  connected: boolean;

  @ApiProperty({ example: '50MB' })
  usedMemory?: string;

  @ApiProperty({ example: 10 })
  connectedClients?: number;
}

export class QueueStatsDto {
  @ApiProperty({ example: 5 })
  waiting: number;

  @ApiProperty({ example: 2 })
  active: number;

  @ApiProperty({ example: 1000 })
  completed: number;

  @ApiProperty({ example: 10 })
  failed: number;
}

export class SystemMetricsDto {
  @ApiProperty({ description: 'Uptime in seconds', example: 86400 })
  uptime: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  timestamp: Date;

  @ApiProperty({ type: SystemInfoDto })
  system: SystemInfoDto;

  @ApiProperty({ type: DatabaseStatsDto })
  database: DatabaseStatsDto;

  @ApiProperty({ type: RedisStatsDto })
  redis: RedisStatsDto;

  @ApiProperty({ type: QueueStatsDto })
  queue: QueueStatsDto;
}
