import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EmailDto } from './email.dto.js';

export class VerifyEmailDto extends EmailDto {
  @ApiProperty({ example: '123456', description: 'Código de verificación de 6 dígitos' })
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @Matches(/^\d{6}$/, { message: 'El código debe tener exactamente 6 dígitos' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  code: string;
}
