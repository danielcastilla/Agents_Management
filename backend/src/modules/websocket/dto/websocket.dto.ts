// ===========================================
// WebSocket DTOs
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ enum: ['agent', 'run', 'user', 'organization'] })
  @IsString()
  @IsNotEmpty()
  type: 'agent' | 'run' | 'user' | 'organization';

  @ApiProperty({ description: 'Resource ID to subscribe to' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class JoinRoomDto {
  @ApiProperty({ description: 'Room name to join' })
  @IsString()
  @IsNotEmpty()
  room: string;
}

export class UpdatePresenceDto {
  @ApiProperty({ enum: ['online', 'away', 'busy', 'offline'] })
  @IsEnum(['online', 'away', 'busy', 'offline'])
  status: 'online' | 'away' | 'busy' | 'offline';

  @ApiPropertyOptional({ description: 'Current activity description' })
  @IsOptional()
  @IsString()
  activity?: string;
}

export class ConnectionStatsDto {
  @ApiProperty({ description: 'Total active connections' })
  totalConnections: number;

  @ApiProperty({ description: 'Unique connected users' })
  uniqueUsers: number;

  @ApiProperty({ description: 'Number of active rooms' })
  roomsCount: number;
}

export class OnlineUserDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: ['online', 'away', 'busy'] })
  status: string;

  @ApiPropertyOptional()
  activity?: string;

  @ApiProperty()
  connectedAt: Date;
}
