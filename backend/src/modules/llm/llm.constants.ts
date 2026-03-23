// ===========================================
// LLM Constants
// ===========================================

export const LLM_PROVIDERS = 'LLM_PROVIDERS';

export enum LlmProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  MOCK = 'mock',
}

// Model mappings
export const OPENAI_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
] as const;

export const ANTHROPIC_MODELS = [
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-20241022',
] as const;

// Model context lengths
export const MODEL_CONTEXT_LENGTHS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-5-sonnet-20241022': 200000,
};

// Default model per provider
export const DEFAULT_MODELS: Record<LlmProviderType, string> = {
  [LlmProviderType.OPENAI]: 'gpt-4o',
  [LlmProviderType.ANTHROPIC]: 'claude-3-5-sonnet-20241022',
  [LlmProviderType.MOCK]: 'mock-model',
};
