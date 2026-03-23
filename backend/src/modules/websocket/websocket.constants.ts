// ===========================================
// WebSocket Constants
// ===========================================

// Event names emitted by server
export enum ServerEvent {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',

  // Agent events
  AGENT_CREATED = 'agent:created',
  AGENT_UPDATED = 'agent:updated',
  AGENT_DELETED = 'agent:deleted',
  AGENT_STATUS_CHANGED = 'agent:status_changed',

  // Run events
  RUN_STARTED = 'run:started',
  RUN_COMPLETED = 'run:completed',
  RUN_FAILED = 'run:failed',
  RUN_PROGRESS = 'run:progress',
  RUN_STREAM = 'run:stream',
  RUN_TOOL_CALL = 'run:tool_call',
  RUN_TOOL_RESULT = 'run:tool_result',

  // Tool events
  TOOL_CREATED = 'tool:created',
  TOOL_UPDATED = 'tool:updated',
  TOOL_DELETED = 'tool:deleted',
  TOOL_EXECUTED = 'tool:executed',

  // Notification events
  NOTIFICATION = 'notification',
  NOTIFICATION_READ = 'notification:read',

  // System events
  SYSTEM_ALERT = 'system:alert',
  SYSTEM_MAINTENANCE = 'system:maintenance',

  // Presence events
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USERS_PRESENCE = 'users:presence',
}

// Event names received from client
export enum ClientEvent {
  // Subscription management
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',

  // Room management
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',

  // Run control
  CANCEL_RUN = 'cancel_run',

  // Notifications
  MARK_NOTIFICATION_READ = 'mark_notification_read',
  MARK_ALL_READ = 'mark_all_read',

  // Presence
  PING = 'ping',
  UPDATE_PRESENCE = 'update_presence',
}

// Room prefixes
export const ROOM_PREFIX = {
  USER: 'user:',
  AGENT: 'agent:',
  RUN: 'run:',
  ORGANIZATION: 'org:',
  BROADCAST: 'broadcast',
} as const;

// Notification types
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

// Notification priority
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}
