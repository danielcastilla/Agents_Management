// ===========================================
// Agent Run Job Processor
// ===========================================

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queue.constants';
import { AgentRunJobData } from '../queue.service';

@Processor(QUEUES.AGENT_RUN)
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  async process(job: Job<AgentRunJobData>): Promise<void> {
    this.logger.log(`Processing agent run job: ${job.id}`);
    
    const { runId, agentId, input } = job.data;

    try {
      // Update progress
      await job.updateProgress(10);

      // TODO: Implement actual agent execution logic
      // This will be implemented in the LLM module
      this.logger.debug(`Executing agent ${agentId} with input: ${input.substring(0, 100)}...`);

      await job.updateProgress(50);

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      await job.updateProgress(100);

      this.logger.log(`Agent run ${runId} completed successfully`);
    } catch (error) {
      this.logger.error(`Agent run ${runId} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AgentRunJobData>): void {
    this.logger.log(`Job ${job.id} completed for run ${job.data.runId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AgentRunJobData>, error: Error): void {
    this.logger.error(`Job ${job.id} failed for run ${job.data.runId}: ${error.message}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job<AgentRunJobData>, progress: number): void {
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }
}
