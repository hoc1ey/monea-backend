import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';

export class UpdateLoanDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'No modificable: el préstamo ya generó un egreso en la cuenta original',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  accountId?: string;

  @ApiPropertyOptional({ example: 'María Gómez', maxLength: 80 })
  @IsOptional()
  @IsString({ message: 'El nombre de la persona debe ser una cadena de texto' })
  @MaxLength(80, {
    message: 'El nombre de la persona no puede exceder los 80 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  personName?: string;

  @ApiPropertyOptional({
    example: 300,
    description:
      'No modificable: el préstamo ya generó un egreso por el monto original',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto total debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El monto total debe ser mayor que 0' })
  totalAmount?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de cuotas debe ser un entero' })
  @Min(1, { message: 'El número de cuotas debe ser mayor o igual a 1' })
  installmentsCount?: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'La descripción no puede exceder los 255 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'reminderEnabled debe ser un valor booleano' })
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ enum: RecurrenceFrequency, example: RecurrenceFrequency.MONTHLY })
  @IsOptional()
  @IsEnum(RecurrenceFrequency, {
    message: 'La frecuencia debe ser WEEKLY, MONTHLY o YEARLY',
  })
  reminderFrequency?: RecurrenceFrequency;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día de la semana debe ser un entero' })
  @Min(1, { message: 'El día de la semana debe estar entre 1 y 7' })
  @Max(7, { message: 'El día de la semana debe estar entre 1 y 7' })
  reminderDayOfWeek?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día del mes debe ser un entero' })
  @Min(1, { message: 'El día del mes debe estar entre 1 y 31' })
  @Max(31, { message: 'El día del mes debe estar entre 1 y 31' })
  reminderDayOfMonth?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes del año debe ser un entero' })
  @Min(1, { message: 'El mes del año debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes del año debe estar entre 1 y 12' })
  reminderMonth?: number;

  @ApiPropertyOptional({ example: '2026-12-01T14:00:00.000Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'reminderAt debe tener un formato ISO8601 válido' })
  reminderAt?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La hora del recordatorio debe ser un entero' })
  @Min(0, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  @Max(23, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  reminderHour?: number;
}
