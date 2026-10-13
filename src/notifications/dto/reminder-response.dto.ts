import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReminderType,
  ReminderStatus,
} from '../notifications.constants.js';

export class ReminderResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({
    enum: ReminderType,
    example: ReminderType.CREDIT_CARD_PAYMENT,
  })
  type: ReminderType;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la entidad origen que generó el recordatorio',
  })
  sourceId: string;

  @ApiProperty({ example: 'Recordatorio de pago de tarjeta' })
  title: string;

  @ApiProperty({ example: 'Tu tarjeta vence en 1 día. Monto a pagar: $250.00' })
  body: string;

  @ApiProperty({ example: '2026-10-15T14:00:00.000Z' })
  scheduledAt: Date;

  @ApiProperty({ enum: ReminderStatus, example: ReminderStatus.PENDING })
  status: ReminderStatus;

  @ApiProperty({ example: 0 })
  attempts: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  sentAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  lastError: string | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  updatedAt: Date;
}
