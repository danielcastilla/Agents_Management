// ===========================================
// Auth Response DTO
// ===========================================

import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

class UserInfo {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Doe', nullable: true })
  lastName: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.OPERATOR })
  role: UserRole;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 86400,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
    type: UserInfo,
  })
  user: UserInfo;
}
