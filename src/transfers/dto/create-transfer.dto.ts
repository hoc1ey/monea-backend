import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUUID,
  IsISO8601,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTransferDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta origen de la transferencia (UUID)',
  })
  @IsUUID('4', { message: 'El sourceAccountId debe ser un UUID válido' })
  sourceAccountId: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'ID de la cuenta destino de la transferencia (UUID)',
  })
  @IsUUID('4', { message: 'El destinationAccountId debe ser un UUID válido' })
  destinationAccountId: string;

  @ApiProperty({
    example: 500,
    description: 'Monto de la transferencia (positivo con máximo 2 decimales)',
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El monto debe ser mayor que 0' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Pago del alquiler',
    description: 'Motivo u observación opcional de la transferencia',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'La descripción no puede exceder los 255 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @ApiPropertyOptional({
    example: '2026-11-13T12:00:00.000Z',
    description: 'Fecha de la transferencia en formato ISO8601 (por defecto fecha actual)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha debe tener un formato ISO8601 válido' })
  date?: string;
}
