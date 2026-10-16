import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ReportQueryDto {
  @ApiProperty({
    example: '2026-10',
    description: 'Periodo mensual a consultar (YYYY-MM)',
  })
  @IsString({ message: 'El periodo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El periodo es obligatorio' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'El periodo debe tener el formato YYYY-MM',
  })
  period: string;
}
