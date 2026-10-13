import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncomeSourceType } from '../incomes.constants.js';

export class IncomeResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  accountId: string;

  @ApiProperty({ example: 'Salario quincenal' })
  name: string;

  @ApiProperty({ example: 1850.5 })
  amount: number;

  @ApiPropertyOptional({ example: 'Pago nómina', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  date: Date;

  @ApiProperty({
    enum: IncomeSourceType,
    example: IncomeSourceType.MANUAL,
  })
  sourceType: IncomeSourceType;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'ID de la entidad origen si proviene de cobro o préstamo',
  })
  sourceId: string | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class PaginatedIncomeResponseDto {
  @ApiProperty({ type: [IncomeResponseDto] })
  items: IncomeResponseDto[];

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}
