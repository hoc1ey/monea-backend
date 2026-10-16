import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { ReminderOffset } from '../recurring-expenses.constants.js';

export class UpdateRecurringExpenseDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta bancaria asociada (UUID)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  accountId?: string;

  @ApiPropertyOptional({ example: 'Gimnasio semanal', maxLength: 80 })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El nombre no puede exceder los 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'isVariableAmount debe ser un valor booleano' })
  isVariableAmount?: boolean;

  @ApiPropertyOptional({ example: 'Mensualidad del gimnasio', maxLength: 255 })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'La descripción no puede exceder los 255 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @ApiPropertyOptional({ enum: RecurrenceFrequency })
  @IsOptional()
  @IsEnum(RecurrenceFrequency, {
    message: 'La frecuencia debe ser WEEKLY, MONTHLY o YEARLY',
  })
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día de la semana debe ser un entero' })
  @Min(1, { message: 'El día de la semana debe estar entre 1 y 7' })
  @Max(7, { message: 'El día de la semana debe estar entre 1 y 7' })
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día del mes debe ser un entero' })
  @Min(1, { message: 'El día del mes debe estar entre 1 y 31' })
  @Max(31, { message: 'El día del mes debe estar entre 1 y 31' })
  dayOfMonth?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes del año debe ser un entero' })
  @Min(1, { message: 'El mes del año debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes del año debe estar entre 1 y 12' })
  monthOfYear?: number;

  @ApiPropertyOptional({ example: '2026-10-09' })
  @IsOptional()
  @IsISO8601({}, { message: 'startDate debe tener un formato ISO8601 válido' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-10-09' })
  @IsOptional()
  @IsISO8601({}, { message: 'endDate debe tener un formato ISO8601 válido' })
  endDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'reminderEnabled debe ser un valor booleano' })
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ enum: ReminderOffset })
  @IsOptional()
  @IsEnum(ReminderOffset, {
    message: 'reminderOffset debe ser SAME_DAY o ONE_DAY_BEFORE',
  })
  reminderOffset?: ReminderOffset;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La hora del recordatorio debe ser un entero' })
  @Min(0, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  @Max(23, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  reminderHour?: number;
}
