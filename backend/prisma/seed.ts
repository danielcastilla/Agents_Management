// ===========================================
// Database Seed Script
// ===========================================

import { PrismaClient, UserRole, AgentEnvironment, HttpMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (optional - comment out in production)
  await prisma.auditLog.deleteMany();
  await prisma.toolInvocation.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.agentTool.deleteMany();
  await prisma.agentPermission.deleteMany();
  await prisma.agentVersion.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const adminPassword = await bcrypt.hash('Admin@123!', 12);
  const userPassword = await bcrypt.hash('User@123!', 12);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@agentsplatform.com',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const supervisorUser = await prisma.user.create({
    data: {
      email: 'supervisor@agentsplatform.com',
      passwordHash: userPassword,
      firstName: 'Team',
      lastName: 'Supervisor',
      role: UserRole.SUPERVISOR,
      isActive: true,
    },
  });

  const operatorUser = await prisma.user.create({
    data: {
      email: 'operator@agentsplatform.com',
      passwordHash: userPassword,
      firstName: 'Agent',
      lastName: 'Operator',
      role: UserRole.OPERATOR,
      isActive: true,
    },
  });

  const auditorUser = await prisma.user.create({
    data: {
      email: 'auditor@agentsplatform.com',
      passwordHash: userPassword,
      firstName: 'Security',
      lastName: 'Auditor',
      role: UserRole.AUDITOR,
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // Create Tools
  const weatherTool = await prisma.tool.create({
    data: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name or coordinates',
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            default: 'celsius',
          },
        },
        required: ['location'],
      },
      endpoint: 'https://api.weather.example.com/current',
      method: HttpMethod.GET,
      timeout: 5000,
      isActive: true,
      isMock: true,
      mockResponse: {
        temperature: 22,
        condition: 'sunny',
        humidity: 45,
      },
    },
  });

  const searchTool = await prisma.tool.create({
    data: {
      name: 'web_search',
      description: 'Search the web for information',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          maxResults: {
            type: 'number',
            default: 5,
          },
        },
        required: ['query'],
      },
      endpoint: 'https://api.search.example.com/search',
      method: HttpMethod.POST,
      timeout: 10000,
      isActive: true,
      isMock: true,
      mockResponse: {
        results: [
          { title: 'Example Result', url: 'https://example.com', snippet: 'Example snippet' },
        ],
      },
    },
  });

  const calculatorTool = await prisma.tool.create({
    data: {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      schema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      },
      method: HttpMethod.POST,
      timeout: 3000,
      isActive: true,
      isMock: true,
      mockResponse: {
        result: 42,
      },
    },
  });

  console.log('✅ Tools created');

  // Create Agents
  const customerServiceAgent = await prisma.agent.create({
    data: {
      name: 'Customer Service Agent',
      description: 'AI agent for handling customer inquiries and support tickets',
      modelProvider: 'OpenAI',
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: `You are a helpful customer service agent. Your goals are:
1. Answer customer questions accurately and professionally
2. Resolve issues efficiently
3. Escalate complex problems when necessary
4. Maintain a friendly and empathetic tone`,
      memoryEnabled: true,
      environment: AgentEnvironment.PRODUCTION,
      dailyTokenLimit: 100000,
      createdById: adminUser.id,
    },
  });

  const dataAnalystAgent = await prisma.agent.create({
    data: {
      name: 'Data Analyst Agent',
      description: 'AI agent specialized in data analysis and insights generation',
      modelProvider: 'Anthropic',
      modelName: 'claude-3-opus-20240229',
      temperature: 0.3,
      maxTokens: 8192,
      systemPrompt: `You are an expert data analyst. Your capabilities include:
1. Analyzing datasets and identifying patterns
2. Creating visualizations and reports
3. Providing actionable business insights
4. Statistical analysis and forecasting`,
      memoryEnabled: false,
      environment: AgentEnvironment.STAGING,
      dailyTokenLimit: 200000,
      createdById: supervisorUser.id,
    },
  });

  const codeReviewAgent = await prisma.agent.create({
    data: {
      name: 'Code Review Agent',
      description: 'AI agent for automated code reviews and suggestions',
      modelProvider: 'OpenAI',
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.2,
      maxTokens: 4096,
      systemPrompt: `You are an expert code reviewer. Focus on:
1. Code quality and best practices
2. Security vulnerabilities
3. Performance optimizations
4. Documentation and readability`,
      memoryEnabled: false,
      environment: AgentEnvironment.DEVELOPMENT,
      createdById: operatorUser.id,
    },
  });

  console.log('✅ Agents created');

  // Associate Tools with Agents
  await prisma.agentTool.createMany({
    data: [
      { agentId: customerServiceAgent.id, toolId: searchTool.id, priority: 1 },
      { agentId: customerServiceAgent.id, toolId: weatherTool.id, priority: 2 },
      { agentId: dataAnalystAgent.id, toolId: calculatorTool.id, priority: 1 },
      { agentId: dataAnalystAgent.id, toolId: searchTool.id, priority: 2 },
    ],
  });

  console.log('✅ Agent-Tool associations created');

  // Create Agent Permissions
  await prisma.agentPermission.createMany({
    data: [
      {
        userId: operatorUser.id,
        agentId: customerServiceAgent.id,
        canRead: true,
        canWrite: false,
        canExecute: true,
        canDelete: false,
      },
      {
        userId: operatorUser.id,
        agentId: dataAnalystAgent.id,
        canRead: true,
        canWrite: true,
        canExecute: true,
        canDelete: false,
      },
    ],
  });

  console.log('✅ Agent permissions created');

  // Create System Configurations
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'default_model_provider',
        value: { provider: 'OpenAI', model: 'gpt-4-turbo-preview' },
        category: 'agents',
      },
      {
        key: 'token_pricing',
        value: {
          'gpt-4-turbo-preview': { input: 0.00001, output: 0.00003 },
          'gpt-3.5-turbo': { input: 0.0000005, output: 0.0000015 },
          'claude-3-opus-20240229': { input: 0.000015, output: 0.000075 },
          'claude-3-sonnet-20240229': { input: 0.000003, output: 0.000015 },
        },
        category: 'billing',
      },
      {
        key: 'rate_limits',
        value: {
          default: { requestsPerMinute: 60, tokensPerDay: 1000000 },
          premium: { requestsPerMinute: 120, tokensPerDay: 5000000 },
        },
        category: 'security',
      },
    ],
  });

  console.log('✅ System configurations created');

  console.log('🎉 Database seed completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('   Admin: admin@agentsplatform.com / Admin@123!');
  console.log('   Supervisor: supervisor@agentsplatform.com / User@123!');
  console.log('   Operator: operator@agentsplatform.com / User@123!');
  console.log('   Auditor: auditor@agentsplatform.com / User@123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
