-- ===========================================
-- PostgreSQL Initialization Script
-- ===========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database if not exists (handled by docker)
-- Additional initialization can be added here

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE agents_management TO postgres;

-- Set timezone
SET timezone = 'UTC';
