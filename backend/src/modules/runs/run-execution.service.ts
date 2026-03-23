// ===========================================
// Run Execution Service
// ===========================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { 
  RunStatus, 
  AgentStatus, 
  UserRole,
  AuditAction,
  EntityType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AgentsService } from '../agents/agents.service';
import { RunsService } from './runs.service';
import { CreateRunDto } from './dto/create-run.dto';
import { RunResponseDto } from './dto/run-response.dto';
import { CurrentUserData } from '../../common/decorators';

export interface RunJob {
  runId: string;
  agentId: string;
  input: unknown;
  userId: string;
  config: {
    modelProvider: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
    tools: string[];
  };
}

@Injectable()
export class RunExecutionService {
  private readonly logger = new Logger(RunExecutionService.name);

  constructor(
    @InjectQueue('agent-runs') private readonly runQueue: Queue<RunJob>,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly agentsService: AgentsService,
    private readonly runsService: RunsService,
  ) {}

  /**
   * Create a run and queue it for execution
   */
  async createAndExecute(
    createRunDto: CreateRunDto,
    user: CurrentUserData,
  ): Promise<RunResponseDto> {
    // Get and validate agent
    const agent = await this.validateAgent(createRunDto.agentId, user);

    // Check daily token limit
    await this.checkTokenLimit(agent);

    // Create run record
    const runId = await this.runsService.createRun({
      agentId: createRunDto.agentId,
      userId: user.id,
      input: this.buildInput(createRunDto),
    });

    // Get agent tools
    const agentTools = await this.prisma.agentTool.findMany({
      where: { 
        agentId: agent.id,
        isEnabled: true,
      },
      include: {
        tool: true,
      },
      orderBy: {
        priority: 'asc',
      },
    });

    // Queue job for processing
    const job: RunJob = {
      runId,
      agentId: agent.id,
      input: this.buildInput(createRunDto),
      userId: user.id,
      config: {
        modelProvider: agent.modelProvider,
        modelName: agent.modelName,
        temperature: createRunDto.temperature ?? agent.temperature,
        maxTokens: createRunDto.maxTokens ?? agent.maxTokens,
        systemPrompt: agent.systemPrompt || undefined,
        tools: agentTools.map(at => at.tool.name),
      },
    };

    await this.runQueue.add('execute', job, {
      priority: createRunDto.priority || 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    // Create audit log
    await this.createAuditLog(user.id, AuditAction.EXECUTE, runId, {
      agentId: agent.id,
      agentName: agent.name,
    });

    this.logger.log(`Run ${runId} queued for agent ${agent.name}`);

    return this.runsService.findOne(runId, user);
  }

  /**
   * Execute run synchronously (wait for completion)
   */
  async executeSync(
    createRunDto: CreateRunDto,
    user: CurrentUserData,
  ): Promise<RunResponseDto> {
    const run = await this.createAndExecute(createRunDto, user);
    
    // Wait for completion (with timeout)
    const timeout = createRunDto.timeout || 120000; // 2 minutes default
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const currentRun = await this.runsService.findOne(run.id, user);
      
      if (
        currentRun.status === RunStatus.COMPLETED ||
        currentRun.status === RunStatus.FAILED ||
        currentRun.status === RunStatus.CANCELLED
      ) {
        return currentRun;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new BadRequestException('Run execution timed out');
  }

  /**
   * Cancel a running execution
   */
  async cancelRun(runId: string, user: CurrentUserData): Promise<RunResponseDto> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      include: { agent: true },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Check permissions
    if (user.role !== UserRole.ADMIN && run.userId !== user.id) {
      throw new ForbiddenException('Not authorized to cancel this run');
    }

    // Only pending/running can be cancelled
    if (run.status !== RunStatus.PENDING && run.status !== RunStatus.RUNNING) {
      throw new BadRequestException(`Cannot cancel run with status ${run.status}`);
    }

    // Update status
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: { 
        status: RunStatus.CANCELLED,
        finishedAt: new Date(),
      },
    });

    // Remove from queue if pending
    if (run.status === RunStatus.PENDING) {
      try {
        const jobs = await this.runQueue.getJobs(['waiting', 'delayed']);
        for (const job of jobs) {
          if (job.data.runId === runId) {
            await job.remove();
            break;
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to remove job for run ${runId}: ${error}`);
      }
    }

    // Audit log
    await this.createAuditLog(user.id, AuditAction.UPDATE, runId, {
      action: 'cancel',
      previousStatus: run.status,
    });

    return this.runsService.findOne(runId, user);
  }

  /**
   * Complete a run (called by queue processor)
   */
  async completeRun(
    runId: string,
    result: {
      output: string;
      tokensUsed: number;
      modelProvider: string;
    },
  ): Promise<void> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      this.logger.error(`Run ${runId} not found for completion`);
      return;
    }

    const cost = this.calculateCost(result.tokensUsed, result.modelProvider);

    // Update run
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.COMPLETED,
        output: result.output,
        tokensUsed: result.tokensUsed,
        cost,
        finishedAt: new Date(),
      },
    });

    // Update token usage
    await this.updateTokenUsage(run.agentId, result.tokensUsed, Number(cost));

    // Publish event
    await this.redis.set(
      `run:${runId}:completed`,
      JSON.stringify({ status: 'completed', output: result.output }),
      60,
    );

    this.logger.log(`Run ${runId} completed successfully`);
  }

  /**
   * Fail a run (called by queue processor on error)
   */
  async failRun(runId: string, error: string): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        errorMessage: error,
        finishedAt: new Date(),
      },
    });

    // Publish event
    await this.redis.set(
      `run:${runId}:failed`,
      JSON.stringify({ status: 'failed', error }),
      60,
    );

    this.logger.error(`Run ${runId} failed: ${error}`);
  }

  /**
   * Record tool invocation
   */
  async recordToolInvocation(
    agentRunId: string,
    toolId: string,
    input: unknown,
  ): Promise<string> {
    const invocation = await this.prisma.toolInvocation.create({
      data: {
        agentRunId,
        toolId,
        input: input as any,
        success: false,
      },
    });
    return invocation.id;
  }

  /**
   * Complete tool invocation
   */
  async completeToolInvocation(
    invocationId: string,
    result: { output: unknown; success: boolean; error?: string; duration?: number },
  ): Promise<void> {
    await this.prisma.toolInvocation.update({
      where: { id: invocationId },
      data: {
        output: result.output as any,
        success: result.success,
        errorMessage: result.error,
        duration: result.duration,
      },
    });
  }

  // =========================================
  // Private Helpers
  // =========================================

  private async validateAgent(agentId: string, user: CurrentUserData) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    if (agent.status !== AgentStatus.ACTIVE) {
      throw new BadRequestException(`Agent ${agent.name} is not active`);
    }

    // Check permissions (simplified)
    if (user.role !== UserRole.ADMIN && agent.createdById !== user.id) {
      // Check if user has execute permission
      const permission = await this.prisma.agentPermission.findUnique({
        where: {
          userId_agentId: {
            userId: user.id,
            agentId,
          },
        },
      });

      if (!permission?.canExecute) {
        throw new ForbiddenException('Not authorized to execute this agent');
      }
    }

    return agent;
  }

  private async checkTokenLimit(agent: { id: string; dailyTokenLimit: number | null }) {
    if (!agent.dailyTokenLimit) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.tokenUsage.findUnique({
      where: {
        agentId_date: {
          agentId: agent.id,
          date: today,
        },
      },
    });

    if (usage && usage.tokensUsed >= agent.dailyTokenLimit) {
      throw new BadRequestException('Daily token limit exceeded for this agent');
    }
  }

  private buildInput(dto: CreateRunDto): unknown {
    return {
      messages: dto.messages || [],
      context: dto.context,
    };
  }

  private calculateCost(tokens: number, provider: string): number {
    // Simplified pricing (per 1000 tokens)
    const pricing: Record<string, number> = {
      openai: 0.002,
      anthropic: 0.003,
      default: 0.001,
    };
    const rate = pricing[provider.toLowerCase()] || pricing.default;
    return (tokens / 1000) * rate;
  }

  private async updateTokenUsage(
    agentId: string,
    tokensUsed: number,
    cost: number,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.tokenUsage.upsert({
      where: {
        agentId_date: {
          agentId,
          date: today,
        },
      },
      update: {
        tokensUsed: { increment: tokensUsed },
        cost: { increment: cost },
        runCount: { increment: 1 },
      },
      create: {
        agentId,
        date: today,
        tokensUsed,
        cost,
        runCount: 1,
      },
    });
  }

  private async createAuditLog(
    userId: string,
    action: AuditAction,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: EntityType.AGENT_RUN,
        entityId,
        metadata: metadata as any,
      },
    });
  }
}
