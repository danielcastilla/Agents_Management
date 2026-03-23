// ===========================================
// LLM Service
// ===========================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LlmProviderFactory } from './llm-provider.factory';
import {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ChatMessage,
  ToolDefinition,
} from './llm.interfaces';
import { LlmProviderType, MODEL_CONTEXT_LENGTHS } from './llm.constants';

export interface ChatOptions {
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: CompletionRequest['toolChoice'];
  stream?: boolean;
  fallbackProvider?: LlmProviderType;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly providerFactory: LlmProviderFactory) {}

  // =========================================
  // Chat Completion
  // =========================================

  async chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): Promise<CompletionResponse> {
    const provider = this.providerFactory.getProviderForModel(options.model);

    if (!provider.isConfigured) {
      if (options.fallbackProvider) {
        this.logger.warn(
          `Provider for ${options.model} not configured, using fallback`,
        );
        const fallback = this.providerFactory.getProvider(options.fallbackProvider);
        return this.executeCompletion(fallback, messages, options);
      }
      throw new BadRequestException(
        `Provider for model "${options.model}" is not configured`,
      );
    }

    return this.executeCompletion(provider, messages, options);
  }

  // =========================================
  // Chat Completion with Streaming
  // =========================================

  async *chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = this.providerFactory.getProviderForModel(options.model);

    if (!provider.isConfigured) {
      throw new BadRequestException(
        `Provider for model "${options.model}" is not configured`,
      );
    }

    const request = this.buildRequest(messages, options);
    yield* provider.completeStream(request);
  }

  // =========================================
  // Simple Message
  // =========================================

  async simpleMessage(
    userMessage: string,
    options: Omit<ChatOptions, 'tools' | 'toolChoice'>,
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await this.chat(messages, options);
    return response.message.content;
  }

  // =========================================
  // Chat with Tools
  // =========================================

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options: ChatOptions,
    toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>,
    maxIterations: number = 10,
  ): Promise<{ response: CompletionResponse; iterations: number }> {
    let currentMessages = [...messages];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.chat(currentMessages, {
        ...options,
        tools,
        toolChoice: iterations === 1 ? options.toolChoice : 'auto',
      });

      // If no tool calls, we're done
      if (!response.message.toolCalls || response.message.toolCalls.length === 0) {
        return { response, iterations };
      }

      // Add assistant message with tool calls
      currentMessages.push(response.message);

      // Execute each tool call
      for (const toolCall of response.message.toolCalls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await toolExecutor(toolCall.function.name, args);

          currentMessages.push({
            role: 'tool',
            content: result,
            toolCallId: toolCall.id,
          });
        } catch (error) {
          currentMessages.push({
            role: 'tool',
            content: `Error executing tool: ${error.message}`,
            toolCallId: toolCall.id,
          });
        }
      }
    }

    throw new Error(`Max iterations (${maxIterations}) reached without completion`);
  }

  // =========================================
  // Get Available Models
  // =========================================

  getAvailableModels(): Array<{
    model: string;
    provider: LlmProviderType;
    contextLength: number;
  }> {
    return this.providerFactory.getAllModels().map((m) => ({
      ...m,
      contextLength: MODEL_CONTEXT_LENGTHS[m.model] || 4096,
    }));
  }

  // =========================================
  // Get Provider Status
  // =========================================

  async getProvidersStatus(): Promise<
    Array<{
      type: LlmProviderType;
      configured: boolean;
      valid: boolean;
      models: string[];
    }>
  > {
    const providers = this.providerFactory.getAvailableProviders();
    const validation = await this.providerFactory.validateAllProviders();

    return providers.map((p) => ({
      ...p,
      valid: validation[p.type],
    }));
  }

  // =========================================
  // Estimate Tokens
  // =========================================

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    // More accurate would use tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  // =========================================
  // Check Context Fit
  // =========================================

  checkContextFit(
    messages: ChatMessage[],
    model: string,
  ): { fits: boolean; estimated: number; max: number } {
    const maxContext = MODEL_CONTEXT_LENGTHS[model] || 4096;
    const totalText = messages.map((m) => m.content).join(' ');
    const estimated = this.estimateTokens(totalText);

    return {
      fits: estimated < maxContext * 0.9, // Leave 10% margin
      estimated,
      max: maxContext,
    };
  }

  // =========================================
  // Private Helpers
  // =========================================

  private async executeCompletion(
    provider: any,
    messages: ChatMessage[],
    options: ChatOptions,
  ): Promise<CompletionResponse> {
    const request = this.buildRequest(messages, options);

    try {
      return await provider.complete(request);
    } catch (error) {
      this.logger.error(`Completion failed: ${error.message}`);
      throw error;
    }
  }

  private buildRequest(
    messages: ChatMessage[],
    options: ChatOptions,
  ): CompletionRequest {
    const allMessages = [...messages];

    // Add system prompt if provided and not already present
    if (options.systemPrompt) {
      const hasSystem = allMessages.some((m) => m.role === 'system');
      if (!hasSystem) {
        allMessages.unshift({ role: 'system', content: options.systemPrompt });
      }
    }

    return {
      model: options.model,
      messages: allMessages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
      toolChoice: options.toolChoice,
      stream: options.stream,
    };
  }
}
