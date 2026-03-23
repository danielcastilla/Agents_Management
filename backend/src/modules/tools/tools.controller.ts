// ===========================================
// Tools Controller
// ===========================================

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ToolsService } from './tools.service';
import { AgentToolsService } from './agent-tools.service';
import { ToolExecutionService } from './tool-execution.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolResponseDto } from './dto/tool-response.dto';
import { ToolsQueryDto } from './dto/tools-query.dto';
import { AssignToolDto } from './dto/assign-tool.dto';
import { TestToolDto } from './dto/test-tool.dto';
import { Roles, CurrentUser, CurrentUserData } from '@/common/decorators';
import { PaginatedResult } from '@/common/dto';

@ApiTags('Tools')
@ApiBearerAuth('JWT-auth')
@Controller('tools')
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly agentToolsService: AgentToolsService,
    private readonly executionService: ToolExecutionService,
  ) {}

  // ===========================================
  // Tool CRUD
  // ===========================================

  @Get()
  @ApiOperation({ summary: 'Get all tools with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of tools',
    type: [ToolResponseDto],
  })
  async findAll(
    @Query() query: ToolsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaginatedResult<ToolResponseDto>> {
    return this.toolsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tool by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tool found', type: ToolResponseDto })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ToolResponseDto> {
    return this.toolsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new tool' })
  @ApiResponse({
    status: 201,
    description: 'Tool created',
    type: ToolResponseDto,
  })
  async create(
    @Body() createToolDto: CreateToolDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ToolResponseDto> {
    return this.toolsService.create(createToolDto, user.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Update tool' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tool updated', type: ToolResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateToolDto: UpdateToolDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ToolResponseDto> {
    return this.toolsService.update(id, updateToolDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tool' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Tool deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    await this.toolsService.remove(id, user);
  }

  // ===========================================
  // Tool Testing
  // ===========================================

  @Post(':id/test')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test tool execution' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tool test result' })
  async testTool(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() testDto: TestToolDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{
    success: boolean;
    output?: unknown;
    error?: string;
    durationMs: number;
  }> {
    return this.executionService.testTool(id, testDto, user);
  }

  // ===========================================
  // Agent-Tool Association
  // ===========================================

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Get tools assigned to an agent' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'List of assigned tools',
  })
  async getAgentTools(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<unknown[]> {
    return this.agentToolsService.getAgentTools(agentId, user);
  }

  @Post('agent/:agentId/assign')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign tool to an agent' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Tool assigned' })
  async assignTool(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Body() assignDto: AssignToolDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<unknown> {
    return this.agentToolsService.assignTool(agentId, assignDto, user);
  }

  @Put('agent/:agentId/tool/:toolId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update tool assignment' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'toolId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Assignment updated' })
  async updateAssignment(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Param('toolId', ParseUUIDPipe) toolId: string,
    @Body() updateDto: Partial<AssignToolDto>,
    @CurrentUser() user: CurrentUserData,
  ): Promise<unknown> {
    return this.agentToolsService.updateAssignment(agentId, toolId, updateDto, user);
  }

  @Delete('agent/:agentId/tool/:toolId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove tool from agent' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'toolId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Tool removed from agent' })
  async removeFromAgent(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Param('toolId', ParseUUIDPipe) toolId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    await this.agentToolsService.removeFromAgent(agentId, toolId, user);
  }

  // ===========================================
  // Tool Invocation History
  // ===========================================

  @Get(':id/invocations')
  @ApiOperation({ summary: 'Get tool invocation history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Invocation history' })
  async getInvocations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ToolsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<unknown[]> {
    return this.toolsService.getInvocations(id, query);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get tool usage statistics' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tool statistics' })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{
    totalInvocations: number;
    successRate: number;
    avgDurationMs: number;
    agentsUsing: number;
  }> {
    return this.toolsService.getStats(id);
  }
}
