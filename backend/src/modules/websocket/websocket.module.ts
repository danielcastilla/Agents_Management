// ===========================================
// WebSocket Module
// ===========================================

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebSocketGatewayService } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { ConnectionManagerService } from './connection-manager.service';
import { NotificationService } from './notification.service';
import { PrismaModule } from '@/modules/prisma';
import { RedisModule } from '@/modules/redis';

@Global()
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    WebSocketGatewayService,
    WebSocketService,
    ConnectionManagerService,
    NotificationService,
  ],
  exports: [WebSocketService, NotificationService],
})
export class WebSocketModule {}
