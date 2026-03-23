// ===========================================
// WebSocket Gateway (Socket.IO)
// ===========================================

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConnectionManagerService } from './connection-manager.service';
import {
  ServerEvent,
  ClientEvent,
  ROOM_PREFIX,
} from './websocket.constants';
import {
  AuthenticatedSocket,
  SubscriptionRequest,
} from './websocket.interfaces';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure in production
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class WebSocketGatewayService
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGatewayService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  // =========================================
  // Lifecycle Hooks
  // =========================================

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Set server reference in connection manager
    this.connectionManager.setServer(server);
  }

  async handleConnection(socket: Socket) {
    try {
      // Authenticate socket
      const user = await this.authenticateSocket(socket);
      
      if (!user) {
        this.logger.warn(`Unauthorized connection attempt: ${socket.id}`);
        socket.emit(ServerEvent.ERROR, { message: 'Unauthorized' });
        socket.disconnect();
        return;
      }

      // Attach user to socket
      (socket as AuthenticatedSocket).user = user;
      (socket as AuthenticatedSocket).connectedAt = new Date();

      // Register connection
      this.connectionManager.addConnection(socket as AuthenticatedSocket);

      // Join user's personal room
      socket.join(`${ROOM_PREFIX.USER}${user.id}`);

      // Join organization room if applicable
      if (user.organizationId) {
        socket.join(`${ROOM_PREFIX.ORGANIZATION}${user.organizationId}`);
      }

      // Emit connected event
      socket.emit(ServerEvent.CONNECTED, {
        socketId: socket.id,
        userId: user.id,
        connectedAt: new Date(),
      });

      // Broadcast user online status
      this.server.emit(ServerEvent.USER_ONLINE, {
        userId: user.id,
        connectedAt: new Date(),
      });

      this.logger.log(`Client connected: ${socket.id} (User: ${user.id})`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      socket.emit(ServerEvent.ERROR, { message: 'Connection failed' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const authSocket = socket as AuthenticatedSocket;
    
    if (authSocket.user) {
      this.connectionManager.removeConnection(socket.id);

      // Check if user has other connections
      const hasOtherConnections = this.connectionManager.getUserConnections(
        authSocket.user.id,
      ).length > 0;

      if (!hasOtherConnections) {
        this.server.emit(ServerEvent.USER_OFFLINE, {
          userId: authSocket.user.id,
          disconnectedAt: new Date(),
        });
      }

      this.logger.log(
        `Client disconnected: ${socket.id} (User: ${authSocket.user.id})`,
      );
    } else {
      this.logger.log(`Client disconnected: ${socket.id}`);
    }
  }

  // =========================================
  // Message Handlers
  // =========================================

  @SubscribeMessage(ClientEvent.SUBSCRIBE)
  handleSubscribe(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscriptionRequest,
  ) {
    const roomName = this.getRoomName(data.type, data.id);
    
    if (roomName) {
      socket.join(roomName);
      this.connectionManager.addRoom(socket.id, roomName);
      this.logger.debug(`Socket ${socket.id} subscribed to ${roomName}`);
      return { success: true, room: roomName };
    }

    return { success: false, error: 'Invalid subscription' };
  }

  @SubscribeMessage(ClientEvent.UNSUBSCRIBE)
  handleUnsubscribe(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SubscriptionRequest,
  ) {
    const roomName = this.getRoomName(data.type, data.id);
    
    if (roomName) {
      socket.leave(roomName);
      this.connectionManager.removeRoom(socket.id, roomName);
      this.logger.debug(`Socket ${socket.id} unsubscribed from ${roomName}`);
      return { success: true };
    }

    return { success: false, error: 'Invalid subscription' };
  }

  @SubscribeMessage(ClientEvent.JOIN_ROOM)
  handleJoinRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    // Validate room access (implement based on your auth logic)
    socket.join(data.room);
    this.connectionManager.addRoom(socket.id, data.room);
    return { success: true, room: data.room };
  }

  @SubscribeMessage(ClientEvent.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    socket.leave(data.room);
    this.connectionManager.removeRoom(socket.id, data.room);
    return { success: true };
  }

  @SubscribeMessage(ClientEvent.PING)
  handlePing(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.connectionManager.updateLastPing(socket.id);
    return { pong: Date.now() };
  }

  @SubscribeMessage(ClientEvent.UPDATE_PRESENCE)
  handleUpdatePresence(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { status: string; activity?: string },
  ) {
    this.connectionManager.updateMetadata(socket.id, {
      status: data.status,
      activity: data.activity,
    });

    // Broadcast presence update
    this.server.emit(ServerEvent.USERS_PRESENCE, {
      userId: socket.user.id,
      status: data.status,
      activity: data.activity,
      updatedAt: new Date(),
    });

    return { success: true };
  }

  // =========================================
  // Private Helpers
  // =========================================

  private async authenticateSocket(socket: Socket): Promise<any> {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return null;
      }

      const payload = await this.jwtService.verifyAsync(token);
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        organizationId: payload.organizationId,
      };
    } catch {
      return null;
    }
  }

  private getRoomName(type: string, id: string): string | null {
    switch (type) {
      case 'agent':
        return `${ROOM_PREFIX.AGENT}${id}`;
      case 'run':
        return `${ROOM_PREFIX.RUN}${id}`;
      case 'user':
        return `${ROOM_PREFIX.USER}${id}`;
      case 'organization':
        return `${ROOM_PREFIX.ORGANIZATION}${id}`;
      default:
        return null;
    }
  }
}
