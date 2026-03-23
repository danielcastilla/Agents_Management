// ===========================================
// Tool Execution Service
// ===========================================

import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { HttpMethod } from '@prisma/client';
import Ajv from 'ajv';

import { PrismaService } from '../prisma/prisma.service';
import { ToolsService } from './tools.service';
import { TestToolDto } from './dto/test-tool.dto';
import { CurrentUserData } from '@/common/decorators';
import { retryWithBackoff } from '@/common/utils';

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);
  private readonly ajv = new Ajv({ allErrors: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: ToolsService,
  ) {}

  /**
   * Execute a tool with given input
   */
  async execute(
    toolId: string,
    input: unknown,
    runId?: string,
  ): Promise<ToolExecutionResult> {
    const tool = await this.toolsService.findOne(toolId);
    const startTime = Date.now();

    // Validate input against schema
    if (tool.schema) {
      const valid = this.validateInput(input, tool.schema as Record<string, unknown>);
      if (!valid.isValid) {
        return {
          success: false,
          error: `Input validation failed: ${valid.errors}`,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // Record invocation if runId provided
    let invocationId: string | null = null;
    if (runId) {
      const invocation = await this.prisma.toolInvocation.create({
        data: {
          agentRunId: runId,
          toolId,
          input: input as any,
          success: false,
        },
      });
      invocationId = invocation.id;
    }

    try {
      // Execute the tool
      const result = await retryWithBackoff(
        () => this.executeHttp(tool, input),
        tool.retryCount,
        1000,
      );

      const durationMs = Date.now() - startTime;

      // Update invocation record
      if (invocationId) {
        await this.prisma.toolInvocation.update({
          where: { id: invocationId },
          data: {
            output: result as any,
            success: true,
            duration: durationMs,
          },
        });
      }

      return {
        success: true,
        output: result,
        durationMs,
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update invocation record
      if (invocationId) {
        await this.prisma.toolInvocation.update({
          where: { id: invocationId },
          data: {
            errorMessage,
            success: false,
            duration: durationMs,
          },
        });
      }

      this.logger.error(`Tool ${tool.name} execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  /**
   * Test tool execution (without recording)
   */
  async testTool(
    toolId: string,
    testDto: TestToolDto,
    user: CurrentUserData,
  ): Promise<ToolExecutionResult> {
    const tool = await this.toolsService.findOne(toolId);

    if (!tool.isActive) {
      throw new BadRequestException('Cannot test inactive tool');
    }

    const startTime = Date.now();

    // Validate input against schema
    if (tool.schema) {
      const valid = this.validateInput(testDto.input, tool.schema as Record<string, unknown>);
      if (!valid.isValid) {
        return {
          success: false,
          error: `Input validation failed: ${valid.errors}`,
          durationMs: Date.now() - startTime,
        };
      }
    }

    try {
      // Execute with optional mock
      let result: unknown;
      if (testDto.mock) {
        result = testDto.mockResponse || { mock: true, message: 'Mock response' };
      } else {
        result = await this.executeHttp(tool, testDto.input);
      }

      const durationMs = Date.now() - startTime;

      this.logger.log(`Tool ${tool.name} tested by ${user.id}`);

      return {
        success: true,
        output: result,
        durationMs,
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  /**
   * Generate OpenAI function definition from tool
   */
  generateFunctionDefinition(tool: any): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  } {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.schema || {
          type: 'object',
          properties: {},
        },
      },
    };
  }

  // ===========================================
  // Private Methods
  // ===========================================

  private async executeHttp(
    tool: any,
    input: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(tool.headers || {}),
      };

      const fetchOptions: RequestInit = {
        method: tool.method,
        headers,
        signal: controller.signal,
      };

      // Add body for methods that support it
      if (tool.method !== HttpMethod.GET) {
        fetchOptions.body = JSON.stringify(input);
      }

      // For GET requests, add input as query params
      let endpoint = tool.endpoint;
      if (tool.method === HttpMethod.GET && input) {
        const params = new URLSearchParams();
        Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
          params.append(key, String(value));
        });
        endpoint = `${endpoint}?${params.toString()}`;
      }

      const response = await fetch(endpoint, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return await response.text();

    } finally {
      clearTimeout(timeout);
    }
  }

  private validateInput(
    input: unknown,
    schema: Record<string, unknown>,
  ): { isValid: boolean; errors?: string } {
    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(input);

      if (!valid) {
        const errors = validate.errors
          ?.map(e => `${e.instancePath} ${e.message}`)
          .join(', ');
        return { isValid: false, errors };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errors: `Schema validation error: ${error}`,
      };
    }
  }
}
