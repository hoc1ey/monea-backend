import { describe, it, expect, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import {
  BadRequestException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  const createMockHost = () => {
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const response = { status: statusMock };
    const request = { method: 'GET', url: '/api/v1/test' };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    return { host, statusMock, jsonMock };
  };

  it('should format NotFoundException correctly', () => {
    const { host, statusMock, jsonMock } = createMockHost();
    const exception = new NotFoundException('Cuenta no encontrada');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      statusCode: 404,
      data: null,
      message: 'Cuenta no encontrada',
      errors: ['Cuenta no encontrada'],
    });
  });

  it('should format class-validator BadRequestException correctly', () => {
    const { host, statusMock, jsonMock } = createMockHost();
    const exception = new BadRequestException([
      'email debe ser un correo válido',
      'password debe tener mínimo 8 caracteres',
    ]);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      statusCode: 400,
      data: null,
      message: 'Bad Request',
      errors: [
        'email debe ser un correo válido',
        'password debe tener mínimo 8 caracteres',
      ],
    });
  });

  it('should format unknown unhandled exception as generic 500 without leaking stack', () => {
    const { host, statusMock, jsonMock } = createMockHost();
    const exception = new Error('Database connection secret failed');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      data: null,
      message: 'Error interno del servidor',
      errors: ['Error interno del servidor'],
    });
  });
});
