import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../config/redis.module.js';
import { ReminderService } from './reminder.service.js';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);
  private readonly lockKey = 'lock:reminders';
  private readonly lockTtlSeconds = 55;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    private readonly reminderService: ReminderService,
  ) {}

  /**
   * Tarea programada que se ejecuta cada minuto para despachar recordatorios pendientes.
   * Solo corre si SCHEDULER_ENABLED = true y está protegida por lock distribuido en Redis (SET lock:reminders NX EX 55).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    const isSchedulerEnabled = this.configService.get<boolean>(
      'SCHEDULER_ENABLED',
      true,
    );

    if (!isSchedulerEnabled) {
      return;
    }

    const lockValue = randomUUID();

    try {
      // Intenta adquirir el lock atómico en Redis con expiración de 55 segundos
      const acquired = await this.redisClient.set(
        this.lockKey,
        lockValue,
        'EX',
        this.lockTtlSeconds,
        'NX',
      );

      if (acquired !== 'OK') {
        // Otra instancia o réplica ya adquirió el lock para este minuto
        return;
      }

      const dispatchedCount = await this.reminderService.dispatchDue();
      if (dispatchedCount > 0) {
        this.logger.log(
          `Se procesaron y despacharon ${dispatchedCount} recordatorios pendientes.`,
        );
      }
    } catch (error) {
      this.logger.error('Error durante la ejecución del cron de recordatorios:', error);
    }
  }
}
