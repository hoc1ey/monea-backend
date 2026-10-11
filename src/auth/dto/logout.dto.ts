import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token a revocar (opcional)' })
  @IsOptional()
  @IsString({ message: 'El refresh token debe ser una cadena de texto' })
  refreshToken?: string;
}
