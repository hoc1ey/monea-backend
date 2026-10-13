import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReminderService } from './reminder.service.js';
import type { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity.js';
import { NotificationsService } from './notifications.service.js';
import {
  ReminderType,
  ReminderStatus,
} from './notifications.constants.js';

describe('ReminderService', () => {
  let service: ReminderService;
  let mockReminderRepo: Partial<Repository<Reminder>>;
  let mockNotificationsService: Partial<NotificationsService>;

  beforeEach(() => {
    mockReminderRepo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
      manager: {
        connection: {
          createQueryRunner: vi.fn(),
        },
      } as any,
    };

    mockNotificationsService = {
      sendToUser: vi.fn(),
    };

    service = new ReminderService(
      mockReminderRepo as Repository<Reminder>,
      mockNotificationsService as NotificationsService,
    );
  });

  describe('computeScheduledAt', () => {
    it('debe calcular la fecha en UTC forzando minutos y segundos en 0', () => {
      const scheduled = service.computeScheduledAt(
        '2026-10-20',
        9,
        'America/Bogota',
        0,
      );

      expect(scheduled.getUTCMinutes()).toBe(0);
      expect(scheduled.getUTCSeconds()).toBe(0);
      expect(scheduled.getUTCMilliseconds()).toBe(0);
      // En America/Bogota (UTC-5), 9:00 AM es 14:00 UTC
      expect(scheduled.getUTCHours()).toBe(14);
    });

    it('debe aplicar offsetDays correctamente', () => {
      const scheduled = service.computeScheduledAt(
        '2026-10-20',
        9,
        'America/Bogota',
        -1, // 1 día antes: 2026-10-19
      );

      expect(scheduled.getUTCDate()).toBe(19);
      expect(scheduled.getUTCHours()).toBe(14);
    });
  });

  describe('schedule', () => {
    it('debe crear un recordatorio si scheduledAt es en el futuro', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // Mañana
      futureDate.setUTCMinutes(0, 0, 0);

      const reminder = {
        id: 'rem-1',
        userId: 'user-1',
        type: ReminderType.CREDIT_CARD_PAYMENT,
        sourceId: 'card-1',
        title: 'Pago tarjeta',
        body: 'Vence mañana',
        scheduledAt: futureDate,
        status: ReminderStatus.PENDING,
        attempts: 0,
      } as Reminder;

      vi.mocked(mockReminderRepo.create!).mockReturnValue(reminder);
      vi.mocked(mockReminderRepo.save!).mockResolvedValue(reminder);

      const result = await service.schedule({
        userId: 'user-1',
        type: ReminderType.CREDIT_CARD_PAYMENT,
        sourceId: 'card-1',
        title: 'Pago tarjeta',
        body: 'Vence mañana',
        scheduledAt: futureDate,
      });

      expect(result).toBe(reminder);
      expect(mockReminderRepo.create).toHaveBeenCalled();
    });

    it('debe retornar null e ignorar si scheduledAt ya pasó', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // Hace 1 hora

      const result = await service.schedule({
        userId: 'user-1',
        type: ReminderType.CREDIT_CARD_PAYMENT,
        sourceId: 'card-1',
        title: 'Pago tarjeta',
        body: 'Vencido',
        scheduledAt: pastDate,
      });

      expect(result).toBeNull();
      expect(mockReminderRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelBySource', () => {
    it('debe actualizar el estado a CANCELLED sin borrar', async () => {
      vi.mocked(mockReminderRepo.update!).mockResolvedValue({} as any);

      await service.cancelBySource(ReminderType.LOAN, 'loan-123');

      expect(mockReminderRepo.update).toHaveBeenCalledWith(
        {
          type: ReminderType.LOAN,
          sourceId: 'loan-123',
          status: ReminderStatus.PENDING,
          isDeleted: false,
        },
        {
          status: ReminderStatus.CANCELLED,
        },
      );
    });
  });

  describe('reschedule', () => {
    it('debe cancelar los anteriores y programar uno nuevo', async () => {
      vi.mocked(mockReminderRepo.update!).mockResolvedValue({} as any);

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const reminder = { id: 'rem-2' } as Reminder;

      vi.mocked(mockReminderRepo.create!).mockReturnValue(reminder);
      vi.mocked(mockReminderRepo.save!).mockResolvedValue(reminder);

      const result = await service.reschedule(
        ReminderType.DEBT,
        'debt-1',
        {
          userId: 'user-1',
          type: ReminderType.DEBT,
          sourceId: 'debt-1',
          title: 'Deuda cuota',
          body: 'Recordatorio',
          scheduledAt: futureDate,
        },
      );

      expect(mockReminderRepo.update).toHaveBeenCalled();
      expect(result).toBe(reminder);
    });
  });

  describe('findUpcoming', () => {
    it('debe buscar recordatorios PENDING con scheduledAt en el futuro', async () => {
      const reminders = [{ id: 'rem-1' }] as Reminder[];
      vi.mocked(mockReminderRepo.find!).mockResolvedValue(reminders);

      const result = await service.findUpcoming('user-1');

      expect(result).toBe(reminders);
      expect(mockReminderRepo.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: ReminderStatus.PENDING,
          scheduledAt: expect.anything(),
          isDeleted: false,
        },
        order: {
          scheduledAt: 'ASC',
        },
      });
    });
  });

  describe('dispatchDue', () => {
    it('debe procesar recordatorios debidos y marcar SENT', async () => {
      const mockQueryRunner = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          createQueryBuilder: vi.fn().mockReturnValue({
            setLock: vi.fn().mockReturnThis(),
            setOnLocked: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            getMany: vi.fn().mockResolvedValue([
              {
                id: 'rem-1',
                userId: 'user-1',
                title: 'Alerta',
                body: 'Mensaje',
                type: ReminderType.DEBT,
                sourceId: 'debt-1',
                attempts: 0,
                status: ReminderStatus.PENDING,
              },
            ]),
          }),
          save: vi.fn(),
        },
      };

      vi.mocked(
        mockReminderRepo.manager!.connection.createQueryRunner,
      ).mockReturnValue(mockQueryRunner as any);

      vi.mocked(mockNotificationsService.sendToUser!).mockResolvedValue({
        sentCount: 1,
        failureCount: 0,
      });

      const count = await service.dispatchDue();

      expect(count).toBe(1);
      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Alerta', body: 'Mensaje' }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
