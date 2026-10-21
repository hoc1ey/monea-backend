import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ReminderService } from './reminder.service.js';
import { DevicePlatform } from './notifications.constants.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockNotificationsService: Partial<NotificationsService>;
  let mockReminderService: Partial<ReminderService>;

  beforeEach(() => {
    mockNotificationsService = {
      registerDevice: vi.fn(),
      unregisterDevice: vi.fn(),
      sendTestNotification: vi.fn(),
    };

    mockReminderService = {
      findUpcoming: vi.fn(),
    };

    controller = new NotificationsController(
      mockNotificationsService as NotificationsService,
      mockReminderService as ReminderService,
    );
  });

  it('registerDevice debe invocar notificationsService.registerDevice con userId y dto', async () => {
    const dto = { token: 'fcm-123', platform: DevicePlatform.ANDROID };
    vi.mocked(mockNotificationsService.registerDevice!).mockResolvedValue({
      id: 'dev-1',
      token: 'fcm-123',
    } as any);

    const result = await controller.registerDevice('user-1', dto);

    expect(result.message).toBe('Dispositivo registrado correctamente');
    expect(mockNotificationsService.registerDevice).toHaveBeenCalledWith(
      'user-1',
      'fcm-123',
      DevicePlatform.ANDROID,
    );
  });

  it('unregisterDevice debe invocar notificationsService.unregisterDevice con userId y token', async () => {
    vi.mocked(mockNotificationsService.unregisterDevice!).mockResolvedValue();

    const result = await controller.unregisterDevice('user-1', 'fcm-123');

    expect(result.message).toBe('Dispositivo desactivado correctamente');
    expect(mockNotificationsService.unregisterDevice).toHaveBeenCalledWith(
      'user-1',
      'fcm-123',
    );
  });

  it('sendTestNotification debe invocar notificationsService.sendTestNotification con userId', async () => {
    const counts = { sentCount: 2, failureCount: 0 };
    vi.mocked(mockNotificationsService.sendTestNotification!).mockResolvedValue(
      counts,
    );

    const result = await controller.sendTestNotification('user-1');

    expect(result.message).toBe('Notificación de prueba enviada');
    expect(result.data).toEqual(counts);
    expect(
      mockNotificationsService.sendTestNotification,
    ).toHaveBeenCalledWith('user-1');
  });

  it('getUpcomingReminders debe invocar reminderService.findUpcoming con userId', async () => {
    const reminders = [{ id: 'rem-1' }] as any;
    vi.mocked(mockReminderService.findUpcoming!).mockResolvedValue(reminders);

    const result = await controller.getUpcomingReminders('user-1');

    expect(result.message).toBe('Recordatorios obtenidos correctamente');
    expect(result.data).toBe(reminders);
    expect(mockReminderService.findUpcoming).toHaveBeenCalledWith('user-1');
  });
});
