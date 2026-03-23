// ===========================================
// Audit Interceptor
// ===========================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditAction, EntityType } from '@prisma/client';

// Metadata keys
export const AUDIT_ACTION_KEY = 'audit:action';
export const AUDIT_ENTITY_TYPE_KEY = 'audit:entityType';
export const AUDIT_SKIP_KEY = 'audit:skip';

// Decorators
export const AuditLog = (action: AuditAction, entityType: EntityType) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(AUDIT_ACTION_KEY, action)(target, propertyKey, descriptor);
    SetMetadata(AUDIT_ENTITY_TYPE_KEY, entityType)(target, propertyKey, descriptor);
    return descriptor;
  };
};

export const SkipAudit = () => SetMetadata(AUDIT_SKIP_KEY, true);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.get<boolean>(
      AUDIT_SKIP_KEY,
      context.getHandler(),
    );

    if (skip) {
      return next.handle();
    }

    const action = this.reflector.get<AuditAction>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    const entityType = this.reflector.get<EntityType>(
      AUDIT_ENTITY_TYPE_KEY,
      context.getHandler(),
    );

    if (!action || !entityType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.logAction(
            action,
            entityType,
            user?.id,
            request,
            response,
            Date.now() - startTime,
          );
        },
        error: (error) => {
          this.logAction(
            action,
            entityType,
            user?.id,
            request,
            null,
            Date.now() - startTime,
            error,
          );
        },
      }),
    );
  }

  private async logAction(
    action: AuditAction,
    entityType: EntityType,
    userId: string | undefined,
    request: any,
    response: any,
    duration: number,
    error?: Error,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const entityId = this.extractEntityId(request, response);

    const metadata: Record<string, unknown> = {
      method: request.method,
      path: request.path,
      duration,
      success: !error,
    };

    if (error) {
      metadata.error = {
        name: error.name,
        message: error.message,
      };
    }

    try {
      await this.auditService.create({
        userId,
        action,
        entityType,
        entityId: entityId || 'unknown',
        newValue: action === AuditAction.CREATE ? this.sanitizeBody(request.body) : undefined,
        oldValue: undefined,
        metadata,
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
      });
    } catch (err) {
      // Silent fail - don't break the main request
    }
  }

  private extractEntityId(request: any, response: any): string | undefined {
    // Try to get from params first
    if (request.params?.id) {
      return request.params.id;
    }

    // For create operations, get from response
    if (response?.id) {
      return response.id;
    }

    // Try to get from body
    if (request.body?.id) {
      return request.body.id;
    }

    return undefined;
  }

  private sanitizeBody(body: any): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey'];
    const sanitized = { ...body };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getClientIp(request: any): string | undefined {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip
    );
  }
}
