import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  IsISO8601,
  IsEnum,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExpensePaymentMethod } from '../expenses.constants.js';

export class CreateExpenseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta bancaria asociada al egreso (UUID)',
  })
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  accountId: string;

  @ApiProperty({
    example: 'Compra de supermercado',
    description: 'Nombre o concepto del egreso',
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
    example: 250000.5,
    description: 'Monto del egreso (positivo con máximo 2 decimales)',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'El monto no puede ser negativo' })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Mercado de la semana',
    description: 'Descripción o notas opcionales del egreso',
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
    example: '2026-10-15T12:00:00.000Z',
    description: 'Fecha del egreso en formato ISO8601 (por defecto fecha actual)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha debe tener un formato ISO8601 válido' })
  date?: string;

  @ApiPropertyOptional({
    enum: ExpensePaymentMethod,
    example: ExpensePaymentMethod.CORRIENTE,
    description: 'Forma de pago del egreso',
    default: ExpensePaymentMethod.CORRIENTE,
  })
  @IsOptional()
  @IsEnum(ExpensePaymentMethod, {
    message: 'El método de pago debe ser CORRIENTE o DIFERIDO',
  })
  paymentMethod?: ExpensePaymentMethod = ExpensePaymentMethod.CORRIENTE;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la tarjeta de crédito (obligatorio si es DIFERIDO)',
  })
  @ValidateIf(
    (o: CreateExpenseDto) => o.paymentMethod === ExpensePaymentMethod.DIFERIDO,
  )
  @IsUUID('4', { message: 'El creditCardId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La tarjeta es obligatoria para egresos diferidos' })
  creditCardId?: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'Número de cuotas (obligatorio y >= 1 si es DIFERIDO)',
  })
  @ValidateIf(
    (o: CreateExpenseDto) => o.paymentMethod === ExpensePaymentMethod.DIFERIDO,
  )
  @Type(() => Number)
  @IsInt({ message: 'El número de cuotas debe ser un entero' })
  @Min(1, { message: 'El número de cuotas debe ser al menos 1' })
  installments?: number;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Meses de gracia antes de la primera cuota (solo DIFERIDO, default 0)',
    default: 0,
  })
  @ValidateIf(
    (o: CreateExpenseDto) => o.paymentMethod === ExpensePaymentMethod.DIFERIDO,
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los meses de gracia deben ser un entero' })
  @Min(0, { message: 'Los meses de gracia no pueden ser negativos' })
  graceMonths?: number;
}
