// ===========================================
// Run Stream Service
// ===========================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RunStatus } from '@prisma/client';
import { Observable, Subject } from 'rxjs';

export interface RunStreamEvent {
  type: 'status' | 'output' | 'error' | 'complete';
  runId: string;
  data: unknown;
  timestamp: Date;
}

@Injectable()
export class RunStreamService {
  private readonly logger = new Logger(RunStreamService.name);
  private readonly streams = new Map<string, Subject<RunStreamEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Create a stream for a run
   */
  createStream(runId: string): Observable<RunStreamEvent> {
    let subject = this.streams.get(runId);
    
    if (!subject) {
      subject = new Subject<RunStreamEvent>();
      this.streams.set(runId, subject);
      
      // Start polling for updates
      this.pollRunStatus(runId, subject);
    }
    
    return subject.asObservable();
  }

  /**
   * Publish an event to a run stream
   */
  async publishEvent(runId: string, event: Omit<RunStreamEvent, 'runId' | 'timestamp'>): Promise<void> {
    const fullEvent: RunStreamEvent = {
      ...event,
      runId,
      timestamp: new Date(),
    };

    // Publish to local subject
    const subject = this.streams.get(runId);
    if (subject) {
      subject.next(fullEvent);
    }

    // Also store in Redis for distributed systems
    await this.redis.set(
      `run:${runId}:stream:${Date.now()}`,
      JSON.stringify(fullEvent),
      300, // 5 minute TTL
    );
  }

  /**
   * Close a stream
   */
  closeStream(runId: string): void {
    const subject = this.streams.get(runId);
    if (subject) {
      subject.complete();
      this.streams.delete(runId);
    }
  }

  /**
   * Get current run status
   */
  async getRunStatus(runId: string): Promise<{
    status: RunStatus;
    output?: string;
    error?: string;
    progress?: number;
  }> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        output: true,
        errorMessage: true,
      },
    });

    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    return {
      status: run.status,
      output: run.output || undefined,
      error: run.errorMessage || undefined,
    };
  }

  /**
   * Wait for run completion
   */
  async waitForCompletion(
    runId: string,
    timeout: number = 120000,
  ): Promise<{ status: RunStatus; output?: string; error?: string }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await this.getRunStatus(runId);
      
      if (
        status.status === RunStatus.COMPLETED ||
        status.status === RunStatus.FAILED ||
        status.status === RunStatus.CANCELLED ||
        status.status === RunStatus.TIMEOUT
      ) {
        this.closeStream(runId);
        return status;
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.closeStream(runId);
    throw new Error('Timeout waiting for run completion');
  }

  // =========================================
  // Private Helpers
  // =========================================

  private async pollRunStatus(runId: string, subject: Subject<RunStreamEvent>): Promise<void> {
    const poll = async () => {
      try {
        const run = await this.prisma.agentRun.findUnique({
          where: { id: runId },
          select: {
            status: true,
            output: true,
            errorMessage: true,
          },
        });

        if (!run) {
          subject.error(new Error(`Run ${runId} not found`));
          this.streams.delete(runId);
          return;
        }

        // Emit status update
        subject.next({
          type: 'status',
          runId,
          data: { status: run.status },
          timestamp: new Date(),
        });

        // Check if completed
        if (
          run.status === RunStatus.COMPLETED ||
          run.status === RunStatus.FAILED ||
          run.status === RunStatus.CANCELLED ||
          run.status === RunStatus.TIMEOUT
        ) {
          // Emit final event
          subject.next({
            type: run.status === RunStatus.COMPLETED ? 'complete' : 'error',
            runId,
            data: {
              status: run.status,
              output: run.output,
              error: run.errorMessage,
            },
            timestamp: new Date(),
          });
          
          subject.complete();
          this.streams.delete(runId);
          return;
        }

        // Continue polling
        setTimeout(poll, 1000);
      } catch (error) {
        this.logger.error(`Error polling run ${runId}: ${error}`);
        subject.error(error);
        this.streams.delete(runId);
      }
    };

    // Start polling
    poll();
  }
}
