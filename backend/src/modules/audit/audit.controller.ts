// ===========================================
// Audit Controller
// ===========================================

import {
  Controller,
  Get,
  Query,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditQueryDto, AuditResponseDto, AuditStatsDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '@/modules/auth/guards';
import { Roles } from '../../common/decorators';
import { UserRole } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // =========================================
  // Query Audit Logs
  // =========================================

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Query audit logs with filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of audit logs',
  })
  async findAll(
    @Query() query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditResponseDto>> {
    return this.auditService.findAll(query);
  }

  // =========================================
  // Get Single Audit Log
  // =========================================

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiParam({ name: 'id', description: 'Audit log ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit log details',
    type: AuditResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Audit log not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditResponseDto> {
    return this.auditService.findOne(id);
  }

  // =========================================
  // Get Logs by Entity
  // =========================================

  @Get('entity/:entityType/:entityId')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get audit logs for a specific entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (e.g., AGENT, USER, TOOL)' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs for the entity',
  })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditResponseDto>> {
    return this.auditService.findByEntity(entityType, entityId, query);
  }

  // =========================================
  // Get Logs by User
  // =========================================

  @Get('user/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs for the user',
  })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AuditQueryDto,
  ): Promise<PaginatedResult<AuditResponseDto>> {
    return this.auditService.findByUser(userId, query);
  }

  // =========================================
  // Get Audit Statistics
  // =========================================

  @Get('stats/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit log statistics' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to include (default: 30)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit statistics',
    type: AuditStatsDto,
  })
  async getStats(
    @Query('days') days?: number,
  ): Promise<AuditStatsDto> {
    return this.auditService.getStats(days || 30);
  }

  // =========================================
  // Export Audit Logs
  // =========================================

  @Get('export/csv')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV file download',
  })
  async exportCsv(
    @Query() query: AuditQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.auditService.exportToCsv(query);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
    );
    res.send(csv);
  }

  @Get('export/json')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export audit logs as JSON' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'JSON file download',
  })
  async exportJson(
    @Query() query: AuditQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.auditService.exportToJson(query);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.json`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  // =========================================
  // Cleanup Old Logs
  // =========================================

  @Delete('cleanup')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete audit logs older than specified days' })
  @ApiQuery({ name: 'days', description: 'Delete logs older than this many days' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Number of deleted records',
  })
  async cleanup(
    @Query('days') days: number,
  ): Promise<{ deleted: number }> {
    const deleted = await this.auditService.cleanup(days);
    return { deleted };
  }
}
