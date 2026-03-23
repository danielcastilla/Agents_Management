// ===========================================
// Anthropic Provider
// ===========================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ChatMessage,
} from '../llm.interfaces';
import { LlmProviderType, ANTHROPIC_MODELS } from '../llm.constants';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = LlmProviderType.ANTHROPIC;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly anthropicVersion = '2023-06-01';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY', '');
    this.baseUrl = this.configService.get<string>(
      'ANTHROPIC_BASE_URL',
      'https://api.anthropic.com/v1',
    );
    this.timeout = this.configService.get<number>('ANTHROPIC_TIMEOUT', 60000);
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  // =========================================
  // Complete (Non-streaming)
  // =========================================

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.isConfigured) {
      throw new Error('Anthropic API key is not configured');
    }

    const body = this.buildRequestBody(request);
    const response = await this.makeRequest('/messages', body);

    return {
      id: response.id,
      model: response.model,
      provider: this.name,
      message: this.parseResponse(response),
      finishReason: this.mapStopReason(response.stop_reason),
      usage: {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens:
          (response.usage?.input_tokens || 0) +
          (response.usage?.output_tokens || 0),
      },
      createdAt: new Date(),
    };
  }

  // =========================================
  // Complete with Streaming
  // =========================================

  async *completeStream(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.isConfigured) {
      throw new Error('Anthropic API key is not configured');
    }

    const body = this.buildRequestBody({ ...request, stream: true });

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Anthropic API error: ${error.error?.message || response.statusText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let messageId = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.type === 'message_start') {
              messageId = data.message.id;
            } else if (data.type === 'content_block_delta') {
              const delta = data.delta;
              if (delta.type === 'text_delta') {
                yield {
                  id: messageId,
                  delta: { content: delta.text },
                  finishReason: null,
                };
              } else if (delta.type === 'input_json_delta') {
                // Tool use delta
                yield {
                  id: messageId,
                  delta: {
                    toolCalls: [
                      {
                        function: { name: '', arguments: delta.partial_json },
                      },
                    ],
                  },
                  finishReason: null,
                };
              }
            } else if (data.type === 'message_delta') {
              yield {
                id: messageId,
                delta: {},
                finishReason: this.mapStopReason(data.delta.stop_reason),
              };
            }
          } catch (e) {
            this.logger.warn(`Failed to parse SSE chunk: ${trimmed}`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // =========================================
  // Available Models
  // =========================================

  getAvailableModels(): string[] {
    return [...ANTHROPIC_MODELS];
  }

  // =========================================
  // Validate API Key
  // =========================================

  async validateApiKey(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      // Anthropic doesn't have a models endpoint, so we make a minimal request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      return response.ok || response.status === 400; // 400 means auth worked
    } catch {
      return false;
    }
  }

  // =========================================
  // Private Helpers
  // =========================================

  private buildRequestBody(request: CompletionRequest): Record<string, unknown> {
    // Extract system message
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const otherMessages = request.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: request.model,
      messages: otherMessages.map((m) => this.formatMessage(m)),
      max_tokens: request.maxTokens || 4096,
      stream: request.stream || false,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stop) body.stop_sequences = request.stop;

    // Convert OpenAI tools to Anthropic format
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));

      if (request.toolChoice) {
        if (request.toolChoice === 'auto') {
          body.tool_choice = { type: 'auto' };
        } else if (request.toolChoice === 'required') {
          body.tool_choice = { type: 'any' };
        } else if (typeof request.toolChoice === 'object') {
          body.tool_choice = {
            type: 'tool',
            name: request.toolChoice.function.name,
          };
        }
      }
    }

    return body;
  }

  private formatMessage(message: ChatMessage): Record<string, unknown> {
    // Anthropic uses 'user' and 'assistant' roles
    // Tool results go in user messages with tool_result content
    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content,
          },
        ],
      };
    }

    // Handle assistant messages with tool calls
    if (message.role === 'assistant' && message.toolCalls) {
      const content: any[] = [];
      if (message.content) {
        content.push({ type: 'text', text: message.content });
      }
      for (const tc of message.toolCalls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
      return { role: 'assistant', content };
    }

    return {
      role: message.role,
      content: message.content,
    };
  }

  private parseResponse(response: any): ChatMessage {
    const content: string[] = [];
    const toolCalls: any[] = [];

    for (const block of response.content || []) {
      if (block.type === 'text') {
        content.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      role: 'assistant',
      content: content.join(''),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private mapStopReason(
    reason: string,
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return null;
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.anthropicVersion,
    };
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Anthropic API error: ${error.error?.message || response.statusText}`,
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
