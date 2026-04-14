# ===========================================
# AI Agents Management Platform
# Enterprise AI Agent Governance System
# ===========================================

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Contributing](#contributing)

## 🎯 Overview

AI Agents Management Platform is an enterprise-grade web application for managing, executing, and governing AI agents. It provides comprehensive tools for:

- **Agent Management**: Create, configure, version, and clone AI agents
- **Execution Engine**: Run agents manually or automatically with streaming support
- **Tool Integration**: Manage external tools and function calling capabilities
- **Role-Based Access Control**: Fine-grained permissions with ADMIN, SUPERVISOR, OPERATOR, and AUDITOR roles
- **Cost Control**: Monitor token usage and costs per agent
- **Audit Logging**: Complete audit trail of all actions
- **Observability**: Real-time dashboards with metrics and analytics

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Dashboard │ │ Agents   │ │  Tools   │ │  Audit   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │ REST API / WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (NestJS)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Auth      │ │ Agents   │ │  Runs    │ │Analytics │           │
│  │Module    │ │ Module   │ │  Module  │ │ Module   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Tools     │ │ Audit    │ │  Users   │ │  LLM     │           │
│  │Module    │ │ Module   │ │  Module  │ │ Module   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐          ┌────┴────┐         ┌────┴────┐
    │PostgreSQL│          │  Redis  │         │ BullMQ  │
    └─────────┘          └─────────┘         └─────────┘
```

## 📦 Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** & **Docker Compose**
- **PostgreSQL** 16+ (via Docker)
- **Redis** 7+ (via Docker)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd Agents_Management

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Configure Environment Variables

Edit `backend/.env` with your settings:

```env
# Required for production
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key!

# LLM Provider Keys (optional for dev with mock)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
```

### 3. Start with Docker Compose

```bash
# Start all services (development)
docker-compose up -d

# Check services status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 4. Initialize Database

```bash
# Run migrations
docker-compose exec backend npm run prisma:migrate

# Seed database with test data
docker-compose exec backend npm run prisma:seed
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api/v1
- **API Docs (Swagger)**: http://localhost:3001/docs
- **Adminer (DB)**: http://localhost:8080
- **Redis Commander**: http://localhost:8081

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agentsplatform.com | Admin@123! |
| Supervisor | supervisor@agentsplatform.com | User@123! |
| Operator | operator@agentsplatform.com | User@123! |
| Auditor | auditor@agentsplatform.com | User@123! |

## 💻 Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run start:dev

# Run tests
npm run test
npm run test:cov
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### Useful Commands

```bash
# Prisma Studio (DB GUI)
npm run prisma:studio

# Generate new migration
npm run prisma:migrate -- --name migration_name

# Format code
npm run format

# Lint code
npm run lint
```

## 🚢 Production Deployment

### Using Docker Compose

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run prisma:migrate:prod
```

### Environment Variables (Production)

Create `.env.prod` with:

```env
# Database
DB_USER=agents_user
DB_PASSWORD=secure_password_here
DB_NAME=agents_management

# Redis
REDIS_PASSWORD=secure_redis_password

# JWT (generate secure keys)
JWT_SECRET=generate-with-openssl-rand-base64-32
JWT_REFRESH_SECRET=generate-with-openssl-rand-base64-32
ENCRYPTION_KEY=generate-32-char-encryption-key

# LLM Providers
OPENAI_API_KEY=sk-prod-openai-key
ANTHROPIC_API_KEY=sk-ant-prod-anthropic-key

# URLs
CORS_ORIGINS=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

## 📚 API Documentation

Full API documentation is available at `/docs` when running the backend.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | User authentication |
| GET | /api/v1/agents | List all agents |
| POST | /api/v1/agents | Create new agent |
| POST | /api/v1/runs | Execute agent |
| GET | /api/v1/analytics/dashboard | Get dashboard metrics |
| GET | /api/v1/audit-logs | Get audit logs |

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm run test

# Watch mode
npm run test:watch
```

## 📁 Project Structure

```
Agents_Management/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Seed data
│   ├── src/
│   │   ├── common/            # Shared utilities
│   │   ├── config/            # Configuration
│   │   └── modules/           # Feature modules
│   │       ├── auth/          # Authentication
│   │       ├── users/         # User management
│   │       ├── agents/        # Agent management
│   │       ├── runs/          # Execution engine
│   │       ├── tools/         # Tools management
│   │       ├── audit/         # Audit logging
│   │       ├── analytics/     # Metrics & analytics
│   │       └── llm/           # LLM providers
│   └── test/                  # Test files
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities
│   │   └── types/             # TypeScript types
│   └── public/                # Static assets
├── docker/                    # Docker configs
└── docker-compose.yml         # Development setup
```

## 🔐 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt (cost factor 12)
- Role-based access control (RBAC)
- API key encryption at rest
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers
- SQL injection protection via Prisma ORM

## 📊 Monitoring

The platform includes built-in observability:

- **Health endpoints**: `/health`, `/health/ready`, `/health/live`
- **Metrics dashboard**: Token usage, costs, execution counts
- **Audit logs**: Complete action trail
- **Error tracking**: Structured error logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
