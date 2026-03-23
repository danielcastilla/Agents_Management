// ===========================================
// Response Transform Interceptor
// ===========================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Skip transformation for streaming responses
        if (response.getHeader('Content-Type')?.toString().includes('stream')) {
          return data;
        }

        // Skip transformation if already wrapped
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            requestId: request.headers['x-request-id'],
          },
        };
      }),
    );
  }
}
