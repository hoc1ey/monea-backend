import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter.js';

describe('App & Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  it('/health (GET) should return standardized health response', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      statusCode: 200,
      data: expect.objectContaining({
        status: 'ok',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      }),
      message: 'Servicio operativo',
      errors: null,
    });
  });

  it('404 routes should return standardized error response with global contract', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        data: null,
        errors: expect.any(Array),
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
