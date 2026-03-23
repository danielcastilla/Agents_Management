// ===========================================
// Agents Controller
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

import { AgentsService } from './agents.service';
import { AgentVersionsService } from './agent-versions.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CloneAgentDto } from './dto/clone-agent.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { AgentsQueryDto } from './dto/agents-query.dto';
import { AgentVersionResponseDto } from './dto/agent-version-response.dto';
import { Roles, CurrentUser, CurrentUserData } from '@/common/decorators';
import { PaginatedResult } from '@/common/dto';

@ApiTags('Agents')
@ApiBearerAuth('JWT-auth')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly versionsService: AgentVersionsService,
  ) {}

  // ===========================================
  // CRUD Operations
  // ===========================================

  @Get()
  @ApiOperation({ summary: 'Get all agents with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of agents',
    type: [AgentResponseDto],
  })
  async findAll(
    @Query() query: AgentsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaginatedResult<AgentResponseDto>> {
    return this.agentsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent found', type: AgentResponseDto })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new agent' })
  @ApiResponse({
    status: 201,
    description: 'Agent created',
    type: AgentResponseDto,
  })
  async create(
    @Body() createAgentDto: CreateAgentDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.create(createAgentDto, user.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update agent' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent updated', type: AgentResponseDto })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.update(id, updateAgentDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete agent (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Agent deleted' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    await this.agentsService.remove(id, user);
  }

  // ===========================================
  // Agent Actions
  // ===========================================

  @Post(':id/clone')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone an existing agent' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Agent cloned',
    type: AgentResponseDto,
  })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cloneAgentDto: CloneAgentDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.clone(id, cloneAgentDto, user.id);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate agent' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent activated' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.setStatus(id, 'ACTIVE', user);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate agent' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent deactivated' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.setStatus(id, 'INACTIVE', user);
  }

  @Post(':id/deprecate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark agent as deprecated' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent deprecated' })
  async deprecate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.agentsService.setStatus(id, 'DEPRECATED', user);
  }

  // ===========================================
  // Versioning
  // ===========================================

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get agent version history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Version history',
    type: [AgentVersionResponseDto],
  })
  async getVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentVersionResponseDto[]> {
    return this.versionsService.getVersions(id, user);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get specific agent version' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'version', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Agent version',
    type: AgentVersionResponseDto,
  })
  async getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: number,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentVersionResponseDto> {
    return this.versionsService.getVersion(id, version, user);
  }

  @Post(':id/versions/:version/restore')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore agent to a previous version' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'version', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Agent restored to version',
    type: AgentResponseDto,
  })
  async restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: number,
    @CurrentUser() user: CurrentUserData,
  ): Promise<AgentResponseDto> {
    return this.versionsService.restoreVersion(id, version, user);
  }

  // ===========================================
  // Statistics
  // ===========================================

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get agent statistics' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent statistics' })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
  }> {
    return this.agentsService.getStats(id, user);
  }
}
