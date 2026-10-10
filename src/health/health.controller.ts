import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerApiResponse } from '@nestjs/swagger';
import { IsPublic } from '../common/decorators/is-public.decorator.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @IsPublic()
  @Get()
  @ApiOperation({ summary: 'Verificar estado de salud del servicio' })
  @SwaggerApiResponse({ status: 200, description: 'Servicio operativo' })
  check() {
    return {
      data: {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      message: 'Servicio operativo',
    };
  }
}
