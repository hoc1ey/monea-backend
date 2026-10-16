import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const email = `e2e.${randomUUID()}@monea.test`;
  const password = 'ClaveSegura123';
  const server = () => app.getHttpServer();

  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
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

  afterAll(async () => {
    await app.close();
  });

  it('register -> devuelve 201 con el contrato estándar y tokens', async () => {
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'E2E User' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 201,
      message: 'Usuario registrado correctamente',
      errors: null,
    });
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('register con datos inválidos devuelve 400 con errores por campo', async () => {
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({ email: 'no-es-un-email', password: '123', name: 'X' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
      data: null,
    });
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('login -> devuelve 200 con nuevos tokens', async () => {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Sesión iniciada correctamente',
      errors: null,
    });

    accessToken = response.body.data.accessToken;
    refreshToken = response.body.data.refreshToken;
  });

  it('login con credenciales inválidas devuelve 401 con contrato de error', async () => {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ContraseñaIncorrecta1' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 401,
      data: null,
    });
    expect(response.body.errors).toContain('Credenciales inválidas');
  });

  it('refresh -> rota los tokens', async () => {
    const response = await request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    refreshToken = response.body.data.refreshToken;
  });

  it('logout -> cierra la sesión usando el access token', async () => {
    const response = await request(server())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Sesión cerrada correctamente',
      errors: null,
    });
  });

  it('una ruta protegida sin token devuelve 401', async () => {
    const response = await request(server()).get('/api/v1/accounts');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 401,
      data: null,
    });
  });

  it('aplica rate limit estricto en rutas públicas (429)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await request(server()).get('/health');
      statuses.push(response.status);
    }

    expect(statuses).toContain(200);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
