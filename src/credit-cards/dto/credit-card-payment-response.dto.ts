import { ApiProperty } from '@nestjs/swagger';

export class CreditCardPaymentResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  creditCardId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  accountId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  expenseId: string;

  @ApiProperty({ example: '2026-10' })
  period: string;

  @ApiProperty({ example: 300 })
  amount: number;

  @ApiProperty({ example: '2026-10-09T14:00:00.000Z' })
  paidAt: Date;

  @ApiProperty({ example: '2026-10-09T15:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-09T15:30:00.000Z' })
  updatedAt: Date;
}
