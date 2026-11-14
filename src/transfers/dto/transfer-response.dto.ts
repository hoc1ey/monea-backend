import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta origen',
  })
  sourceAccountId: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'ID de la cuenta destino',
  })
  destinationAccountId: string;

  @ApiProperty({ example: 500 })
  amount: number;

  @ApiPropertyOptional({ example: 'Pago del alquiler', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-11-13T12:00:00.000Z' })
  date: Date;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
    description: 'ID del egreso creado en la cuenta origen',
  })
  expenseId: string | null;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
    description: 'ID del ingreso creado en la cuenta destino',
  })
  incomeId: string | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-11-13T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-11-13T12:00:00.000Z' })
  updatedAt: Date;
}

export class PaginatedTransferResponseDto {
  @ApiProperty({ type: [TransferResponseDto] })
  items: TransferResponseDto[];

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
