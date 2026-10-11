import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Trust proxy para obtener la IP real del cliente detrás de un reverse proxy
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Helmet para seguridad en encabezados HTTP
  app.use(helmet());

  // CORS configurable
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Prefijo global api/v1 excluyendo /health
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  // Validación global con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Interceptor y Filtro globales de contrato de respuesta
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Monea API')
    .setDescription('Documentación de la API de Finanzas Personales Monea')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Shutdown hooks
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`🚀 Monea API corriendo en http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger en http://localhost:${port}/api/docs`);
  logger.log(`💓 Health check en http://localhost:${port}/health`);
}

await bootstrap();
