import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CollectionStatus } from '../collections.constants.js';

export class QueryCollectionDto {
  @ApiPropertyOptional({
    enum: CollectionStatus,
    example: CollectionStatus.PENDING,
    description: 'Filtrar por estado del cobro',
  })
  @IsOptional()
  @IsEnum(CollectionStatus, {
    message: 'El estado debe ser PENDING, PARTIAL o PAID',
  })
  status?: CollectionStatus;
}
