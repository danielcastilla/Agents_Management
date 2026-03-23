// ===========================================
// Tools Query DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { HttpMethod } from '@prisma/client';
import { PaginationDto } from '@/common/dto';

export class ToolsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name or description',
    example: 'search',
  })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by HTTP method',
    enum: HttpMethod,
  })
  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
