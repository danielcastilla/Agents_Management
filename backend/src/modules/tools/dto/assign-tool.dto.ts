// ===========================================
// Assign Tool DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class AssignToolDto {
  @ApiProperty({
    description: 'Tool ID to assign',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  toolId: string;

  @ApiPropertyOptional({
    description: 'Whether the tool is enabled for this agent',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Priority order (lower = higher priority)',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Agent-specific configuration for this tool',
    example: {
      maxResults: 5,
      language: 'en',
    },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
