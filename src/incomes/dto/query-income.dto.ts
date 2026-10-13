import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsISO8601 } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class QueryIncomeDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Filtrar por ID de la cuenta bancaria (UUID)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  accountId?: string;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Filtrar ingresos a partir de esta fecha (ISO8601)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha "from" debe tener un formato ISO8601 válido' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59.999Z',
    description: 'Filtrar ingresos hasta esta fecha (ISO8601)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha "to" debe tener un formato ISO8601 válido' })
  to?: string;
}
