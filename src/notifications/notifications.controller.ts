import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { RegisterDeviceDto } from './dto/register-device.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar token de dispositivo FCM para notificaciones push' })
  @SwaggerApiResponse({ status: 201, description: 'Dispositivo registrado correctamente' })
  @SwaggerApiResponse({ status: 400, description: 'Datos de validación inválidos' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    const device = await this.notificationsService.registerDevice(
      userId,
      dto.token,
      dto.platform,
    );
    return {
      data: device,
      message: 'Dispositivo registrado correctamente',
    };
  }

  @Delete('devices/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar token de dispositivo para no recibir notificaciones' })
  @ApiParam({ name: 'token', description: 'Token FCM a desactivar' })
  @SwaggerApiResponse({ status: 200, description: 'Dispositivo desactivado correctamente' })
  @SwaggerApiResponse({ status: 401, description: 'No autenticado' })
  @SwaggerApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  async unregisterDevice(
    @CurrentUser('id') userId: string,
    @Param('token') token: string,
  ) {
    await this.notificationsService.unregisterDevice(userId, token);
    return {
      data: null,
      message: 'Dispositivo desactivado correctamente',
    };
  }
}
