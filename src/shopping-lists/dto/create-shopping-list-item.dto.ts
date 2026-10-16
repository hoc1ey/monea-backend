import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateShoppingListItemDto {
  @ApiProperty({
    example: 'Leche',
    description: 'Nombre del ítem',
    maxLength: 120,
  })
  @IsString({ message: 'El nombre del ítem debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del ítem es obligatorio' })
  @MaxLength(120, {
    message: 'El nombre del ítem no puede exceder los 120 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;
}
