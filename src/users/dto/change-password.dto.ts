import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'ClaveActual123', description: 'Contraseña actual del usuario' })
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña actual no puede estar vacía' })
  currentPassword: string;

  @ApiProperty({
    example: 'NuevaClaveSegura456',
    description: 'Nueva contraseña (mínimo 8 caracteres, mayúscula, minúscula y número)',
  })
  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La nueva contraseña debe incluir al menos una mayúscula, una minúscula y un número',
  })
  newPassword: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Si es true, cierra todas las sesiones e invalida todos los tokens del usuario. En el flujo de cambio obligatorio SIEMPRE debe enviarse true.',
  })
  @IsOptional()
  @IsBoolean({ message: 'deleteAllSessions debe ser un valor booleano' })
  deleteAllSessions?: boolean;
}
