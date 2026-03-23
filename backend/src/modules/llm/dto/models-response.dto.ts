// ===========================================
// Models Response DTO
// ===========================================

import { ApiProperty } from '@nestjs/swagger';
import { LlmProviderType } from '../llm.constants';

class ModelInfoDto {
  @ApiProperty({ example: 'gpt-4o' })
  model: string;

  @ApiProperty({ enum: LlmProviderType, example: 'openai' })
  provider: LlmProviderType;

  @ApiProperty({ example: 128000 })
  contextLength: number;
}

export class ModelsResponseDto {
  @ApiProperty({
    description: 'Available models',
    type: [ModelInfoDto],
  })
  models: ModelInfoDto[];
}
