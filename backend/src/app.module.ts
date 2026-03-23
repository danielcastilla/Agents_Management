// ===========================================
// Main Application Module
// ===========================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

// Core modules
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { QueueModule } from './modules/queue/queue.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AgentsModule } from './modules/agents/agents.module';
import { RunsModule } from './modules/runs/runs.module';
import { ToolsModule } from './modules/tools/tools.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { LlmModule } from './modules/llm/llm.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { HealthModule } from './modules/health/health.module';

// Guards and interceptors
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Configuration
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // Core modules
    PrismaModule,
    RedisModule,
    QueueModule,

    // Feature modules
    AuthModule,
    UsersModule,
    AgentsModule,
    RunsModule,
    ToolsModule,
    AuditModule,
    AnalyticsModule,
    LlmModule,
    WebSocketModule,
    HealthModule,
  ],
  providers: [
    // Global JWT auth guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global roles guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global response transformation
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
