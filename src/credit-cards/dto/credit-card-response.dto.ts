import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreditCardResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'Visa Platinum Bancolombia' })
  name: string;

  @ApiProperty({ example: '#1E40AF' })
  color: string;

  @ApiProperty({ example: 'Bancolombia' })
  issuer: string;

  @ApiProperty({ example: '4321' })
  lastFourDigits: string;

  @ApiPropertyOptional({ example: 5000000, nullable: true })
  creditLimit: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true })
  cutoffDay: number | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  paymentDay: number | null;

  @ApiProperty({ example: true })
  reminderEnabled: boolean;

  @ApiProperty({ example: 1 })
  reminderDaysBefore: number;

  @ApiProperty({ example: 9 })
  reminderHour: number;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  updatedAt: Date;
}
