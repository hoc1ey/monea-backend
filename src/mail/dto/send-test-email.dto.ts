import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendTestEmailDto {
  @ApiProperty({
    example: 'usuario@monea.com',
    description: 'Correo registrado del usuario autenticado',
  })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;
}
