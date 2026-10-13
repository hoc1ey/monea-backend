import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { DevicePlatform } from '../notifications.constants.js';

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'fcm_token_abcdef1234567890_xyz',
    description: 'Token de registro generado por Firebase Cloud Messaging',
  })
  @IsString({ message: 'El token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token de dispositivo es obligatorio' })
  token: string;

  @ApiPropertyOptional({
    example: DevicePlatform.ANDROID,
    enum: DevicePlatform,
    description: 'Plataforma del dispositivo',
    default: DevicePlatform.ANDROID,
  })
  @IsOptional()
  @IsEnum(DevicePlatform, {
    message: 'La plataforma debe ser un valor válido (ANDROID)',
  })
  platform?: DevicePlatform;
}
