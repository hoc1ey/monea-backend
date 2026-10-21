import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity.js';
import { DevicePlatform } from './notifications.constants.js';
import type { App } from 'firebase-admin/app';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockDeviceRepo: Partial<Repository<DeviceToken>>;
  let mockFirebaseApp: Partial<App>;

  beforeEach(() => {
    mockDeviceRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };

    mockFirebaseApp = {};

    service = new NotificationsService(
      mockDeviceRepo as Repository<DeviceToken>,
      mockFirebaseApp as App,
    );
  });

  describe('registerDevice', () => {
    it('debe crear un nuevo token de dispositivo si no existe', async () => {
      vi.mocked(mockDeviceRepo.findOne!).mockResolvedValue(null);

      const newDevice = {
        id: 'dev-1',
        userId: 'user-1',
        token: 'token-abc',
        platform: DevicePlatform.ANDROID,
        isActive: true,
      } as DeviceToken;

      vi.mocked(mockDeviceRepo.create!).mockReturnValue(newDevice);
      vi.mocked(mockDeviceRepo.save!).mockResolvedValue(newDevice);

      const result = await service.registerDevice('user-1', 'token-abc');

      expect(result.token).toBe('token-abc');
      expect(result.userId).toBe('user-1');
      expect(mockDeviceRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        token: 'token-abc',
        platform: DevicePlatform.ANDROID,
        isActive: true,
        lastUsedAt: expect.any(Date),
      });
    });

    it('debe reasignar el token si ya existía en otro usuario (upsert)', async () => {
      const existing = {
        id: 'dev-1',
        userId: 'user-anterior',
        token: 'token-abc',
        platform: DevicePlatform.ANDROID,
        isActive: false,
        lastUsedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      } as DeviceToken;

      vi.mocked(mockDeviceRepo.findOne!).mockResolvedValue(existing);
      vi.mocked(mockDeviceRepo.save!).mockImplementation(async (d) => d as DeviceToken);

      const result = await service.registerDevice('user-nuevo', 'token-abc');

      expect(result.userId).toBe('user-nuevo');
      expect(result.isActive).toBe(true);
    });
  });

  describe('unregisterDevice', () => {
    it('debe marcar isActive = false en el dispositivo', async () => {
      const device = {
        id: 'dev-1',
        userId: 'user-1',
        token: 'token-abc',
        isActive: true,
      } as DeviceToken;

      vi.mocked(mockDeviceRepo.findOne!).mockResolvedValue(device);
      vi.mocked(mockDeviceRepo.save!).mockImplementation(async (d) => d as DeviceToken);

      await service.unregisterDevice('user-1', 'token-abc');

      expect(device.isActive).toBe(false);
      expect(mockDeviceRepo.save).toHaveBeenCalledWith(device);
    });

    it('debe lanzar NotFoundException si el dispositivo no existe para el usuario', async () => {
      vi.mocked(mockDeviceRepo.findOne!).mockResolvedValue(null);

      await expect(
        service.unregisterDevice('user-1', 'token-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendTestNotification', () => {
    it('debe lanzar NotFoundException si el usuario no tiene dispositivos activos', async () => {
      vi.mocked(mockDeviceRepo.count!).mockResolvedValue(0);

      await expect(service.sendTestNotification('user-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDeviceRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true, isDeleted: false },
      });
    });
  });

  describe('sendToUser', () => {
    it('debe retornar 0 si el usuario no tiene dispositivos activos', async () => {
      vi.mocked(mockDeviceRepo.find!).mockResolvedValue([]);

      const result = await service.sendToUser('user-1', {
        title: 'Hola',
        body: 'Mundo',
      });

      expect(result).toEqual({ sentCount: 0, failureCount: 0 });
    });
  });
});
