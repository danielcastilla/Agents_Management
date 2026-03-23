// ===========================================
// Time Series Query DTO
// ===========================================

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Granularity {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class TimeSeriesQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days to analyze',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({
    description: 'Data granularity',
    enum: Granularity,
    default: 'day',
  })
  @IsOptional()
  @IsEnum(Granularity)
  granularity?: 'hour' | 'day' | 'week' | 'month';
}
