// ===========================================
// LLM Controller
// ===========================================

import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { LlmService } from './llm.service';
import { LlmProviderFactory } from './llm-provider.factory';
import { ChatRequestDto, ChatResponseDto, ModelsResponseDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';

@ApiTags('LLM')
@ApiBearerAuth()
@Controller('llm')
@UseGuards(JwtAuthGuard)
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly providerFactory: LlmProviderFactory,
  ) {}

  // =========================================
  // Chat Completion
  // =========================================

  @Post('chat')
  @ApiOperation({ summary: 'Send a chat completion request' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chat completion response',
    type: ChatResponseDto,
  })
  async chat(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    const response = await this.llmService.chat(dto.messages, {
      model: dto.model,
      systemPrompt: dto.systemPrompt,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      tools: dto.tools,
      toolChoice: dto.toolChoice,
    });

    return {
      id: response.id,
      model: response.model,
      provider: response.provider,
      message: response.message as any,
      finishReason: response.finishReason,
      usage: response.usage,
    };
  }

  // =========================================
  // Chat with Streaming
  // =========================================

  @Post('chat/stream')
  @ApiOperation({ summary: 'Send a chat completion request with streaming' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Server-Sent Events stream',
  })
  async chatStream(
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = this.llmService.chatStream(dto.messages, {
        model: dto.model,
        systemPrompt: dto.systemPrompt,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        tools: dto.tools,
        toolChoice: dto.toolChoice,
        stream: true,
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  // =========================================
  // Get Available Models
  // =========================================

  @Get('models')
  @ApiOperation({ summary: 'Get available LLM models' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available models',
    type: ModelsResponseDto,
  })
  async getModels(): Promise<ModelsResponseDto> {
    const models = this.llmService.getAvailableModels();
    return { models };
  }

  // =========================================
  // Get Providers Status
  // =========================================

  @Get('providers')
  @ApiOperation({ summary: 'Get LLM providers status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Providers status',
  })
  async getProviders() {
    return this.llmService.getProvidersStatus();
  }

  // =========================================
  // Validate Providers
  // =========================================

  @Post('providers/validate')
  @ApiOperation({ summary: 'Validate all provider API keys' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateProviders() {
    return this.providerFactory.validateAllProviders();
  }

  // =========================================
  // Estimate Tokens
  // =========================================

  @Post('tokens/estimate')
  @ApiOperation({ summary: 'Estimate token count for text' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token estimate',
  })
  async estimateTokens(@Body() body: { text: string }): Promise<{ tokens: number }> {
    const tokens = this.llmService.estimateTokens(body.text);
    return { tokens };
  }
}
