// ===========================================
// LLM Interfaces
// ===========================================

import { LlmProviderType } from './llm.constants';

// Message roles
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

// Chat message
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

// Tool call
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Tool definition (OpenAI format)
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

// Completion request
export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  user?: string;
}

// Completion response
export interface CompletionResponse {
  id: string;
  model: string;
  provider: LlmProviderType;
  message: ChatMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  createdAt: Date;
}

// Streaming chunk
export interface StreamChunk {
  id: string;
  delta: {
    content?: string;
    toolCalls?: Partial<ToolCall>[];
  };
  finishReason?: string | null;
}

// Provider interface
export interface LlmProvider {
  readonly name: LlmProviderType;
  readonly isConfigured: boolean;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
  
  completeStream(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  getAvailableModels(): string[];
  
  validateApiKey(): Promise<boolean>;
}

// Provider config
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
}
