// ===========================================
// OpenAI Provider
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
import { LlmProviderType, OPENAI_MODELS } from '../llm.constants';

@Injectable()
export class OpenAIProvider implements LlmProvider {
  readonly name = LlmProviderType.OPENAI;
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organization?: string;
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.baseUrl = this.configService.get<string>(
      'OPENAI_BASE_URL',
      'https://api.openai.com/v1',
    );
    this.organization = this.configService.get<string>('OPENAI_ORGANIZATION');
    this.timeout = this.configService.get<number>('OPENAI_TIMEOUT', 60000);
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  // =========================================
  // Complete (Non-streaming)
  // =========================================

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key is not configured');
    }

    const startTime = Date.now();
    const body = this.buildRequestBody(request);

    const response = await this.makeRequest('/chat/completions', body);

    const choice = response.choices[0];
    const message = this.parseMessage(choice.message);

    return {
      id: response.id,
      model: response.model,
      provider: this.name,
      message,
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      createdAt: new Date(response.created * 1000),
    };
  }

  // =========================================
  // Complete with Streaming
  // =========================================

  async *completeStream(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.isConfigured) {
      throw new Error('OpenAI API key is not configured');
    }

    const body = this.buildRequestBody({ ...request, stream: true });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices[0]?.delta;

            if (delta) {
              yield {
                id: data.id,
                delta: {
                  content: delta.content,
                  toolCalls: delta.tool_calls,
                },
                finishReason: data.choices[0]?.finish_reason,
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
    return [...OPENAI_MODELS];
  }

  // =========================================
  // Validate API Key
  // =========================================

  async validateApiKey(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.buildHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // =========================================
  // Private Helpers
  // =========================================

  private buildRequestBody(request: CompletionRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map((m) => this.formatMessage(m)),
      stream: request.stream || false,
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.frequencyPenalty !== undefined) body.frequency_penalty = request.frequencyPenalty;
    if (request.presencePenalty !== undefined) body.presence_penalty = request.presencePenalty;
    if (request.stop) body.stop = request.stop;
    if (request.user) body.user = request.user;

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      if (request.toolChoice) {
        body.tool_choice = request.toolChoice;
      }
    }

    return body;
  }

  private formatMessage(message: ChatMessage): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
      role: message.role,
      content: message.content,
    };

    if (message.name) formatted.name = message.name;
    if (message.toolCallId) formatted.tool_call_id = message.toolCallId;
    if (message.toolCalls) formatted.tool_calls = message.toolCalls;

    return formatted;
  }

  private parseMessage(rawMessage: any): ChatMessage {
    return {
      role: rawMessage.role,
      content: rawMessage.content || '',
      toolCalls: rawMessage.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    return headers;
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
          `OpenAI API error: ${error.error?.message || response.statusText}`,
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
