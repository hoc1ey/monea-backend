import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsNumber,
  IsPositive,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCreditCardDto {
  @ApiProperty({
    example: 'Visa Platinum Bancolombia',
    description: 'Nombre o alias de la tarjeta de crédito',
    maxLength: 60,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la tarjeta es obligatorio' })
  @MaxLength(60, { message: 'El nombre no puede exceder los 60 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiProperty({
    example: '#1E40AF',
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
    example: 'Bancolombia',
    description: 'Entidad emisora de la tarjeta',
    maxLength: 80,
  })
  @IsString({ message: 'La entidad emisora debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La entidad emisora es obligatoria' })
  @MaxLength(80, { message: 'La entidad emisora no puede exceder los 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  issuer: string;

  @ApiProperty({
    example: '4321',
    description: 'Últimos 4 dígitos del número de la tarjeta',
  })
  @IsString({ message: 'Los últimos 4 dígitos deben ser una cadena de texto' })
  @IsNotEmpty({ message: 'Los últimos 4 dígitos son obligatorios' })
  @Matches(/^\d{4}$/, {
    message: 'Los últimos 4 dígitos deben contener exactamente 4 dígitos numéricos',
  })
  lastFourDigits: string;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Cupo o límite de crédito asignado (máx. 2 decimales)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El cupo de crédito debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El cupo de crédito debe ser mayor que 0' })
  creditLimit?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Día de corte mensual de la tarjeta (1-31)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día de corte debe ser un número entero' })
  @Min(1, { message: 'El día de corte debe estar entre 1 y 31' })
  @Max(31, { message: 'El día de corte debe estar entre 1 y 31' })
  cutoffDay?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Día límite de pago mensual de la tarjeta (1-31)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día de pago debe ser un número entero' })
  @Min(1, { message: 'El día de pago debe estar entre 1 y 31' })
  @Max(31, { message: 'El día de pago debe estar entre 1 y 31' })
  paymentDay?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el recordatorio de pago está activo',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'reminderEnabled debe ser un valor booleano' })
  reminderEnabled?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: 'Días de anticipación para el recordatorio de pago (mínimo 0)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reminderDaysBefore debe ser un número entero' })
  @Min(0, { message: 'reminderDaysBefore no puede ser negativo' })
  @Max(30, { message: 'reminderDaysBefore no puede superar 30 días' })
  reminderDaysBefore?: number;

  @ApiPropertyOptional({
    example: 9,
    description: 'Hora del día (0-23) para enviar el recordatorio en la zona del usuario',
    default: 9,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reminderHour debe ser un número entero' })
  @Min(0, { message: 'reminderHour debe estar entre 0 y 23' })
  @Max(23, { message: 'reminderHour debe estar entre 0 y 23' })
  reminderHour?: number;
}
