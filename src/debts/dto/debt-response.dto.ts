import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { DebtStatus } from '../debts.constants.js';

export class DebtInstallmentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ example: 30 })
  amount: number;

  @ApiPropertyOptional({ example: '2026-10-14T23:00:00.000Z', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: false })
  isPaid: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  expenseId: string | null;
}

export class DebtResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'Pedro Ruiz' })
  personName: string;

  @ApiProperty({ example: 90 })
  totalAmount: number;

  @ApiProperty({ example: 3 })
  installmentsCount: number;

  @ApiProperty({ example: true })
  reminderEnabled: boolean;

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.WEEKLY,
    nullable: true,
  })
  reminderFrequency: RecurrenceFrequency | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  reminderDayOfWeek: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderDayOfMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderAt: Date | null;

  @ApiPropertyOptional({ example: 18, nullable: true })
  reminderHour: number | null;

  @ApiProperty({ enum: DebtStatus, example: DebtStatus.PENDING })
  status: DebtStatus;

  @ApiPropertyOptional({ example: 0 })
  paidAmount?: number;

  @ApiPropertyOptional({ example: 90 })
  pendingAmount?: number;

  @ApiPropertyOptional({ type: [DebtInstallmentResponseDto] })
  installments?: DebtInstallmentResponseDto[];

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class PayDebtInstallmentResponseDto {
  @ApiProperty({ type: DebtInstallmentResponseDto })
  installment: DebtInstallmentResponseDto;

  @ApiProperty({ enum: DebtStatus, example: DebtStatus.PARTIAL })
  debtStatus: DebtStatus;
}
