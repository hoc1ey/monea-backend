import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsISO8601,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ExpensePaymentMethod } from '../expenses.constants.js';

export class QueryExpenseDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Filtrar por ID de la cuenta bancaria (UUID)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  accountId?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Filtrar por ID de la tarjeta de crédito (UUID)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El creditCardId debe ser un UUID válido' })
  creditCardId?: string;

  @ApiPropertyOptional({
    enum: ExpensePaymentMethod,
    description: 'Filtrar por forma de pago (CORRIENTE o DIFERIDO)',
  })
  @IsOptional()
  @IsEnum(ExpensePaymentMethod, {
    message: 'El método de pago debe ser CORRIENTE o DIFERIDO',
  })
  paymentMethod?: ExpensePaymentMethod;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtrar egresos con monto pendiente por definir (recurrentes variables)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value === 'true' || value === true;
  })
  @IsBoolean({ message: 'amountPending debe ser un valor booleano' })
  amountPending?: boolean;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Filtrar egresos a partir de esta fecha (ISO8601)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha "from" debe tener un formato ISO8601 válido' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59.999Z',
    description: 'Filtrar egresos hasta esta fecha (ISO8601)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha "to" debe tener un formato ISO8601 válido' })
  to?: string;
}
