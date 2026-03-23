// ===========================================
// Agent Run Processor (Queue Worker)
// ===========================================

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RunStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RunExecutionService, RunJob } from './run-execution.service';
import { RunStreamService } from './run-stream.service';

@Processor('agent-runs')
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly executionService: RunExecutionService,
    private readonly streamService: RunStreamService,
  ) {
    super();
  }

  async process(job: Job<RunJob>): Promise<void> {
    const { runId, agentId, input, config } = job.data;
    
    this.logger.log(`Processing run ${runId} for agent ${agentId}`);

    try {
      // Check if cancelled
      const cancelled = await this.redis.get(`run:${runId}:cancelled`);
      if (cancelled) {
        this.logger.log(`Run ${runId} was cancelled before processing`);
        return;
      }

      // Update status to RUNNING
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: RunStatus.RUNNING },
      });

      // Publish status update
      await this.streamService.publishEvent(runId, { type: 'status', data: { status: 'running' } });

      // Execute the LLM call (mock implementation)
      const result = await this.executeLLM(runId, input, config);

      // Check if cancelled during execution
      const cancelledDuring = await this.redis.get(`run:${runId}:cancelled`);
      if (cancelledDuring) {
        this.logger.log(`Run ${runId} was cancelled during processing`);
        return;
      }

      // Complete the run
      await this.executionService.completeRun(runId, {
        output: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
        tokensUsed: result.tokensUsed,
        modelProvider: config.modelProvider,
      });

      // Publish completion
      await this.streamService.publishEvent(runId, {
        type: 'complete',
        data: { output: result.output, tokensUsed: result.tokensUsed },
      });

    } catch (error) {
      this.logger.error(`Run ${runId} failed: ${error.message}`);
      
      // Fail the run
      await this.executionService.failRun(runId, error.message);
      
      // Publish error
      await this.streamService.publishEvent(runId, { type: 'error', data: { error: error.message } });
      
      throw error;
    }
  }

  /**
   * Execute LLM call (placeholder - will be replaced by LLM module)
   */
  private async executeLLM(
    runId: string,
    input: unknown,
    config: RunJob['config'],
  ): Promise<{ output: unknown; tokensUsed: number }> {
    // This is a mock implementation
    // Real implementation will use the LLM module
    
    const messages = (input as any)?.messages || [];
    const lastUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop();

    // Simulate streaming tokens
    const responseTokens = [
      'I', ' understand', ' your', ' request', '.',
      ' Let', ' me', ' help', ' you', ' with', ' that', '.',
    ];

    for (const token of responseTokens) {
      // Check cancellation
      const cancelled = await this.redis.get(`run:${runId}:cancelled`);
      if (cancelled) {
        throw new Error('Run cancelled');
      }

      // Simulate token streaming
      await this.streamService.publishEvent(runId, { type: 'output', data: { token } });
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Simulate tool calls if needed
    if (config.tools.length > 0 && lastUserMessage?.content?.includes('search')) {
      await this.simulateToolCall(runId, config.tools[0]);
    }

    // Return mock response
    const response = {
      role: 'assistant',
      content: responseTokens.join(''),
    };

    // Estimate tokens (mock)
    const inputTokens = JSON.stringify(messages).length / 4;
    const outputTokens = response.content.length / 4;
    const totalTokens = Math.ceil(inputTokens + outputTokens);

    return {
      output: response,
      tokensUsed: totalTokens,
    };
  }

  /**
   * Simulate tool call
   */
  private async simulateToolCall(
    runId: string,
    toolName: string,
  ): Promise<void> {
    const input = { query: 'sample query' };
    
    // Publish tool call
    await this.streamService.publishEvent(runId, { type: 'output', data: { toolCall: { name: toolName, input } } });
    
    // Simulate tool execution
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const output = { result: 'Tool execution result' };
    
    // Publish tool result
    await this.streamService.publishEvent(runId, { type: 'output', data: { toolResult: { name: toolName, output } } });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RunJob>): void {
    this.logger.log(`Job ${job.id} completed for run ${job.data.runId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RunJob>, error: Error): void {
    this.logger.error(
      `Job ${job.id} failed for run ${job.data.runId}: ${error.message}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job<RunJob>): void {
    this.logger.log(`Job ${job.id} started for run ${job.data.runId}`);
  }
}
