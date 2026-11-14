import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryReportDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Filtrar por ID de la cuenta bancaria (UUID). Si se omite, agrega todas las cuentas del usuario',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El accountId debe ser un UUID válido' })
  accountId?: string;
}
