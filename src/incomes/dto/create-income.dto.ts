import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUUID,
  IsISO8601,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateIncomeDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta bancaria donde ingresa el dinero (UUID)',
  })
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  accountId: string;

  @ApiProperty({
    example: 'Salario de nómina quincenal',
    description: 'Nombre o concepto del ingreso',
    maxLength: 80,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede exceder los 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiProperty({
    example: 1850.5,
    description: 'Monto del ingreso (positivo con máximo 2 decimales)',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El monto debe ser mayor que 0' })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Pago de la primera quincena del mes',
    description: 'Descripción o notas opcionales del ingreso',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La descripción no puede exceder los 255 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @ApiPropertyOptional({
    example: '2026-10-15T12:00:00.000Z',
    description: 'Fecha del ingreso en formato ISO8601 (por defecto fecha actual)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha debe tener un formato ISO8601 válido' })
  date?: string;
}
