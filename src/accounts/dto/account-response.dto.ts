import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'Bancolombia Ahorros' })
  name: string;

  @ApiProperty({ example: 'Bancolombia' })
  financialInstitution: string;

  @ApiProperty({ example: '#3B82F6' })
  color: string;

  @ApiProperty({ example: 1500000.5 })
  initialBalance: number;

  @ApiProperty({
    example: 1750000.5,
    description: 'Saldo actual calculado a partir de movimientos',
  })
  currentBalance: number;

  @ApiPropertyOptional({ example: 'Cuenta principal', nullable: true })
  description: string | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  updatedAt: Date;
}
