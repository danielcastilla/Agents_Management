// ===========================================
// Notification DTOs
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { NotificationType, NotificationPriority } from '../websocket.constants';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: NotificationType, example: 'info' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ enum: NotificationPriority, example: 'medium' })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiProperty({ example: 'Task Completed' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Your agent has finished processing.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ example: { runId: '123', agentId: '456' } })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '/runs/123' })
  @IsOptional()
  @IsString()
  actionUrl?: string;
}

export class BulkNotificationDto {
  @ApiProperty({ description: 'Target user IDs', type: [String] })
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionUrl?: string;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean = false;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ enum: NotificationPriority })
  priority: NotificationPriority;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: Record<string, unknown>;

  @ApiPropertyOptional()
  actionUrl?: string;

  @ApiProperty()
  read: boolean;

  @ApiProperty()
  createdAt: Date;
}
