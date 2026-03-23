// ===========================================
// WebSocket Service
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { ConnectionManagerService } from './connection-manager.service';
import {
  ServerEvent,
  ROOM_PREFIX,
} from './websocket.constants';
import {
  EventPayload,
  RunStreamData,
  RunProgressData,
  SystemAlertData,
} from './websocket.interfaces';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(private readonly connectionManager: ConnectionManagerService) {}

  // =========================================
  // Generic Emit Methods
  // =========================================

  /**
   * Emit event to a specific user (all their connections)
   */
  emitToUser<T>(userId: string, event: string, data: T): void {
    const server = this.connectionManager.getServer();
    if (!server) return;

    const room = `${ROOM_PREFIX.USER}${userId}`;
    server.to(room).emit(event, this.wrapPayload(event, data));
    this.logger.debug(`Emitted ${event} to user ${userId}`);
  }

  /**
   * Emit event to a specific room
   */
  emitToRoom<T>(room: string, event: string, data: T): void {
    const server = this.connectionManager.getServer();
    if (!server) return;

    server.to(room).emit(event, this.wrapPayload(event, data));
    this.logger.debug(`Emitted ${event} to room ${room}`);
  }

  /**
   * Emit event to all connected clients
   */
  broadcast<T>(event: string, data: T): void {
    const server = this.connectionManager.getServer();
    if (!server) return;

    server.emit(event, this.wrapPayload(event, data));
    this.logger.debug(`Broadcast ${event} to all clients`);
  }

  /**
   * Emit to organization
   */
  emitToOrganization<T>(organizationId: string, event: string, data: T): void {
    const room = `${ROOM_PREFIX.ORGANIZATION}${organizationId}`;
    this.emitToRoom(room, event, data);
  }

  // =========================================
  // Agent Events
  // =========================================

  emitAgentCreated(agentId: string, data: Record<string, unknown>): void {
    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.AGENT_CREATED,
      { agentId, ...data },
    );
  }

  emitAgentUpdated(agentId: string, data: Record<string, unknown>): void {
    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.AGENT_UPDATED,
      { agentId, ...data },
    );
  }

  emitAgentDeleted(agentId: string): void {
    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.AGENT_DELETED,
      { agentId },
    );
  }

  emitAgentStatusChanged(
    agentId: string,
    status: string,
    previousStatus: string,
  ): void {
    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.AGENT_STATUS_CHANGED,
      { agentId, status, previousStatus },
    );
  }

  // =========================================
  // Run Events
  // =========================================

  emitRunStarted(runId: string, agentId: string, data: Record<string, unknown>): void {
    // Emit to run room
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${runId}`,
      ServerEvent.RUN_STARTED,
      { runId, agentId, ...data },
    );

    // Also emit to agent room
    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.RUN_STARTED,
      { runId, agentId, ...data },
    );
  }

  emitRunCompleted(
    runId: string,
    agentId: string,
    data: Record<string, unknown>,
  ): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${runId}`,
      ServerEvent.RUN_COMPLETED,
      { runId, agentId, ...data },
    );

    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.RUN_COMPLETED,
      { runId, agentId, ...data },
    );
  }

  emitRunFailed(
    runId: string,
    agentId: string,
    error: string,
    data?: Record<string, unknown>,
  ): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${runId}`,
      ServerEvent.RUN_FAILED,
      { runId, agentId, error, ...data },
    );

    this.emitToRoom(
      `${ROOM_PREFIX.AGENT}${agentId}`,
      ServerEvent.RUN_FAILED,
      { runId, agentId, error, ...data },
    );
  }

  emitRunProgress(data: RunProgressData): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${data.runId}`,
      ServerEvent.RUN_PROGRESS,
      data,
    );
  }

  emitRunStream(data: RunStreamData): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${data.runId}`,
      ServerEvent.RUN_STREAM,
      data,
    );
  }

  emitToolCall(runId: string, toolCall: RunStreamData['toolCall']): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${runId}`,
      ServerEvent.RUN_TOOL_CALL,
      { runId, toolCall },
    );
  }

  emitToolResult(runId: string, toolResult: RunStreamData['toolResult']): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${runId}`,
      ServerEvent.RUN_TOOL_RESULT,
      { runId, toolResult },
    );
  }

  // =========================================
  // Tool Events
  // =========================================

  emitToolCreated(toolId: string, data: Record<string, unknown>): void {
    this.broadcast(ServerEvent.TOOL_CREATED, { toolId, ...data });
  }

  emitToolUpdated(toolId: string, data: Record<string, unknown>): void {
    this.broadcast(ServerEvent.TOOL_UPDATED, { toolId, ...data });
  }

  emitToolDeleted(toolId: string): void {
    this.broadcast(ServerEvent.TOOL_DELETED, { toolId });
  }

  emitToolExecuted(
    toolId: string,
    runId: string,
    result: { success: boolean; duration: number },
  ): void {
    this.emitToRoom(
      `${ROOM_PREFIX.RUN}${runId}`,
      ServerEvent.TOOL_EXECUTED,
      { toolId, runId, ...result },
    );
  }

  // =========================================
  // System Events
  // =========================================

  emitSystemAlert(alert: SystemAlertData): void {
    this.broadcast(ServerEvent.SYSTEM_ALERT, alert);
    this.logger.warn(`System alert broadcast: ${alert.title}`);
  }

  emitMaintenanceNotice(
    message: string,
    scheduledAt: Date,
    estimatedDuration: number,
  ): void {
    this.broadcast(ServerEvent.SYSTEM_MAINTENANCE, {
      message,
      scheduledAt,
      estimatedDuration,
    });
  }

  // =========================================
  // Connection Info
  // =========================================

  isUserOnline(userId: string): boolean {
    return this.connectionManager.isUserOnline(userId);
  }

  getOnlineUsers(): string[] {
    return this.connectionManager.getOnlineUsers();
  }

  getConnectionStats() {
    return this.connectionManager.getStats();
  }

  // =========================================
  // Private Helpers
  // =========================================

  private wrapPayload<T>(event: string, data: T): EventPayload<T> {
    return {
      event,
      data,
      timestamp: new Date(),
      correlationId: this.generateCorrelationId(),
    };
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
