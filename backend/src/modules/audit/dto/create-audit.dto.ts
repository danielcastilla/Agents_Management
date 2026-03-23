// ===========================================
// Create Audit DTO
// ===========================================

import { AuditAction, EntityType } from '@prisma/client';

export class CreateAuditDto {
  userId?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
