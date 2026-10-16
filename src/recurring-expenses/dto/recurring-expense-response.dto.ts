import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { ReminderOffset } from '../recurring-expenses.constants.js';

export class RecurringExpenseConfigResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  accountId: string;

  @ApiProperty({ example: 'Gimnasio semanal' })
  name: string;

  @ApiPropertyOptional({ example: 10, nullable: true })
  amount: number | null;

  @ApiProperty({ example: false })
  isVariableAmount: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  description: string | null;

  @ApiProperty({ enum: RecurrenceFrequency, example: RecurrenceFrequency.WEEKLY })
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({ example: 1, nullable: true })
  dayOfWeek: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  dayOfMonth: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  monthOfYear: number | null;

  @ApiProperty({ example: '2026-10-09' })
  startDate: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  endDate: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-10-12T05:00:00.000Z' })
  nextRunAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  lastGeneratedAt: Date | null;

  @ApiProperty({ example: true })
  reminderEnabled: boolean;

  @ApiPropertyOptional({
    enum: ReminderOffset,
    example: ReminderOffset.ONE_DAY_BEFORE,
    nullable: true,
  })
  reminderOffset: ReminderOffset | null;

  @ApiPropertyOptional({ example: 8, nullable: true })
  reminderHour: number | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}
