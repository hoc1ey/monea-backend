import { ApiProperty } from '@nestjs/swagger';

export class MonthlySummaryResponseDto {
  @ApiProperty({ example: '2026-11', description: 'Periodo mensual (YYYY-MM, UTC)' })
  period: string;

  @ApiProperty({ example: 3200.5, description: 'Sumatoria de ingresos del mes' })
  totalIncomes: number;

  @ApiProperty({
    example: 1275.25,
    description: 'Sumatoria de egresos del mes (incluye egresos diferidos)',
  })
  totalExpenses: number;

  @ApiProperty({ example: 1925.25, description: 'Ingresos − egresos del mes' })
  net: number;
}

export class MonthlyHistoryResponseDto {
  @ApiProperty({
    type: [MonthlySummaryResponseDto],
    description: 'Mes actual + 4 meses anteriores, ordenados del más antiguo al más reciente',
  })
  items: MonthlySummaryResponseDto[];
}

export class BalanceItemDto {
  @ApiProperty({ example: '2026-11', description: 'Periodo mensual (YYYY-MM, UTC)' })
  period: string;

  @ApiProperty({
    example: 5420.75,
    description:
      'Saldo general al cierre del mes (saldos iniciales + ingresos − egresos CORRIENTE acumulados)',
  })
  balance: number;
}

export class BalanceHistoryResponseDto {
  @ApiProperty({
    type: [BalanceItemDto],
    description: 'Mes actual + 4 meses anteriores, ordenados del más antiguo al más reciente',
  })
  items: BalanceItemDto[];
}
