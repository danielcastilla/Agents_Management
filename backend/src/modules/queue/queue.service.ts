// ===========================================
// Queue Service
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { QUEUES } from './queue.constants';

export interface AgentRunJobData {
  runId: string;
  agentId: string;
  userId: string;
  input: string;
}

export interface ToolInvocationJobData {
  runId: string;
  toolId: string;
  input: Record<string, unknown>;
}

export interface AnalyticsJobData {
  type: 'token_usage' | 'cost_calculation' | 'metrics_aggregation';
  payload: Record<string, unknown>;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUES.AGENT_RUN)
    private readonly agentRunQueue: Queue<AgentRunJobData>,
    
    @InjectQueue(QUEUES.TOOL_INVOCATION)
    private readonly toolInvocationQueue: Queue<ToolInvocationJobData>,
    
    @InjectQueue(QUEUES.ANALYTICS)
    private readonly analyticsQueue: Queue<AnalyticsJobData>,
  ) {}

  /**
   * Add agent run job to queue
   */
  async addAgentRunJob(data: AgentRunJobData): Promise<Job<AgentRunJobData>> {
    this.logger.debug(`Adding agent run job: ${data.runId}`);
    
    return this.agentRunQueue.add('execute', data, {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Add tool invocation job to queue
   */
  async addToolInvocationJob(data: ToolInvocationJobData): Promise<Job<ToolInvocationJobData>> {
    this.logger.debug(`Adding tool invocation job for run: ${data.runId}`);
    
    return this.toolInvocationQueue.add('invoke', data, {
      priority: 2,
      attempts: 3,
    });
  }

  /**
   * Add analytics job to queue
   */
  async addAnalyticsJob(data: AnalyticsJobData): Promise<Job<AnalyticsJobData>> {
    return this.analyticsQueue.add(data.type, data, {
      priority: 10, // Lower priority for analytics
      delay: 5000, // 5 second delay
    });
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{
    agentRun: { waiting: number; active: number; completed: number; failed: number };
    toolInvocation: { waiting: number; active: number; completed: number; failed: number };
    analytics: { waiting: number; active: number; completed: number; failed: number };
  }> {
    const [agentRunCounts, toolInvocationCounts, analyticsCounts] = await Promise.all([
      this.agentRunQueue.getJobCounts(),
      this.toolInvocationQueue.getJobCounts(),
      this.analyticsQueue.getJobCounts(),
    ]);

    return {
      agentRun: {
        waiting: agentRunCounts.waiting || 0,
        active: agentRunCounts.active || 0,
        completed: agentRunCounts.completed || 0,
        failed: agentRunCounts.failed || 0,
      },
      toolInvocation: {
        waiting: toolInvocationCounts.waiting || 0,
        active: toolInvocationCounts.active || 0,
        completed: toolInvocationCounts.completed || 0,
        failed: toolInvocationCounts.failed || 0,
      },
      analytics: {
        waiting: analyticsCounts.waiting || 0,
        active: analyticsCounts.active || 0,
        completed: analyticsCounts.completed || 0,
        failed: analyticsCounts.failed || 0,
      },
    };
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    await Promise.all([
      this.agentRunQueue.clean(olderThanMs, 1000, 'completed'),
      this.agentRunQueue.clean(olderThanMs, 1000, 'failed'),
      this.toolInvocationQueue.clean(olderThanMs, 1000, 'completed'),
      this.toolInvocationQueue.clean(olderThanMs, 1000, 'failed'),
      this.analyticsQueue.clean(olderThanMs, 1000, 'completed'),
      this.analyticsQueue.clean(olderThanMs, 1000, 'failed'),
    ]);

    this.logger.log('Cleaned old jobs from queues');
  }
}
