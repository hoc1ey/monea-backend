import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ShoppingListStatus } from '../shopping-lists.constants.js';

export class QueryShoppingListDto {
  @ApiPropertyOptional({
    enum: ShoppingListStatus,
    example: ShoppingListStatus.OPEN,
    description: 'Filtrar por estado de la lista',
  })
  @IsOptional()
  @IsEnum(ShoppingListStatus, {
    message: 'El estado debe ser OPEN o CLOSED',
  })
  status?: ShoppingListStatus;
}
