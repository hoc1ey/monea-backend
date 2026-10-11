import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
