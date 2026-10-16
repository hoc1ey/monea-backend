import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShoppingListDto {
  @ApiPropertyOptional({ example: 'Compras semanales', maxLength: 80 })
  @IsOptional()
  @IsString({ message: 'El nombre de la lista debe ser una cadena de texto' })
  @MaxLength(80, {
    message: 'El nombre de la lista no puede exceder los 80 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;
}
