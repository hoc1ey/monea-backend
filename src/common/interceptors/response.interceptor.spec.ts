import { describe, it, expect } from 'vitest';
import { ResponseInterceptor } from './response.interceptor.js';
import { of, lastValueFrom } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  const createMockContext = (statusCode = 200) =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  it('should transform plain object response into standard contract', async () => {
    const handler: CallHandler = {
      handle: () => of({ test: 'value' }),
    };

    const observable = interceptor.intercept(createMockContext(200), handler);
    const result = await lastValueFrom(observable);

    expect(result).toEqual({
      success: true,
      statusCode: 200,
      data: { test: 'value' },
      message: 'Operación exitosa',
      errors: null,
    });
  });

  it('should preserve custom message and extract data if provided', async () => {
    const handler: CallHandler = {
      handle: () => of({ data: { id: 1 }, message: 'Cuenta creada correctamente' }),
    };

    const observable = interceptor.intercept(createMockContext(201), handler);
    const result = await lastValueFrom(observable);

    expect(result).toEqual({
      success: true,
      statusCode: 201,
      data: { id: 1 },
      message: 'Cuenta creada correctamente',
      errors: null,
    });
  });

  it('should handle response with only message properly', async () => {
    const handler: CallHandler = {
      handle: () => of({ message: 'Operación completada' }),
    };

    const observable = interceptor.intercept(createMockContext(200), handler);
    const result = await lastValueFrom(observable);

    expect(result).toEqual({
      success: true,
      statusCode: 200,
      data: null,
      message: 'Operación completada',
      errors: null,
    });
  });

  it('should handle null response properly', async () => {
    const handler: CallHandler = {
      handle: () => of(null),
    };

    const observable = interceptor.intercept(createMockContext(204), handler);
    const result = await lastValueFrom(observable);

    expect(result).toEqual({
      success: true,
      statusCode: 204,
      data: null,
      message: 'Operación exitosa',
      errors: null,
    });
  });
});
