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
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';

export class CreateCollectionDto {
  @ApiProperty({
    example: 'Carlos Pérez',
    description: 'Nombre de la persona que te debe el dinero',
    maxLength: 80,
  })
  @IsString({ message: 'El nombre de la persona debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la persona es obligatorio' })
  @MaxLength(80, {
    message: 'El nombre de la persona no puede exceder los 80 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  personName: string;

  @ApiProperty({
    example: 100,
    description: 'Monto total a cobrar (positivo con máximo 2 decimales)',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto total debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El monto total debe ser mayor que 0' })
  @IsNotEmpty({ message: 'El monto total es obligatorio' })
  totalAmount: number;

  @ApiProperty({
    example: 3,
    description: 'Número de cuotas (mínimo 1)',
  })
  @Type(() => Number)
  @IsInt({ message: 'El número de cuotas debe ser un entero' })
  @Min(1, { message: 'El número de cuotas debe ser mayor o igual a 1' })
  @IsNotEmpty({ message: 'El número de cuotas es obligatorio' })
  installmentsCount: number;

  @ApiPropertyOptional({
    example: 'Préstamo de almuerzo',
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

  @ApiPropertyOptional({
    example: true,
    description: 'Activa los recordatorios del plan de cuotas',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'reminderEnabled debe ser un valor booleano' })
  reminderEnabled?: boolean = false;

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.MONTHLY,
    description:
      'Frecuencia del recordatorio. Obligatoria cuando hay más de una cuota con recordatorio',
  })
  @ValidateIf(
    (o: CreateCollectionDto) =>
      o.installmentsCount > 1 && o.reminderEnabled === true,
  )
  @IsEnum(RecurrenceFrequency, {
    message: 'La frecuencia debe ser WEEKLY, MONTHLY o YEARLY',
  })
  @IsNotEmpty({
    message: 'La frecuencia del recordatorio es obligatoria para varias cuotas',
  })
  reminderFrequency?: RecurrenceFrequency;

  @ApiPropertyOptional({
    example: 1,
    description: 'Día de la semana (1=Lunes ... 7=Domingo). Obligatorio si WEEKLY',
  })
  @ValidateIf(
    (o: CreateCollectionDto) =>
      o.installmentsCount > 1 &&
      o.reminderEnabled === true &&
      o.reminderFrequency === RecurrenceFrequency.WEEKLY,
  )
  @Type(() => Number)
  @IsInt({ message: 'El día de la semana debe ser un entero' })
  @Min(1, { message: 'El día de la semana debe estar entre 1 y 7' })
  @Max(7, { message: 'El día de la semana debe estar entre 1 y 7' })
  @IsNotEmpty({ message: 'El día de la semana es obligatorio para WEEKLY' })
  reminderDayOfWeek?: number;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Día del mes (1-31). Obligatorio si MONTHLY; opcional si YEARLY',
  })
  @ValidateIf(
    (o: CreateCollectionDto) =>
      o.installmentsCount > 1 &&
      o.reminderEnabled === true &&
      (o.reminderFrequency === RecurrenceFrequency.MONTHLY ||
        o.reminderDayOfMonth !== undefined),
  )
  @Type(() => Number)
  @IsInt({ message: 'El día del mes debe ser un entero' })
  @Min(1, { message: 'El día del mes debe estar entre 1 y 31' })
  @Max(31, { message: 'El día del mes debe estar entre 1 y 31' })
  @IsNotEmpty({ message: 'El día del mes es obligatorio para MONTHLY' })
  reminderDayOfMonth?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Mes del año (1-12). Obligatorio si YEARLY',
  })
  @ValidateIf(
    (o: CreateCollectionDto) =>
      o.installmentsCount > 1 &&
      o.reminderEnabled === true &&
      o.reminderFrequency === RecurrenceFrequency.YEARLY,
  )
  @Type(() => Number)
  @IsInt({ message: 'El mes del año debe ser un entero' })
  @Min(1, { message: 'El mes del año debe estar entre 1 y 12' })
  @Max(12, { message: 'El mes del año debe estar entre 1 y 12' })
  @IsNotEmpty({ message: 'El mes del año es obligatorio para YEARLY' })
  reminderMonth?: number;

  @ApiPropertyOptional({
    example: '2026-12-01T14:00:00.000Z',
    description:
      'Fecha y hora del recordatorio para una cuota única (solo hora, minutos = 0)',
  })
  @ValidateIf(
    (o: CreateCollectionDto) =>
      o.installmentsCount === 1 && o.reminderEnabled === true,
  )
  @IsISO8601({}, { message: 'reminderAt debe tener un formato ISO8601 válido' })
  @IsNotEmpty({
    message: 'reminderAt es obligatorio para una cuota única con recordatorio',
  })
  reminderAt?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Hora del recordatorio (0-23). Obligatoria con recordatorio',
  })
  @ValidateIf(
    (o: CreateCollectionDto) =>
      o.installmentsCount > 1 && o.reminderEnabled === true,
  )
  @Type(() => Number)
  @IsInt({ message: 'La hora del recordatorio debe ser un entero' })
  @Min(0, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  @Max(23, { message: 'La hora del recordatorio debe estar entre 0 y 23' })
  @IsNotEmpty({ message: 'La hora del recordatorio es obligatoria' })
  reminderHour?: number;
}
