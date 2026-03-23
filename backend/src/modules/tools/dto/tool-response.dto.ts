// ===========================================
// Tool Response DTO
// ===========================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpMethod } from '@prisma/client';

export class ToolResponseDto {
  @ApiProperty({
    description: 'Tool unique identifier',
    example: 'uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Tool name',
    example: 'web_search',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Tool description',
    example: 'Search the web for current information',
  })
  description?: string;

  @ApiProperty({
    description: 'API endpoint URL',
    example: 'https://api.example.com/search',
  })
  endpoint: string;

  @ApiProperty({
    description: 'HTTP method',
    enum: HttpMethod,
    example: 'POST',
  })
  method: HttpMethod;

  @ApiPropertyOptional({
    description: 'HTTP headers',
    example: { 'Authorization': 'Bearer ***' },
  })
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'JSON Schema for tool parameters',
    example: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
    },
  })
  schema?: Record<string, unknown>;

  @ApiProperty({
    description: 'Request timeout in milliseconds',
    example: 30000,
  })
  timeout: number;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 3,
  })
  retryCount: number;

  @ApiProperty({
    description: 'Whether the tool is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the tool returns mock responses',
    example: false,
  })
  isMock: boolean;

  @ApiPropertyOptional({
    description: 'Mock response to return when isMock is true',
  })
  mockResponse?: Record<string, unknown>;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-20T15:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Number of agents using this tool',
    example: 5,
  })
  agentsCount?: number;

  @ApiPropertyOptional({
    description: 'Total invocation count',
    example: 1250,
  })
  invocationsCount?: number;
}
