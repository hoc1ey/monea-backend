import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { IsPriceOrTotalExclusive } from '../validators/price-or-total-exclusive.validator.js';

export class ClosePurchasedItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID('4', { message: 'El id del ítem debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El id del ítem es obligatorio' })
  id: string;

  @ApiPropertyOptional({
    example: 1.25,
    description: 'Precio del ítem (opción A; no enviar si se envía total)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El precio debe ser mayor que 0' })
  price?: number;
}

export class CloseNotPurchasedItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID('4', { message: 'El id del ítem debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El id del ítem es obligatorio' })
  id: string;
}

export class CloseShoppingListDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Cuenta sobre la que se registra el egreso',
  })
  @IsString({ message: 'accountId debe ser una cadena de texto' })
  @IsUUID('4', { message: 'accountId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'accountId es obligatorio' })
  accountId: string;

  @ApiProperty({
    type: [ClosePurchasedItemDto],
    description: 'Ítems comprados; con `price` por ítem (opción A) o sin él (opción B)',
  })
  @IsArray({ message: 'purchasedItems debe ser un arreglo' })
  @ArrayNotEmpty({
    message: 'Debe haber al menos un ítem comprado para cerrar la lista',
  })
  @ValidateNested({ each: true })
  @Type(() => ClosePurchasedItemDto)
  @IsPriceOrTotalExclusive()
  purchasedItems: ClosePurchasedItemDto[];

  @ApiPropertyOptional({
    type: [CloseNotPurchasedItemDto],
    description: 'Ítems no comprados que pasarán a una nueva lista',
  })
  @IsOptional()
  @IsArray({ message: 'notPurchasedItems debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => CloseNotPurchasedItemDto)
  notPurchasedItems?: CloseNotPurchasedItemDto[];

  @ApiPropertyOptional({
    example: 10,
    description: 'Total de la compra (opción B; no enviar si se envían precios)',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El total debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'El total debe ser mayor que 0' })
  total?: number | null;
}
