import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ReportRangeQueryDto {
  @ApiProperty({
    example: '2026-10',
    description: 'Periodo inicial del rango (YYYY-MM)',
  })
  @IsString({ message: 'El periodo "from" debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El periodo "from" es obligatorio' })
  @Matches(PERIOD_REGEX, {
    message: 'El periodo "from" debe tener el formato YYYY-MM',
  })
  from: string;

  @ApiProperty({
    example: '2027-01',
    description: 'Periodo final del rango (YYYY-MM)',
  })
  @IsString({ message: 'El periodo "to" debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El periodo "to" es obligatorio' })
  @Matches(PERIOD_REGEX, {
    message: 'El periodo "to" debe tener el formato YYYY-MM',
  })
  to: string;
}
