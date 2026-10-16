import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { CollectionStatus } from '../collections.constants.js';

export class CollectionInstallmentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ example: 33.33 })
  amount: number;

  @ApiPropertyOptional({ example: '2026-10-15T15:00:00.000Z', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: false })
  isPaid: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  incomeId: string | null;
}

export class CollectionResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'Carlos Pérez' })
  personName: string;

  @ApiProperty({ example: 100 })
  totalAmount: number;

  @ApiProperty({ example: 3 })
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

  @ApiPropertyOptional({ example: 15, nullable: true })
  reminderDayOfMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reminderAt: Date | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  reminderHour: number | null;

  @ApiProperty({ enum: CollectionStatus, example: CollectionStatus.PENDING })
  status: CollectionStatus;

  @ApiPropertyOptional({ example: 0 })
  paidAmount?: number;

  @ApiPropertyOptional({ example: 100 })
  pendingAmount?: number;

  @ApiPropertyOptional({ type: [CollectionInstallmentResponseDto] })
  installments?: CollectionInstallmentResponseDto[];

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class PayCollectionInstallmentResponseDto {
  @ApiProperty({ type: CollectionInstallmentResponseDto })
  installment: CollectionInstallmentResponseDto;

  @ApiProperty({ enum: CollectionStatus, example: CollectionStatus.PARTIAL })
  collectionStatus: CollectionStatus;
}
