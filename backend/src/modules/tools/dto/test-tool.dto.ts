// ===========================================
// Test Tool DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsBoolean } from 'class-validator';

export class TestToolDto {
  @ApiProperty({
    description: 'Input data to test the tool with',
    example: {
      query: 'test search query',
      limit: 5,
    },
  })
  @IsObject()
  input: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Use mock response instead of real API call',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mock?: boolean;

  @ApiPropertyOptional({
    description: 'Mock response to return (if mock=true)',
    example: {
      results: [{ title: 'Test result', url: 'https://example.com' }],
    },
  })
  @IsOptional()
  @IsObject()
  mockResponse?: Record<string, unknown>;
}
