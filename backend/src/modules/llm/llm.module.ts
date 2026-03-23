// ===========================================
// LLM Module
// ===========================================

import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockProvider } from './providers/mock.provider';
import { LlmProviderFactory } from './llm-provider.factory';
import { LLM_PROVIDERS } from './llm.constants';

@Module({})
export class LlmModule {
  static forRoot(): DynamicModule {
    return {
      module: LlmModule,
      imports: [ConfigModule],
      controllers: [LlmController],
      providers: [
        LlmService,
        LlmProviderFactory,
        OpenAIProvider,
        AnthropicProvider,
        MockProvider,
        {
          provide: LLM_PROVIDERS,
          useFactory: (
            openai: OpenAIProvider,
            anthropic: AnthropicProvider,
            mock: MockProvider,
          ) => ({
            openai,
            anthropic,
            mock,
          }),
          inject: [OpenAIProvider, AnthropicProvider, MockProvider],
        },
      ],
      exports: [LlmService, LlmProviderFactory],
    };
  }
}
