import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';
import { SendTestEmailDto } from './dto/send-test-email.dto.js';

@ApiTags('Mail')
@ApiBearerAuth()
@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Envia un correo de prueba si el correo del body coincide con el usuario autenticado',
  })
  async sendTestEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: SendTestEmailDto,
  ) {
    const user = await this.usersService.findById(userId);
    const requestedEmail = dto.email.toLowerCase().trim();

    if (user.email !== requestedEmail) {
      throw new NotFoundException(
        'El correo no coincide con el registrado en la base de datos',
      );
    }

    await this.mailService.sendTestEmail({
      to: user.email,
      name: user.name,
    });

    return {
      data: { email: user.email, sentAt: new Date().toISOString() },
      message: 'Correo de prueba enviado correctamente',
    };
  }
}
