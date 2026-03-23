// ===========================================
// Agents Module
// ===========================================

import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentVersionsService } from './agent-versions.service';
import { AgentPermissionsService } from './agent-permissions.service';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, AgentVersionsService, AgentPermissionsService],
  exports: [AgentsService, AgentVersionsService, AgentPermissionsService],
})
export class AgentsModule {}
