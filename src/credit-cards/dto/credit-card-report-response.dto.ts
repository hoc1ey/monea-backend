import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreditCardReportItemDto {
  @ApiProperty({ example: 'Laptop' })
  name: string;

  @ApiProperty({ example: 1 })
  installmentNumber: number;

  @ApiProperty({ example: 3 })
  installmentsTotal: number;

  @ApiProperty({ example: 300 })
  amount: number;
}

export class CreditCardMonthlyReportResponseDto {
  @ApiProperty({ example: '2026-10' })
  period: string;

  @ApiProperty({ example: 300 })
  total: number;

  @ApiProperty({ example: false })
  paid: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: '2026-10-20', nullable: true })
  cutoffDate: string | null;

  @ApiPropertyOptional({ example: '2026-11-05', nullable: true })
  paymentDate: string | null;

  @ApiProperty({ type: [CreditCardReportItemDto] })
  items: CreditCardReportItemDto[];
}

export class CreditCardRangeMonthDto {
  @ApiProperty({ example: '2026-10' })
  period: string;

  @ApiProperty({ example: 300 })
  total: number;

  @ApiProperty({ example: false })
  paid: boolean;
}

export class CreditCardRangeReportResponseDto {
  @ApiProperty({ type: [CreditCardRangeMonthDto] })
  months: CreditCardRangeMonthDto[];

  @ApiProperty({ example: 1060 })
  grandTotal: number;
}
