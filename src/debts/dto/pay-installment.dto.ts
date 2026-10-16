import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PayDebtInstallmentDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID de la cuenta de la que sale el dinero al pagar (UUID)',
  })
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  accountId: string;

  @ApiPropertyOptional({
    example: 'Deuda Pedro Ruiz (1/3)',
    description: 'Nombre del egreso (por defecto se genera automáticamente)',
    maxLength: 80,
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(80, { message: 'El nombre no puede exceder los 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional({
    example: 'Pago de la primera cuota',
    description: 'Descripción opcional del egreso',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'La descripción no puede exceder los 255 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;
}
