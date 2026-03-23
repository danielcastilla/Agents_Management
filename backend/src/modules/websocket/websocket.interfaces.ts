// ===========================================
// WebSocket Interfaces
// ===========================================

import { Socket } from 'socket.io';
import { NotificationType, NotificationPriority } from './websocket.constants';

// Authenticated socket with user info
export interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
  };
  connectedAt: Date;
}

// Connection info stored in memory
export interface ConnectionInfo {
  socketId: string;
  userId: string;
  connectedAt: Date;
  lastPing: Date;
  rooms: Set<string>;
  metadata: Record<string, unknown>;
}

// Event payload wrapper
export interface EventPayload<T = unknown> {
  event: string;
  data: T;
  timestamp: Date;
  correlationId?: string;
}

// Run stream event data
export interface RunStreamData {
  runId: string;
  agentId: string;
  type: 'content' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  toolResult?: {
    id: string;
    result: string;
    error?: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Run progress data
export interface RunProgressData {
  runId: string;
  agentId: string;
  status: string;
  progress: number; // 0-100
  currentStep?: string;
  totalSteps?: number;
  message?: string;
}

// Notification data
export interface NotificationData {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
}

// Presence data
export interface PresenceData {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentActivity?: string;
}

// Room subscription request
export interface SubscriptionRequest {
  type: 'agent' | 'run' | 'user' | 'organization';
  id: string;
}

// System alert data
export interface SystemAlertData {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  dismissible: boolean;
  expiresAt?: Date;
}
