// ===========================================
// Notification Service
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma';
import { RedisService } from '@/modules/redis';
import { ConnectionManagerService } from './connection-manager.service';
import {
  ServerEvent,
  NotificationType,
  NotificationPriority,
  ROOM_PREFIX,
} from './websocket.constants';
import { NotificationData } from './websocket.interfaces';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly NOTIFICATION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  // =========================================
  // Create & Send Notification
  // =========================================

  async notify(dto: CreateNotificationDto): Promise<NotificationData> {
    const notification: NotificationData = {
      id: this.generateId(),
      type: dto.type,
      priority: dto.priority || NotificationPriority.MEDIUM,
      title: dto.title,
      message: dto.message,
      data: dto.data,
      actionUrl: dto.actionUrl,
      read: false,
      createdAt: new Date(),
    };

    // Store in Redis for quick access
    await this.storeNotification(dto.userId, notification);

    // Send real-time notification if user is online
    this.sendToUser(dto.userId, notification);

    this.logger.debug(`Notification sent to user ${dto.userId}: ${dto.title}`);

    return notification;
  }

  // =========================================
  // Bulk Notifications
  // =========================================

  async notifyMany(
    userIds: string[],
    notification: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<void> {
    const promises = userIds.map((userId) =>
      this.notify({ ...notification, userId }),
    );

    await Promise.allSettled(promises);
    this.logger.debug(`Bulk notification sent to ${userIds.length} users`);
  }

  async notifyAll(
    notification: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<void> {
    const server = this.connectionManager.getServer();
    if (!server) return;

    const notificationData: NotificationData = {
      id: this.generateId(),
      type: notification.type,
      priority: notification.priority || NotificationPriority.MEDIUM,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      read: false,
      createdAt: new Date(),
    };

    server.emit(ServerEvent.NOTIFICATION, notificationData);
    this.logger.debug(`Broadcast notification: ${notification.title}`);
  }

  // =========================================
  // Convenience Methods
  // =========================================

  async notifySuccess(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationData> {
    return this.notify({
      userId,
      type: NotificationType.SUCCESS,
      title,
      message,
      data,
    });
  }

  async notifyError(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationData> {
    return this.notify({
      userId,
      type: NotificationType.ERROR,
      priority: NotificationPriority.HIGH,
      title,
      message,
      data,
    });
  }

  async notifyWarning(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationData> {
    return this.notify({
      userId,
      type: NotificationType.WARNING,
      title,
      message,
      data,
    });
  }

  async notifyInfo(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationData> {
    return this.notify({
      userId,
      type: NotificationType.INFO,
      title,
      message,
      data,
    });
  }

  // =========================================
  // Run-related Notifications
  // =========================================

  async notifyRunCompleted(
    userId: string,
    runId: string,
    agentName: string,
  ): Promise<void> {
    await this.notify({
      userId,
      type: NotificationType.SUCCESS,
      title: 'Run Completed',
      message: `Agent "${agentName}" has completed its run successfully.`,
      data: { runId, agentName },
      actionUrl: `/runs/${runId}`,
    });
  }

  async notifyRunFailed(
    userId: string,
    runId: string,
    agentName: string,
    error: string,
  ): Promise<void> {
    await this.notify({
      userId,
      type: NotificationType.ERROR,
      priority: NotificationPriority.HIGH,
      title: 'Run Failed',
      message: `Agent "${agentName}" run failed: ${error}`,
      data: { runId, agentName, error },
      actionUrl: `/runs/${runId}`,
    });
  }

  // =========================================
  // Retrieve Notifications
  // =========================================

  async getUserNotifications(
    userId: string,
    limit: number = 50,
    unreadOnly: boolean = false,
  ): Promise<NotificationData[]> {
    try {
      const redis = this.redisService.getClient();
      const key = `notifications:${userId}`;

      const notifications = await redis.lrange(key, 0, limit - 1);

      let parsed = notifications.map((n) => JSON.parse(n) as NotificationData);

      if (unreadOnly) {
        parsed = parsed.filter((n) => !n.read);
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error.message}`);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getUserNotifications(userId, 100, true);
    return notifications.length;
  }

  // =========================================
  // Mark as Read
  // =========================================

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `notifications:${userId}`;

      const notifications = await redis.lrange(key, 0, -1);
      const updated = notifications.map((n) => {
        const parsed = JSON.parse(n) as NotificationData;
        if (parsed.id === notificationId) {
          parsed.read = true;
        }
        return JSON.stringify(parsed);
      });

      // Replace list
      await redis.del(key);
      if (updated.length > 0) {
        await redis.rpush(key, ...updated);
        await redis.expire(key, this.NOTIFICATION_TTL);
      }

      // Emit read event
      this.sendReadEvent(userId, notificationId);
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `notifications:${userId}`;

      const notifications = await redis.lrange(key, 0, -1);
      const updated = notifications.map((n) => {
        const parsed = JSON.parse(n) as NotificationData;
        parsed.read = true;
        return JSON.stringify(parsed);
      });

      await redis.del(key);
      if (updated.length > 0) {
        await redis.rpush(key, ...updated);
        await redis.expire(key, this.NOTIFICATION_TTL);
      }

      // Emit read all event
      const server = this.connectionManager.getServer();
      if (server) {
        server.to(`${ROOM_PREFIX.USER}${userId}`).emit(ServerEvent.NOTIFICATION_READ, {
          all: true,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  // =========================================
  // Clear Notifications
  // =========================================

  async clearNotifications(userId: string): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      await redis.del(`notifications:${userId}`);
    } catch (error) {
      this.logger.error(`Failed to clear notifications: ${error.message}`);
    }
  }

  // =========================================
  // Private Helpers
  // =========================================

  private async storeNotification(
    userId: string,
    notification: NotificationData,
  ): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `notifications:${userId}`;

      // Add to beginning of list (newest first)
      await redis.lpush(key, JSON.stringify(notification));

      // Keep only last 100 notifications
      await redis.ltrim(key, 0, 99);

      // Set TTL
      await redis.expire(key, this.NOTIFICATION_TTL);
    } catch (error) {
      this.logger.error(`Failed to store notification: ${error.message}`);
    }
  }

  private sendToUser(userId: string, notification: NotificationData): void {
    const server = this.connectionManager.getServer();
    if (!server) return;

    server
      .to(`${ROOM_PREFIX.USER}${userId}`)
      .emit(ServerEvent.NOTIFICATION, notification);
  }

  private sendReadEvent(userId: string, notificationId: string): void {
    const server = this.connectionManager.getServer();
    if (!server) return;

    server.to(`${ROOM_PREFIX.USER}${userId}`).emit(ServerEvent.NOTIFICATION_READ, {
      notificationId,
    });
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
