// ===========================================
// User Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'user@company.com' })
  email: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName: string | null;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.OPERATOR })
  role: UserRole;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00Z' })
  lastLoginAt: Date | null;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: 5 })
  agentsCount?: number;

  @ApiPropertyOptional({ example: 150 })
  runsCount?: number;
}
