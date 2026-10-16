import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class SetRecurringExpenseActiveDto {
  @ApiProperty({
    example: false,
    description: 'Activa (true) o desactiva (false) la configuración',
  })
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  @IsNotEmpty({ message: 'isActive es obligatorio' })
  isActive: boolean;
}
