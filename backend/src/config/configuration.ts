// ===========================================
// Application Configuration
// ===========================================

export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRATION || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!',
  },

  // LLM Providers
  llm: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      orgId: process.env.OPENAI_ORG_ID,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },

  // Rate Limiting
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // CORS
  cors: {
    origins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  },

  // WebSocket
  websocket: {
    port: parseInt(process.env.WS_PORT || '3002', 10),
  },
});
