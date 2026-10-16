import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateShoppingListItemDto {
  @ApiPropertyOptional({ example: 'Café molido', maxLength: 120 })
  @IsOptional()
  @IsString({ message: 'El nombre del ítem debe ser una cadena de texto' })
  @MaxLength(120, {
    message: 'El nombre del ítem no puede exceder los 120 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional({ example: 1.25, description: 'Precio del ítem' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El precio debe ser mayor que 0' })
  price?: number;
}
