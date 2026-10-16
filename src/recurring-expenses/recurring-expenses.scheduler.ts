import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../config/redis.module.js';
import { RecurringExpensesService } from './recurring-expenses.service.js';

@Injectable()
export class RecurringExpensesScheduler {
  private readonly logger = new Logger(RecurringExpensesScheduler.name);
  private readonly lockKey = 'lock:recurring-expenses';
  private readonly lockTtlSeconds = 3300;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    private readonly recurringExpensesService: RecurringExpensesService,
  ) {}

  /**
   * Tarea programada que se ejecuta cada hora para generar los egresos
   * recurrentes vencidos. Solo corre si SCHEDULER_ENABLED = true y está
   * protegida por lock distribuido en Redis.
   */
  @Cron(CronExpression.EVERY_HOUR)
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
      const acquired = await this.redisClient.set(
        this.lockKey,
        lockValue,
        'EX',
        this.lockTtlSeconds,
        'NX',
      );

      if (acquired !== 'OK') {
        return;
      }

      await this.recurringExpensesService.generateDueExpenses();
    } catch (error) {
      this.logger.error(
        'Error durante la ejecución del cron de egresos recurrentes:',
        error,
      );
    }
  }
}
