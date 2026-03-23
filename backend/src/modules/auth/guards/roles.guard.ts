// ===========================================
// Role-Based Access Control Guard
// ===========================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY, IS_PUBLIC_KEY } from '@/common/decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Get required roles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has required role
    const hasRole = this.matchRoles(requiredRoles, user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Match user role against required roles
   * Implements role hierarchy: ADMIN > SUPERVISOR > OPERATOR > AUDITOR
   */
  private matchRoles(requiredRoles: UserRole[], userRole: UserRole): boolean {
    // Role hierarchy
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.ADMIN]: 100,
      [UserRole.SUPERVISOR]: 75,
      [UserRole.OPERATOR]: 50,
      [UserRole.AUDITOR]: 25,
    };

    const userRoleLevel = roleHierarchy[userRole];
    
    // Check if user's role level is >= any required role level
    return requiredRoles.some(role => userRoleLevel >= roleHierarchy[role]);
  }
}
