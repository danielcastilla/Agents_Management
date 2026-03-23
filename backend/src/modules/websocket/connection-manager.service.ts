// ===========================================
// Connection Manager Service
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisService } from '@/modules/redis';
import { AuthenticatedSocket, ConnectionInfo } from './websocket.interfaces';

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private server: Server;
  
  // In-memory connection store (for single instance)
  // For multi-instance, use Redis adapter
  private connections = new Map<string, ConnectionInfo>();
  private userConnections = new Map<string, Set<string>>(); // userId -> socketIds

  constructor(private readonly redisService: RedisService) {}

  // =========================================
  // Server Reference
  // =========================================

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
  }

  // =========================================
  // Connection Management
  // =========================================

  addConnection(socket: AuthenticatedSocket): void {
    const info: ConnectionInfo = {
      socketId: socket.id,
      userId: socket.user.id,
      connectedAt: socket.connectedAt,
      lastPing: new Date(),
      rooms: new Set([`user:${socket.user.id}`]),
      metadata: {},
    };

    this.connections.set(socket.id, info);

    // Track user connections
    if (!this.userConnections.has(socket.user.id)) {
      this.userConnections.set(socket.user.id, new Set());
    }
    this.userConnections.get(socket.user.id)!.add(socket.id);

    // Store in Redis for cross-instance awareness
    this.storeConnectionInRedis(info);
  }

  removeConnection(socketId: string): void {
    const info = this.connections.get(socketId);
    
    if (info) {
      // Remove from user connections
      const userSockets = this.userConnections.get(info.userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.userConnections.delete(info.userId);
        }
      }

      // Remove from Redis
      this.removeConnectionFromRedis(socketId);
    }

    this.connections.delete(socketId);
  }

  getConnection(socketId: string): ConnectionInfo | undefined {
    return this.connections.get(socketId);
  }

  // =========================================
  // User Connections
  // =========================================

  getUserConnections(userId: string): string[] {
    const sockets = this.userConnections.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  isUserOnline(userId: string): boolean {
    return this.userConnections.has(userId) && 
           this.userConnections.get(userId)!.size > 0;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  // =========================================
  // Room Management
  // =========================================

  addRoom(socketId: string, room: string): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.rooms.add(room);
    }
  }

  removeRoom(socketId: string, room: string): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.rooms.delete(room);
    }
  }

  getSocketRooms(socketId: string): string[] {
    const info = this.connections.get(socketId);
    return info ? Array.from(info.rooms) : [];
  }

  // =========================================
  // Ping & Metadata
  // =========================================

  updateLastPing(socketId: string): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.lastPing = new Date();
    }
  }

  updateMetadata(socketId: string, metadata: Record<string, unknown>): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.metadata = { ...info.metadata, ...metadata };
    }
  }

  // =========================================
  // Statistics
  // =========================================

  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    roomsCount: number;
  } {
    const allRooms = new Set<string>();
    for (const info of this.connections.values()) {
      for (const room of info.rooms) {
        allRooms.add(room);
      }
    }

    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      roomsCount: allRooms.size,
    };
  }

  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  // =========================================
  // Cleanup Stale Connections
  // =========================================

  cleanupStaleConnections(maxIdleMs: number = 300000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [socketId, info] of this.connections) {
      const idleTime = now - info.lastPing.getTime();
      
      if (idleTime > maxIdleMs) {
        // Disconnect the socket
        const socket = this.server?.sockets?.sockets?.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
        this.removeConnection(socketId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} stale connections`);
    }

    return cleaned;
  }

  // =========================================
  // Redis Integration (for scaling)
  // =========================================

  private async storeConnectionInRedis(info: ConnectionInfo): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const key = `ws:connection:${info.socketId}`;
      
      await redis.hset(key, {
        socketId: info.socketId,
        userId: info.userId,
        connectedAt: info.connectedAt.toISOString(),
        lastPing: info.lastPing.toISOString(),
      });
      
      // Set expiry (5 minutes)
      await redis.expire(key, 300);

      // Add to user's connection set
      await redis.sadd(`ws:user:${info.userId}`, info.socketId);
    } catch (error) {
      this.logger.warn(`Failed to store connection in Redis: ${error.message}`);
    }
  }

  private async removeConnectionFromRedis(socketId: string): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const info = this.connections.get(socketId);
      
      await redis.del(`ws:connection:${socketId}`);
      
      if (info) {
        await redis.srem(`ws:user:${info.userId}`, socketId);
      }
    } catch (error) {
      this.logger.warn(`Failed to remove connection from Redis: ${error.message}`);
    }
  }
}
