// ===========================================
// Request Logging Interceptor
// ===========================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, headers } = request;
    
    // Generate request ID
    const requestId = (headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = requestId;

    const userAgent = headers['user-agent'] || 'Unknown';
    const ip = request.ip || request.socket.remoteAddress || 'Unknown';
    
    const startTime = Date.now();

    this.logger.log(
      `➡️  [${requestId}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.substring(0, 50)}`,
    );

    // Log request body (sanitized) in debug mode
    if (process.env.NODE_ENV === 'development' && body && Object.keys(body).length > 0) {
      const sanitizedBody = this.sanitizeBody(body);
      this.logger.debug(`📦 [${requestId}] Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `⬅️  [${requestId}] ${method} ${url} - ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `❌ [${requestId}] ${method} ${url} - ${error.status || 500} - ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }

  /**
   * Sanitize sensitive fields from request body
   */
  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['password', 'passwordHash', 'token', 'apiKey', 'secret'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
