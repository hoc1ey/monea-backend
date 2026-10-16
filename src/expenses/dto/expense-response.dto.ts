import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from '../expenses.constants.js';

export class ExpenseInstallmentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  expenseId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  creditCardId: string;

  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ example: 41666.75 })
  amount: number;

  @ApiProperty({ example: '2026-11' })
  period: string;

  @ApiProperty({ example: false })
  isPaid: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  cardPaymentId: string | null;
}

export class ExpenseResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  accountId: string;

  @ApiProperty({ example: 'Compra de supermercado' })
  name: string;

  @ApiProperty({ example: 250000.5 })
  amount: number;

  @ApiPropertyOptional({ example: 'Mercado de la semana', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  date: Date;

  @ApiProperty({
    enum: ExpensePaymentMethod,
    example: ExpensePaymentMethod.CORRIENTE,
  })
  paymentMethod: ExpensePaymentMethod;

  @ApiPropertyOptional({ example: null, nullable: true })
  creditCardId: string | null;

  @ApiPropertyOptional({ example: 6, nullable: true })
  installments: number | null;

  @ApiProperty({ example: 0 })
  graceMonths: number;

  @ApiProperty({ example: false })
  amountPending: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  recurringConfigId: string | null;

  @ApiProperty({
    enum: ExpenseSourceType,
    example: ExpenseSourceType.MANUAL,
  })
  sourceType: ExpenseSourceType;

  @ApiPropertyOptional({ example: null, nullable: true })
  sourceId: string | null;

  @ApiPropertyOptional({
    type: [ExpenseInstallmentResponseDto],
    description: 'Plan de cuotas del egreso (presente solo en egresos diferidos)',
  })
  installmentPlan?: ExpenseInstallmentResponseDto[];

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class PaginatedExpenseResponseDto {
  @ApiProperty({ type: [ExpenseResponseDto] })
  items: ExpenseResponseDto[];

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
