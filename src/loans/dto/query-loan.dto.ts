import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { LoanStatus } from '../loans.constants.js';

export class QueryLoanDto {
  @ApiPropertyOptional({
    enum: LoanStatus,
    example: LoanStatus.PENDING,
    description: 'Filtrar por estado del préstamo',
  })
  @IsOptional()
  @IsEnum(LoanStatus, {
    message: 'El estado debe ser PENDING, PARTIAL o PAID',
  })
  status?: LoanStatus;
}
