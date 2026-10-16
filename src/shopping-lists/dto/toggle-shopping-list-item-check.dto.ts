import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleShoppingListItemCheckDto {
  @ApiProperty({ example: true, description: 'Marca o desmarca el ítem' })
  @IsBoolean({ message: 'isPurchased debe ser un valor booleano' })
  @IsNotEmpty({ message: 'isPurchased es obligatorio' })
  isPurchased: boolean;
}
