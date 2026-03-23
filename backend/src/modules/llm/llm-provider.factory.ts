// ===========================================
// LLM Provider Factory
// ===========================================

import { Injectable, Inject, Logger } from '@nestjs/common';
import { LlmProvider } from './llm.interfaces';
import { LlmProviderType, LLM_PROVIDERS, DEFAULT_MODELS } from './llm.constants';

@Injectable()
export class LlmProviderFactory {
  private readonly logger = new Logger(LlmProviderFactory.name);

  constructor(
    @Inject(LLM_PROVIDERS)
    private readonly providers: Record<LlmProviderType, LlmProvider>,
  ) {}

  // =========================================
  // Get Provider
  // =========================================

  getProvider(type: LlmProviderType): LlmProvider {
    const provider = this.providers[type];
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${type}`);
    }
    return provider;
  }

  // =========================================
  // Get Provider for Model
  // =========================================

  getProviderForModel(model: string): LlmProvider {
    // Check OpenAI models
    if (model.startsWith('gpt-')) {
      return this.getProvider(LlmProviderType.OPENAI);
    }

    // Check Anthropic models
    if (model.startsWith('claude-')) {
      return this.getProvider(LlmProviderType.ANTHROPIC);
    }

    // Check mock models
    if (model.startsWith('mock-')) {
      return this.getProvider(LlmProviderType.MOCK);
    }

    // Default to OpenAI for unknown models
    this.logger.warn(`Unknown model "${model}", defaulting to OpenAI provider`);
    return this.getProvider(LlmProviderType.OPENAI);
  }

  // =========================================
  // Get Available Providers
  // =========================================

  getAvailableProviders(): Array<{
    type: LlmProviderType;
    configured: boolean;
    models: string[];
  }> {
    return Object.entries(this.providers).map(([type, provider]) => ({
      type: type as LlmProviderType,
      configured: provider.isConfigured,
      models: provider.getAvailableModels(),
    }));
  }

  // =========================================
  // Get Configured Providers
  // =========================================

  getConfiguredProviders(): LlmProvider[] {
    return Object.values(this.providers).filter((p) => p.isConfigured);
  }

  // =========================================
  // Get Default Model for Provider
  // =========================================

  getDefaultModel(type: LlmProviderType): string {
    return DEFAULT_MODELS[type];
  }

  // =========================================
  // Get All Available Models
  // =========================================

  getAllModels(): Array<{ model: string; provider: LlmProviderType }> {
    const models: Array<{ model: string; provider: LlmProviderType }> = [];

    for (const [type, provider] of Object.entries(this.providers)) {
      if (provider.isConfigured) {
        for (const model of provider.getAvailableModels()) {
          models.push({
            model,
            provider: type as LlmProviderType,
          });
        }
      }
    }

    return models;
  }

  // =========================================
  // Validate All Providers
  // =========================================

  async validateAllProviders(): Promise<Record<LlmProviderType, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [type, provider] of Object.entries(this.providers)) {
      try {
        results[type] = await provider.validateApiKey();
      } catch (error) {
        this.logger.error(`Failed to validate ${type}: ${error.message}`);
        results[type] = false;
      }
    }

    return results as Record<LlmProviderType, boolean>;
  }
}
