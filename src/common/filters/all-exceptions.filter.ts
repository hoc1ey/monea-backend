import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  data: null;
  message: string;
  errors: string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errors: string[] = ['Error interno del servidor'];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errors = [exceptionResponse];
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const respObj = exceptionResponse as Record<string, unknown>;

        // Errores de class-validator (array de mensajes)
        if (Array.isArray(respObj.message)) {
          errors = respObj.message.map((m) => String(m));
          message =
            typeof respObj.error === 'string' && respObj.error
              ? respObj.error
              : 'Error de validación';
        } else if (typeof respObj.message === 'string') {
          message = respObj.message;
          errors = [respObj.message];
        } else {
          message = exception.message || 'Error en la petición';
          errors = [message];
        }
      }
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `[${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}] Unhandled Exception: ${err.message}`,
        err.stack,
      );
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Error interno del servidor';
      errors = ['Error interno del servidor'];
    }

    const payload: ApiErrorResponse = {
      success: false,
      statusCode,
      data: null,
      message,
      errors,
    };

    response.status(statusCode).json(payload);
  }
}
