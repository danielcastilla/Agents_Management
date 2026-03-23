// ===========================================
// Mock Provider (for testing/development)
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
import { LlmProviderType } from '../llm.constants';

@Injectable()
export class MockProvider implements LlmProvider {
  readonly name = LlmProviderType.MOCK;
  private readonly logger = new Logger(MockProvider.name);
  private readonly delay: number;

  constructor(private readonly configService: ConfigService) {
    this.delay = this.configService.get<number>('MOCK_LLM_DELAY', 100);
  }

  get isConfigured(): boolean {
    return true; // Always available
  }

  // =========================================
  // Complete (Non-streaming)
  // =========================================

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    await this.simulateDelay();

    const responseContent = this.generateMockResponse(request);
    const message: ChatMessage = {
      role: 'assistant',
      content: responseContent,
    };

    // Simulate tool calls if tools are provided
    if (request.tools && request.tools.length > 0 && Math.random() > 0.5) {
      const tool = request.tools[0];
      message.toolCalls = [
        {
          id: `call_${this.generateId()}`,
          type: 'function',
          function: {
            name: tool.function.name,
            arguments: JSON.stringify(this.generateMockToolArgs(tool)),
          },
        },
      ];
      message.content = '';
    }

    const inputTokens = this.estimateTokens(
      request.messages.map((m) => m.content).join(' '),
    );
    const outputTokens = this.estimateTokens(responseContent);

    return {
      id: `mock-${this.generateId()}`,
      model: request.model || 'mock-model',
      provider: this.name,
      message,
      finishReason: message.toolCalls ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
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
    const responseContent = this.generateMockResponse(request);
    const words = responseContent.split(' ');
    const messageId = `mock-${this.generateId()}`;

    for (let i = 0; i < words.length; i++) {
      await this.simulateDelay(20); // Faster for streaming

      yield {
        id: messageId,
        delta: {
          content: words[i] + (i < words.length - 1 ? ' ' : ''),
        },
        finishReason: null,
      };
    }

    yield {
      id: messageId,
      delta: {},
      finishReason: 'stop',
    };
  }

  // =========================================
  // Available Models
  // =========================================

  getAvailableModels(): string[] {
    return ['mock-model', 'mock-fast', 'mock-slow'];
  }

  // =========================================
  // Validate API Key
  // =========================================

  async validateApiKey(): Promise<boolean> {
    return true;
  }

  // =========================================
  // Private Helpers
  // =========================================

  private async simulateDelay(ms?: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms || this.delay));
  }

  private generateMockResponse(request: CompletionRequest): string {
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user');

    const responses = [
      'I understand your request. Let me help you with that.',
      'Based on my analysis, here is what I found.',
      'That\'s an interesting question. Here\'s my response.',
      'I\'ve processed your request and here are the results.',
      'Thank you for your query. Here\'s the information you requested.',
    ];

    const base = responses[Math.floor(Math.random() * responses.length)];
    
    if (lastUserMessage) {
      return `${base} You asked about: "${lastUserMessage.content.substring(0, 50)}..." This is a mock response for testing purposes. In a real scenario, this would contain actual AI-generated content based on your input.`;
    }

    return `${base} This is a mock response generated for testing purposes.`;
  }

  private generateMockToolArgs(tool: any): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    const params = tool.function.parameters?.properties || {};

    for (const [key, schema] of Object.entries(params) as any) {
      switch (schema.type) {
        case 'string':
          args[key] = `mock_${key}_value`;
          break;
        case 'number':
          args[key] = Math.floor(Math.random() * 100);
          break;
        case 'boolean':
          args[key] = Math.random() > 0.5;
          break;
        case 'array':
          args[key] = ['item1', 'item2'];
          break;
        default:
          args[key] = 'mock_value';
      }
    }

    return args;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
