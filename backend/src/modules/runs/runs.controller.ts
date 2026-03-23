// ===========================================
// Runs Controller
// ===========================================

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Sse,
  MessageEvent,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserRole } from '@prisma/client';

import { RunsService } from './runs.service';
import { RunExecutionService } from './run-execution.service';
import { RunStreamService } from './run-stream.service';
import { CreateRunDto } from './dto/create-run.dto';
import { RunResponseDto } from './dto/run-response.dto';
import { RunsQueryDto } from './dto/runs-query.dto';
import { Roles, CurrentUser, CurrentUserData } from '@/common/decorators';
import { PaginatedResult } from '@/common/dto';

@ApiTags('Runs')
@ApiBearerAuth('JWT-auth')
@Controller('runs')
export class RunsController {
  constructor(
    private readonly runsService: RunsService,
    private readonly executionService: RunExecutionService,
    private readonly streamService: RunStreamService,
  ) {}

  // ===========================================
  // Run Management
  // ===========================================

  @Get()
  @ApiOperation({ summary: 'Get all runs with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of runs',
    type: [RunResponseDto],
  })
  async findAll(
    @Query() query: RunsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaginatedResult<RunResponseDto>> {
    return this.runsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get run by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Run found', type: RunResponseDto })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RunResponseDto> {
    return this.runsService.findOne(id, user);
  }

  // ===========================================
  // Run Execution
  // ===========================================

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and execute a new agent run' })
  @ApiResponse({
    status: 201,
    description: 'Run created',
    type: RunResponseDto,
  })
  async create(
    @Body() createRunDto: CreateRunDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RunResponseDto> {
    return this.executionService.createAndExecute(createRunDto, user);
  }

  @Post(':id/retry')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retry a failed run' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Run retried',
    type: RunResponseDto,
  })
  async retry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RunResponseDto> {
    // Retry by getting original run and re-executing
    const originalRun = await this.runsService.findOne(id, user);
    return this.executionService.createAndExecute(
      { agentId: originalRun.agentId, messages: [] },
      user,
    );
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a running execution' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Run cancelled' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RunResponseDto> {
    return this.executionService.cancelRun(id, user);
  }

  // ===========================================
  // Streaming
  // ===========================================

  @Sse(':id/stream')
  @ApiOperation({ summary: 'Stream run output in real-time (SSE)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Event stream' })
  streamRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Observable<MessageEvent> {
    return this.streamService.createStream(id).pipe(
      map((event) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute run synchronously and return full response' })
  @ApiResponse({
    status: 200,
    description: 'Run completed',
    type: RunResponseDto,
  })
  async executeSync(
    @Body() createRunDto: CreateRunDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RunResponseDto> {
    return this.executionService.executeSync(createRunDto, user);
  }

  @Post('stream')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Execute run with streaming response' })
  async executeWithStream(
    @Body() createRunDto: CreateRunDto,
    @CurrentUser() user: CurrentUserData,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Start the run
    const run = await this.executionService.createAndExecute(createRunDto, user);
    
    // Stream updates
    const stream = this.streamService.createStream(run.id);
    stream.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      error: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      },
      complete: () => {
        res.end();
      },
    });
  }

  // ===========================================
  // Run History & Analytics
  // ===========================================

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Get run history for a specific agent' })
  @ApiParam({ name: 'agentId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Agent run history',
    type: [RunResponseDto],
  })
  async getAgentRuns(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Query() query: RunsQueryDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaginatedResult<RunResponseDto>> {
    return this.runsService.findByAgent(agentId, query, user);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get all messages from a run' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Run messages' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ messages: unknown[] }> {
    return this.runsService.getMessages(id, user);
  }

  @Get(':id/tool-invocations')
  @ApiOperation({ summary: 'Get tool invocations from a run' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tool invocations' })
  async getToolInvocations(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<unknown[]> {
    return this.runsService.getToolInvocations(id, user);
  }

  // ===========================================
  // Delete Run
  // ===========================================

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a run (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Run deleted' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    await this.runsService.remove(id, user);
  }
}
