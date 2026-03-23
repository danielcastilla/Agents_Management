// ===========================================
// Tools Module
// ===========================================

import { Module } from '@nestjs/common';

import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { ToolExecutionService } from './tool-execution.service';
import { AgentToolsService } from './agent-tools.service';

@Module({
  controllers: [ToolsController],
  providers: [ToolsService, ToolExecutionService, AgentToolsService],
  exports: [ToolsService, ToolExecutionService, AgentToolsService],
})
export class ToolsModule {}
