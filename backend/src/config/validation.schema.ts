// ===========================================
// Environment Variables Validation Schema
// ===========================================

import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('api/v1'),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: Joi.string().length(32).required(),

  // LLM Providers (optional in dev)
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  OPENAI_ORG_ID: Joi.string().optional().allow(''),
  ANTHROPIC_API_KEY: Joi.string().optional().allow(''),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  // WebSocket
  WS_PORT: Joi.number().default(3002),
});
