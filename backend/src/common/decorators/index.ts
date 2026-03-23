// ===========================================
// Custom Decorators
// ===========================================

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// ===========================================
// Roles Decorator
// ===========================================

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// ===========================================
// Public Route Decorator (Skip Auth)
// ===========================================

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ===========================================
// Current User Decorator
// ===========================================

export interface CurrentUserData {
  id: string;
  email: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext): CurrentUserData | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    if (data) {
      return user[data];
    }

    return user;
  },
);

// ===========================================
// API Key Decorator
// ===========================================

export const ApiKeyAuth = () => SetMetadata('apiKeyAuth', true);

// ===========================================
// Audit Action Decorator
// ===========================================

export const AUDIT_ACTION_KEY = 'auditAction';
export interface AuditMetadata {
  action: string;
  entityType: string;
}
export const AuditAction = (action: string, entityType: string) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, entityType } as AuditMetadata);
