import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DebtStatus } from '../debts.constants.js';

export class QueryDebtDto {
  @ApiPropertyOptional({
    enum: DebtStatus,
    example: DebtStatus.PENDING,
    description: 'Filtrar por estado de la deuda',
  })
  @IsOptional()
  @IsEnum(DebtStatus, {
    message: 'El estado debe ser PENDING, PARTIAL o PAID',
  })
  status?: DebtStatus;
}
