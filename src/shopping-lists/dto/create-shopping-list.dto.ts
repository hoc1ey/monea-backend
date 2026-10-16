import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateShoppingListItemDto } from './create-shopping-list-item.dto.js';

export class CreateShoppingListDto {
  @ApiProperty({
    example: 'Compras semana',
    description: 'Nombre de la lista',
    maxLength: 80,
  })
  @IsString({ message: 'El nombre de la lista debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la lista es obligatorio' })
  @MaxLength(80, {
    message: 'El nombre de la lista no puede exceder los 80 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiPropertyOptional({
    type: [CreateShoppingListItemDto],
    description: 'Ítems iniciales de la lista',
  })
  @IsOptional()
  @IsArray({ message: 'Los ítems deben ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => CreateShoppingListItemDto)
  items?: CreateShoppingListItemDto[];
}
