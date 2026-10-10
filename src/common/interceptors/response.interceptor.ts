import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: true;
  statusCode: number;
  data: T;
  message: string;
  errors: null;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((resData) => {
        const statusCode = response?.statusCode ?? 200;
        let message = 'Operación exitosa';
        let data = resData;

        if (resData !== null && typeof resData === 'object') {
          if ('message' in resData && typeof resData.message === 'string') {
            message = resData.message;
            if ('data' in resData) {
              data = resData.data;
            } else {
              const { message: _, ...rest } = resData as Record<string, unknown>;
              data = Object.keys(rest).length > 0 ? rest : null;
            }
          }
        }

        return {
          success: true,
          statusCode,
          data: (data ?? null) as T,
          message,
          errors: null,
        };
      }),
    );
  }
}
