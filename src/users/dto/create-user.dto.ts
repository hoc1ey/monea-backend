import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'juan.perez@example.com', description: 'Correo electrónico único' })
  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @ApiProperty({
    example: 'ClaveSegura123',
    description: 'Contraseña mínima de 8 caracteres con al menos una mayúscula, minúscula y número',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  @ApiProperty({ example: 'Juan Pérez', description: 'Nombre completo del usuario' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiPropertyOptional({ example: 'America/Bogota', description: 'Zona horaria IANA del usuario' })
  @IsOptional()
  @IsString({ message: 'La zona horaria debe ser una cadena de texto' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;
}
