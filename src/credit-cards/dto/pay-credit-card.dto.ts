import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class PayCreditCardDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Cuenta bancaria desde la que sale el dinero (UUID)',
  })
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'La cuenta de origen es obligatoria' })
  accountId: string;

  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Periodo a pagar (YYYY-MM). Por defecto, el mes actual',
  })
  @IsOptional()
  @IsString({ message: 'El periodo debe ser una cadena de texto' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El periodo debe tener el formato YYYY-MM',
  })
  period?: string;
}
