// E2E Test Setup
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';
process.env.JWT_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global cleanup hook
afterAll(async () => {
  // Allow time for connections to close
  await new Promise((resolve) => setTimeout(resolve, 500));
});
