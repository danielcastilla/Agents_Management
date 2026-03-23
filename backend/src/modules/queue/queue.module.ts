// ===========================================
// BullMQ Queue Module
// ===========================================

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { AgentRunProcessor } from './processors/agent-run.processor';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUES.AGENT_RUN },
      { name: QUEUES.TOOL_INVOCATION },
      { name: QUEUES.ANALYTICS },
      { name: QUEUES.NOTIFICATIONS },
    ),
  ],
  providers: [QueueService, AgentRunProcessor],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
