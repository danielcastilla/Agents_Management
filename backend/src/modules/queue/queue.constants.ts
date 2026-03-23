// ===========================================
// Queue Constants
// ===========================================

export const QUEUES = {
  AGENT_RUN: 'agent-run',
  TOOL_INVOCATION: 'tool-invocation',
  ANALYTICS: 'analytics',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];
