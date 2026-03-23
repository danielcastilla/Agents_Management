// ===========================================
// Runs Module
// ===========================================

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { RunExecutionService } from './run-execution.service';
import { RunStreamService } from './run-stream.service';
import { AgentRunProcessor } from './agent-run.processor';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'agent-runs',
    }),
    AgentsModule,
  ],
  controllers: [RunsController],
  providers: [
    RunsService, 
    RunExecutionService, 
    RunStreamService,
    AgentRunProcessor,
  ],
  exports: [RunsService, RunExecutionService, RunStreamService],
})
export class RunsModule {}
