import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReminderScheduler } from './reminder.scheduler.js';
import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { ReminderService } from './reminder.service.js';

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler;
  let mockConfigService: Partial<ConfigService>;
  let mockRedisClient: Partial<Redis>;
  let mockReminderService: Partial<ReminderService>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn().mockReturnValue(true),
    };

    mockRedisClient = {
      set: vi.fn(),
    };

    mockReminderService = {
      dispatchDue: vi.fn(),
    };

    scheduler = new ReminderScheduler(
      mockConfigService as ConfigService,
      mockRedisClient as Redis,
      mockReminderService as ReminderService,
    );
  });

  it('no debe ejecutar dispatch si SCHEDULER_ENABLED es false', async () => {
    vi.mocked(mockConfigService.get!).mockReturnValue(false);

    await scheduler.handleCron();

    expect(mockRedisClient.set).not.toHaveBeenCalled();
    expect(mockReminderService.dispatchDue).not.toHaveBeenCalled();
  });

  it('no debe ejecutar dispatch si el lock en Redis no pudo adquirirse', async () => {
    vi.mocked(mockRedisClient.set!).mockResolvedValue(null);

    await scheduler.handleCron();

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'lock:reminders',
      expect.any(String),
      'EX',
      55,
      'NX',
    );
    expect(mockReminderService.dispatchDue).not.toHaveBeenCalled();
  });

  it('debe ejecutar dispatchDue si adquiere el lock en Redis', async () => {
    vi.mocked(mockRedisClient.set!).mockResolvedValue('OK');
    vi.mocked(mockReminderService.dispatchDue!).mockResolvedValue(3);

    await scheduler.handleCron();

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'lock:reminders',
      expect.any(String),
      'EX',
      55,
      'NX',
    );
    expect(mockReminderService.dispatchDue).toHaveBeenCalled();
  });
});
