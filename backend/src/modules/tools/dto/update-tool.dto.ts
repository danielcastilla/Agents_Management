// ===========================================
// Update Tool DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
  IsUrl,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { HttpMethod } from '@prisma/client';

export class UpdateToolDto {
  @ApiPropertyOptional({
    description: 'Tool name (unique, snake_case)',
    example: 'web_search_v2',
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Name must be lowercase, start with a letter, and contain only letters, numbers, and underscores',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Tool description',
    example: 'Enhanced web search with filtering',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'API endpoint URL',
    example: 'https://api.example.com/v2/search',
  })
  @IsOptional()
  @IsString()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'HTTP method',
    enum: HttpMethod,
  })
  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @ApiPropertyOptional({
    description: 'HTTP headers',
    example: { 'Authorization': 'Bearer {{API_KEY}}' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'JSON Schema for tool parameters',
  })
  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Request timeout in milliseconds',
    example: 30000,
    minimum: 1000,
    maximum: 120000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  timeout?: number;

  @ApiPropertyOptional({
    description: 'Number of retry attempts on failure',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({
    description: 'Whether the tool is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
