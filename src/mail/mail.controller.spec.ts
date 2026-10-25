import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MailController } from './mail.controller.js';
import { MailService } from './mail.service.js';
import { UsersService } from '../users/users.service.js';
import { SendTestEmailDto } from './dto/send-test-email.dto.js';

describe('MailController', () => {
  let controller: MailController;
  let mockMailService: Partial<MailService>;
  let mockUsersService: Partial<UsersService>;

  beforeEach(() => {
    mockMailService = {
      sendTestEmail: vi.fn(),
    };

    mockUsersService = {
      findById: vi.fn(),
    };

    controller = new MailController(
      mockMailService as MailService,
      mockUsersService as UsersService,
    );
  });

  it('envia el correo de prueba cuando el correo del body coincide con el registrado', async () => {
    vi.mocked(mockUsersService.findById!).mockResolvedValue({
      id: 'user-1',
      email: 'test@monea.com',
      name: 'Test',
    } as any);

    const dto: SendTestEmailDto = { email: 'test@monea.com' };
    const result = await controller.sendTestEmail('user-1', dto);

    expect(mockUsersService.findById).toHaveBeenCalledWith('user-1');
    expect(mockMailService.sendTestEmail).toHaveBeenCalledTimes(1);
    expect(mockMailService.sendTestEmail).toHaveBeenCalledWith({
      to: 'test@monea.com',
      name: 'Test',
    });
    expect(result.message).toBe('Correo de prueba enviado correctamente');
    expect(result.data.email).toBe('test@monea.com');
  });

  it('normaliza el correo comparado (mayusculas y espacios)', async () => {
    vi.mocked(mockUsersService.findById!).mockResolvedValue({
      id: 'user-1',
      email: 'test@monea.com',
      name: 'Test',
    } as any);

    await controller.sendTestEmail('user-1', {
      email: '  TEST@monea.com ',
    });

    expect(mockMailService.sendTestEmail).toHaveBeenCalledWith({
      to: 'test@monea.com',
      name: 'Test',
    });
  });

  it('lanza NotFoundException cuando el correo no coincide con el registrado', async () => {
    vi.mocked(mockUsersService.findById!).mockResolvedValue({
      id: 'user-1',
      email: 'test@monea.com',
      name: 'Test',
    } as any);

    await expect(
      controller.sendTestEmail('user-1', { email: 'otra@monea.com' }),
    ).rejects.toThrow(NotFoundException);

    expect(mockMailService.sendTestEmail).not.toHaveBeenCalled();
  });
});
