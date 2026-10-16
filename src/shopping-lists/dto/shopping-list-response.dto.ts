import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShoppingListStatus } from '../shopping-lists.constants.js';

export class ShoppingListItemResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  listId: string;

  @ApiProperty({ example: 'Leche' })
  name: string;

  @ApiProperty({ example: false })
  isPurchased: boolean;

  @ApiPropertyOptional({ example: 1.25, nullable: true })
  price: number | null;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class ShoppingListResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({ example: 'Compras semana' })
  name: string;

  @ApiProperty({ enum: ShoppingListStatus, example: ShoppingListStatus.OPEN })
  status: ShoppingListStatus;

  @ApiPropertyOptional({ example: null, nullable: true })
  closedAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  total: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  accountId: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  expenseId: string | null;

  @ApiPropertyOptional({ type: [ShoppingListItemResponseDto] })
  items?: ShoppingListItemResponseDto[];

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  updatedAt: Date;
}

export class CloseShoppingListResponseDto {
  @ApiProperty({ type: ShoppingListResponseDto })
  closedList: ShoppingListResponseDto;

  @ApiPropertyOptional({ type: ShoppingListResponseDto, nullable: true })
  newList: ShoppingListResponseDto | null;
}
