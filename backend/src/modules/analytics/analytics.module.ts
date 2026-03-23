// ===========================================
// Analytics Module
// ===========================================

import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { TokenUsageService } from './token-usage.service';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, TokenUsageService, MetricsService],
  exports: [AnalyticsService, TokenUsageService, MetricsService],
})
export class AnalyticsModule {}
