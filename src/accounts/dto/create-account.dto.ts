import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateAccountDto {
  @ApiProperty({
    example: 'Bancolombia Ahorros',
    description: 'Nombre o alias de la cuenta bancaria',
    maxLength: 60,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la cuenta es obligatorio' })
  @MaxLength(60, { message: 'El nombre no puede exceder los 60 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiProperty({
    example: 'Bancolombia',
    description: 'Institución financiera emisora de la cuenta',
    maxLength: 80,
  })
  @IsString({ message: 'La institución financiera debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La institución financiera es obligatoria' })
  @MaxLength(80, {
    message: 'La institución financiera no puede exceder los 80 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  financialInstitution: string;

  @ApiProperty({
    example: '#3B82F6',
    description: 'Color distintivo en formato hexadecimal (#RRGGBB)',
    maxLength: 7,
  })
  @IsString({ message: 'El color debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El color es obligatorio' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'El color debe tener un formato hexadecimal válido (#RRGGBB)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  color: string;

  @ApiProperty({
    example: 1500000.5,
    description: 'Saldo inicial de la cuenta (número con máximo 2 decimales)',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El saldo inicial debe ser un número con máximo 2 decimales' },
  )
  @IsNotEmpty({ message: 'El saldo inicial es obligatorio' })
  initialBalance: number;

  @ApiPropertyOptional({
    example: 'Cuenta principal para nómina y ahorros',
    description: 'Descripción o notas opcionales sobre la cuenta',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La descripción no puede exceder los 255 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;
}
