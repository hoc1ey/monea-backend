import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { ReminderOffset } from '../recurring-expenses.constants.js';

export class CreateRecurringExpenseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta bancaria asociada (UUID)',
  })
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  accountId: string;

  @ApiProperty({
    example: 'Gimnasio semanal',
    description: 'Nombre o concepto del egreso recurrente',
    maxLength: 80,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80, { message: 'El nombre no puede exceder los 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Monto fijo (obligatorio y prohibido según isVariableAmount). No se envía si es variable.',
  })
  @ValidateIf((o: CreateRecurringExpenseDto) => !o.isVariableAmount)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto es obligatorio cuando el monto no es variable' })
  amount?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Si es true, el monto se define al generar cada egreso',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isVariableAmount debe ser un valor booleano' })
  isVariableAmount?: boolean = false;

  @ApiPropertyOptional({
    example: 'Mensualidad del gimnasio',
    description: 'Descripción o notas opcionales',
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

  @ApiProperty({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.WEEKLY,
    description: 'Frecuencia de la recurrencia',
  })
  @IsEnum(RecurrenceFrequency, {
    message: 'La frecuencia debe ser WEEKLY, MONTHLY o YEARLY',
  })
  @IsNotEmpty({ message: 'La frecuencia es obligatoria' })
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({
    example: 1,
    description: 'Día de la semana (1=Lunes ... 7=Domingo). Obligatorio si WEEKLY',
  })
  @ValidateIf(
    (o: CreateRecurringExpenseDto) =>
      o.frequency === RecurrenceFrequency.WEEKLY,
  )
  @Type(() => Number)
  @IsInt({ message: 'El día de la semana debe ser un entero' })
  @Min(1, { message: 'El día de la semana debe estar entre 1 y 7' })
  @Max(7, { message: 'El día de la semana debe estar entre 1 y 7' })
  @IsNotEmpty({ message: 'El día de la semana es obligatorio para WEEKLY' })
  dayOfWeek?: number;

  @ApiPropertyOptional({
    example: 31,
    description:
      'Día del mes (1-31). Obligatorio si MONTHLY; opcional si YEARLY',
  })
  @ValidateIf(
    (o: CreateRecurringExpenseDto) =>
      o.frequency === RecurrenceFrequency.MONTHLY ||
      o.dayOfMonth !== undefined,
  )
  @Type(() => Number)
  @IsInt({ message: 'El día del mes debe ser un entero' })
  @Min(1, { message: 'El día del mes debe estar entre 1 y 31' })
  @Max(31, { message: 'El día del mes debe estar entre 1 y 31' })
  @IsNotEmpty({ message: 'El día del mes es obligatorio para MONTHLY' })
  dayOfMonth?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Mes del año (1-12). Obligatorio si YEARLY',
  })
  @ValidateIf(
    (o: CreateRecurringExpenseDto) =>
      o.frequency === RecurrenceFrequency.YEARLY,
  )
  @Type(() => Number)
  @IsInt({ message: 'El mes del año debe ser un entero' })
  @Min(1, { message: 'El mes del año debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes del año debe estar entre 1 y 12' })
  @IsNotEmpty({ message: 'El mes del año es obligatorio para YEARLY' })
  monthOfYear?: number;

  @ApiProperty({
    example: '2026-10-09',
    description: 'Fecha de inicio (ISO8601, YYYY-MM-DD)',
  })
  @IsISO8601({}, { message: 'startDate debe tener un formato ISO8601 válido' })
  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria' })
  startDate: string;

  @ApiPropertyOptional({
    example: '2027-10-09',
    description: 'Fecha de fin opcional (ISO8601, YYYY-MM-DD)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'endDate debe tener un formato ISO8601 válido' })
  endDate?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Activa el recordatorio del egreso recurrente',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'reminderEnabled debe ser un valor booleano' })
  reminderEnabled?: boolean = false;

  @ApiPropertyOptional({
    enum: ReminderOffset,
    example: ReminderOffset.ONE_DAY_BEFORE,
    description: 'Momento del recordatorio. Obligatorio si reminderEnabled',
  })
  @ValidateIf(
    (o: CreateRecurringExpenseDto) => o.reminderEnabled === true,
  )
  @IsEnum(ReminderOffset, {
    message: 'reminderOffset debe ser SAME_DAY o ONE_DAY_BEFORE',
  })
  @IsNotEmpty({ message: 'El offset del recordatorio es obligatorio' })
  reminderOffset?: ReminderOffset;

  @ApiPropertyOptional({
    example: 8,
    description: 'Hora del recordatorio (0-23). Obligatorio si reminderEnabled',
  })
  @ValidateIf(
    (o: CreateRecurringExpenseDto) =>
      o.reminderEnabled === true || o.reminderHour !== undefined,
  )
  @Type(() => Number)
  @IsInt({ message: 'La hora del recordatorio debe ser un entero' })
  @Min(0, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  @Max(23, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  @IsNotEmpty({ message: 'La hora del recordatorio es obligatoria' })
  reminderHour?: number;
}
