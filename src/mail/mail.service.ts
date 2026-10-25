import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import { MAIL_ASSETS_DIR, MAIL_LOGO_CID } from './mail.constants.js';

const LOGO_FILE_NAMES = [
  'logo.png',
  'logo.jpg',
  'logo.jpeg',
  'logo.webp',
  'logo.gif',
];

export interface VerificationEmailParams {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}

export interface TemporaryPasswordEmailParams {
  to: string;
  name: string;
  temporaryPassword: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {
    if (!this.findLogo()) {
      this.logger.warn(
        `No se encontró el logo de la app en ${MAIL_ASSETS_DIR}. Los correos se enviarán sin logo.`,
      );
    }
  }

  async sendVerificationCode({
    to,
    name,
    code,
    expiresInMinutes,
  }: VerificationEmailParams): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Verifica tu correo electrónico - Monea',
      template: 'verification-code',
      context: {
        name,
        code,
        expiresInMinutes,
        year: new Date().getFullYear(),
        hasLogo: this.findLogo() !== null,
        logoCid: MAIL_LOGO_CID,
      },
      attachments: this.buildLogoAttachments(),
    });
  }

  async sendTemporaryPassword({
    to,
    name,
    temporaryPassword,
  }: TemporaryPasswordEmailParams): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Tu contraseña temporal de Monea',
      template: 'temporary-password',
      context: {
        name,
        temporaryPassword,
        year: new Date().getFullYear(),
        hasLogo: this.findLogo() !== null,
        logoCid: MAIL_LOGO_CID,
      },
      attachments: this.buildLogoAttachments(),
    });
  }

  async sendTestEmail({ to, name }: { to: string; name: string }): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Correo de prueba - Monea',
      template: 'test-email',
      context: {
        name,
        year: new Date().getFullYear(),
        hasLogo: this.findLogo() !== null,
        logoCid: MAIL_LOGO_CID,
      },
      attachments: this.buildLogoAttachments(),
    });
  }

  private buildLogoAttachments(): {
    filename: string;
    path: string;
    cid: string;
  }[] {
    const logoPath = this.findLogo();
    if (!logoPath) return [];

    return [
      {
        filename: basename(logoPath),
        path: logoPath,
        cid: MAIL_LOGO_CID,
      },
    ];
  }

  private findLogo(): string | null {
    for (const fileName of LOGO_FILE_NAMES) {
      const filePath = join(MAIL_ASSETS_DIR, fileName);
      if (existsSync(filePath)) return filePath;
    }
    return null;
  }
}
