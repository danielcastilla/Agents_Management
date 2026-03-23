// ===========================================
// Analytics Controller
// ===========================================

import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TokenUsageService } from './token-usage.service';
import { MetricsService } from './metrics.service';
import {
  DashboardDto,
  TimeSeriesQueryDto,
  TokenUsageQueryDto,
  AgentAnalyticsDto,
  SystemMetricsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly tokenUsageService: TokenUsageService,
    private readonly metricsService: MetricsService,
  ) {}

  // =========================================
  // Dashboard Overview
  // =========================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview metrics' })
  @ApiQuery({ name: 'days', required: false, description: 'Period in days (default: 30)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard metrics',
    type: DashboardDto,
  })
  async getDashboard(
    @Query('days') days?: number,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ): Promise<DashboardDto> {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.analyticsService.getDashboard(days || 30, isAdmin ? undefined : userId);
  }

  // =========================================
  // Runs Analytics
  // =========================================

  @Get('runs/timeseries')
  @ApiOperation({ summary: 'Get runs time series data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Runs over time',
  })
  async getRunsTimeSeries(
    @Query() query: TimeSeriesQueryDto,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.analyticsService.getRunsTimeSeries(
      query,
      isAdmin ? undefined : userId,
    );
  }

  @Get('runs/by-status')
  @ApiOperation({ summary: 'Get runs breakdown by status' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Runs by status',
  })
  async getRunsByStatus(
    @Query('days') days?: number,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.analyticsService.getRunsByStatus(
      days || 30,
      isAdmin ? undefined : userId,
    );
  }

  @Get('runs/performance')
  @ApiOperation({ summary: 'Get runs performance metrics (avg duration, success rate)' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Performance metrics',
  })
  async getRunsPerformance(
    @Query('days') days?: number,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.analyticsService.getRunsPerformance(
      days || 30,
      isAdmin ? undefined : userId,
    );
  }

  // =========================================
  // Token Usage Analytics
  // =========================================

  @Get('tokens/usage')
  @ApiOperation({ summary: 'Get token usage statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token usage data',
  })
  async getTokenUsage(
    @Query() query: TokenUsageQueryDto,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.tokenUsageService.getUsage(query, isAdmin ? undefined : userId);
  }

  @Get('tokens/timeseries')
  @ApiOperation({ summary: 'Get token usage time series' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token usage over time',
  })
  async getTokenTimeSeries(
    @Query() query: TimeSeriesQueryDto,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.tokenUsageService.getTimeSeries(
      query,
      isAdmin ? undefined : userId,
    );
  }

  @Get('tokens/by-model')
  @ApiOperation({ summary: 'Get token usage breakdown by model' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token usage by model',
  })
  async getTokensByModel(
    @Query('days') days?: number,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.tokenUsageService.getByModel(
      days || 30,
      isAdmin ? undefined : userId,
    );
  }

  @Get('tokens/costs')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get estimated costs (admin only)' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cost estimates',
  })
  async getTokenCosts(@Query('days') days?: number) {
    return this.tokenUsageService.getCostEstimates(days || 30);
  }

  // =========================================
  // Agent Analytics
  // =========================================

  @Get('agents/top')
  @ApiOperation({ summary: 'Get top performing agents' })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top agents',
  })
  async getTopAgents(
    @Query('days') days?: number,
    @Query('limit') limit?: number,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ): Promise<AgentAnalyticsDto[]> {
    const isAdmin = userRole === UserRole.ADMIN;
    return this.analyticsService.getTopAgents(
      days || 30,
      limit || 10,
      isAdmin ? undefined : userId,
    );
  }

  @Get('agents/:agentId/stats')
  @ApiOperation({ summary: 'Get detailed stats for a specific agent' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agent statistics',
  })
  async getAgentStats(
    @Query('agentId') agentId: string,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getAgentStats(agentId, days || 30);
  }

  // =========================================
  // Tools Analytics
  // =========================================

  @Get('tools/top')
  @ApiOperation({ summary: 'Get most used tools' })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top tools',
  })
  async getTopTools(
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTopTools(days || 30, limit || 10);
  }

  @Get('tools/success-rate')
  @ApiOperation({ summary: 'Get tool success rates' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tool success rates',
  })
  async getToolSuccessRates(@Query('days') days?: number) {
    return this.analyticsService.getToolSuccessRates(days || 30);
  }

  // =========================================
  // System Metrics (Admin Only)
  // =========================================

  @Get('system/metrics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get system metrics (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System metrics',
    type: SystemMetricsDto,
  })
  async getSystemMetrics(): Promise<SystemMetricsDto> {
    return this.metricsService.getSystemMetrics();
  }

  @Get('system/health')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get system health indicators (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System health',
  })
  async getSystemHealth() {
    return this.metricsService.getHealthIndicators();
  }

  // =========================================
  // User Analytics (Admin Only)
  // =========================================

  @Get('users/activity')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user activity stats (admin only)' })
  @ApiQuery({ name: 'days', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User activity',
  })
  async getUserActivity(@Query('days') days?: number) {
    return this.analyticsService.getUserActivity(days || 30);
  }

  @Get('users/top')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get most active users (admin only)' })
  @ApiQuery({ name: 'days', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top users',
  })
  async getTopUsers(
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTopUsers(days || 30, limit || 10);
  }
}
