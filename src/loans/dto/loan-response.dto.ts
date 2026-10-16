import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { LoanStatus } from '../loans.constants.js';

export class LoanInstallmentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ example: 100 })
  amount: number;

  @ApiPropertyOptional({ example: '2026-10-20T14:00:00.000Z', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: false })
  isPaid: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  incomeId: string | null;
}

export class LoanResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  accountId: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nullable: true })
  expenseId: string | null;

  @ApiProperty({ example: 'María Gómez' })
  personName: string;

  @ApiProperty({ example: 200 })
  totalAmount: number;

  @ApiProperty({ example: 2 })
  installmentsCount: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  description: string | null;

  @ApiProperty({ example: true })
  reminderEnabled: boolean;

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.MONTHLY,
    nullable: true,
  })
  reminderFrequency: RecurrenceFrequency | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderDayOfWeek: number | null;

  @ApiPropertyOptional({ example: 20, nullable: true })
  reminderDayOfMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderAt: Date | null;

  @ApiPropertyOptional({ example: 9, nullable: true })
  reminderHour: number | null;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.PENDING })
  status: LoanStatus;

  @ApiPropertyOptional({ example: 0 })
  paidAmount?: number;

  @ApiPropertyOptional({ example: 200 })
  pendingAmount?: number;

  @ApiPropertyOptional({ type: [LoanInstallmentResponseDto] })
  installments?: LoanInstallmentResponseDto[];

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class PayLoanInstallmentResponseDto {
  @ApiProperty({ type: LoanInstallmentResponseDto })
  installment: LoanInstallmentResponseDto;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.PARTIAL })
  loanStatus: LoanStatus;
}
