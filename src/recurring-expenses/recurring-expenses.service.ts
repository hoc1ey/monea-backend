import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { RecurringExpenseConfig } from './entities/recurring-expense-config.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from '../expenses/expenses.constants.js';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto.js';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto.js';
import { SetRecurringExpenseActiveDto } from './dto/set-active.dto.js';
import { ReminderOffset } from './recurring-expenses.constants.js';
import {
  RecurrenceFrequency,
  RecurrenceRule,
  RecurrenceUtil,
} from '../common/utils/recurrence.util.js';
import { ReminderType } from '../notifications/notifications.constants.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { UsersService } from '../users/users.service.js';
import { ReminderService } from '../notifications/reminder.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { DateUtil } from '../common/utils/date.util.js';

const MAX_OCCURRENCES_PER_RUN = 31;

@Injectable()
export class RecurringExpensesService {
  private readonly logger = new Logger(RecurringExpensesService.name);

  constructor(
    @InjectRepository(RecurringExpenseConfig)
    protected readonly configRepository: Repository<RecurringExpenseConfig>,
    private readonly dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
    private readonly reminderService: ReminderService,
    private readonly expensesService: ExpensesService,
  ) {}

  /**
   * Crea una configuración de egreso recurrente y programa su recordatorio.
   */
  async create(userId: string, dto: CreateRecurringExpenseDto) {
    await this.accountsService.assertOwnership(userId, dto.accountId);

    const isVariableAmount = dto.isVariableAmount ?? false;

    if (isVariableAmount && dto.amount != null) {
      throw new BadRequestException(
        'No se debe enviar amount cuando isVariableAmount es true',
      );
    }

    const config = this.configRepository.create({
      userId,
      accountId: dto.accountId,
      name: dto.name,
      amount: isVariableAmount ? null : (dto.amount ?? null),
      isVariableAmount,
      description: dto.description ?? null,
      frequency: dto.frequency,
      dayOfWeek: dto.dayOfWeek ?? null,
      dayOfMonth: dto.dayOfMonth ?? null,
      monthOfYear: dto.monthOfYear ?? null,
      startDate: dto.startDate.slice(0, 10),
      endDate: dto.endDate ? dto.endDate.slice(0, 10) : null,
      isActive: true,
      nextRunAt: new Date(),
      lastGeneratedAt: null,
      reminderEnabled: dto.reminderEnabled ?? false,
      reminderOffset: dto.reminderOffset ?? null,
      reminderHour: dto.reminderHour ?? null,
    });

    this.normalizeFrequencyFields(config);
    this.validateFrequencyFields(config);
    this.validateAmount(config);
    this.validateReminderFields(config);
    this.validateDateRange(config);

    const timezone = await this.getTimezone(userId);
    config.nextRunAt = this.computeNextRunAt(
      config,
      timezone,
      this.startInstant(config, timezone),
    );

    const saved = await this.configRepository.save(config);
    await this.scheduleReminder(saved, timezone);

    return {
      data: saved,
      message: 'Configuración de egreso recurrente creada',
    };
  }

  /**
   * Lista las configuraciones activas (no borradas) del usuario.
   */
  async findAll(userId: string) {
    const configs = await this.configRepository.find({
      where: { userId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return {
      data: configs,
      message: 'Configuraciones de egresos recurrentes obtenidas correctamente',
    };
  }

  /**
   * Obtiene una configuración validando pertenencia al usuario y borrado lógico.
   */
  async findOne(userId: string, id: string) {
    const config = await this.assertOwnership(userId, id);

    return {
      data: config,
      message: 'Configuración de egreso recurrente obtenida correctamente',
    };
  }

  /**
   * Actualiza la configuración, recalcula `nextRunAt` y reprograma el recordatorio.
   * No afecta egresos ya generados.
   */
  async update(userId: string, id: string, dto: UpdateRecurringExpenseDto) {
    const config = await this.assertOwnership(userId, id);

    if (dto.accountId !== undefined && dto.accountId !== config.accountId) {
      await this.accountsService.assertOwnership(userId, dto.accountId);
      config.accountId = dto.accountId;
    }
    if (dto.name !== undefined) {
      config.name = dto.name;
    }
    if (dto.description !== undefined) {
      config.description = dto.description ?? null;
    }
    if (dto.isVariableAmount !== undefined) {
      config.isVariableAmount = dto.isVariableAmount;
    }
    if (dto.amount !== undefined) {
      config.amount = dto.amount;
    }
    if (dto.frequency !== undefined) {
      config.frequency = dto.frequency;
    }
    if (dto.dayOfWeek !== undefined) {
      config.dayOfWeek = dto.dayOfWeek;
    }
    if (dto.dayOfMonth !== undefined) {
      config.dayOfMonth = dto.dayOfMonth;
    }
    if (dto.monthOfYear !== undefined) {
      config.monthOfYear = dto.monthOfYear;
    }
    if (dto.startDate !== undefined) {
      config.startDate = dto.startDate.slice(0, 10);
    }
    if (dto.endDate !== undefined) {
      config.endDate = dto.endDate ? dto.endDate.slice(0, 10) : null;
    }
    if (dto.reminderEnabled !== undefined) {
      config.reminderEnabled = dto.reminderEnabled;
    }
    if (dto.reminderOffset !== undefined) {
      config.reminderOffset = dto.reminderOffset;
    }
    if (dto.reminderHour !== undefined) {
      config.reminderHour = dto.reminderHour;
    }

    this.normalizeFrequencyFields(config);
    this.validateFrequencyFields(config);
    this.validateAmount(config);
    this.validateReminderFields(config);
    this.validateDateRange(config);

    const timezone = await this.getTimezone(userId);
    config.nextRunAt = this.computeFromToday(config, timezone);

    const saved = await this.configRepository.save(config);

    if (saved.isActive) {
      await this.scheduleReminder(saved, timezone);
    } else {
      await this.reminderService.cancelBySource(
        ReminderType.RECURRING_EXPENSE,
        saved.id,
      );
    }

    return {
      data: saved,
      message: 'Configuración de egreso recurrente actualizada correctamente',
    };
  }

  /**
   * Activa o desactiva la configuración. Al reactivar recalcula `nextRunAt`
   * desde hoy (sin generar atrasados); al desactivar cancela los recordatorios.
   */
  async setActive(userId: string, id: string, dto: SetRecurringExpenseActiveDto) {
    const config = await this.assertOwnership(userId, id);
    const timezone = await this.getTimezone(userId);

    config.isActive = dto.isActive;

    if (config.isActive) {
      config.nextRunAt = this.computeFromToday(config, timezone);
      const saved = await this.configRepository.save(config);
      await this.scheduleReminder(saved, timezone);

      return {
        data: saved,
        message: 'Configuración de egreso recurrente activada correctamente',
      };
    }

    const saved = await this.configRepository.save(config);
    await this.reminderService.cancelBySource(
      ReminderType.RECURRING_EXPENSE,
      saved.id,
    );

    return {
      data: saved,
      message: 'Configuración de egreso recurrente desactivada correctamente',
    };
  }

  /**
   * Borrado lógico sólo de la configuración; cancela recordatorios y conserva
   * los egresos generados.
   */
  async remove(userId: string, id: string) {
    const config = await this.assertOwnership(userId, id);

    config.isDeleted = true;
    config.deletedAt = new Date();
    await this.configRepository.save(config);

    await this.reminderService.cancelBySource(
      ReminderType.RECURRING_EXPENSE,
      config.id,
    );

    return {
      data: null,
      message: 'Configuración de egreso recurrente eliminada correctamente',
    };
  }

  /**
   * Genera los egresos vencidos de todas las configuraciones activas.
   * Procesa ocurrencias atrasadas en bucle con un tope por ejecución.
   * Devuelve la cantidad de egresos creados.
   */
  async generateDueExpenses(): Promise<number> {
    const now = new Date();

    const configs = await this.configRepository.find({
      where: {
        isActive: true,
        isDeleted: false,
        nextRunAt: LessThanOrEqual(now),
      },
      order: { nextRunAt: 'ASC' },
    });

    let generated = 0;

    for (const config of configs) {
      generated += await this.processConfig(config, now);
    }

    if (generated > 0) {
      this.logger.log(`Se generaron ${generated} egresos recurrentes.`);
    }

    return generated;
  }

  /**
   * Valida que la configuración exista, no esté eliminada y pertenezca al usuario.
   * Reutilizable por el scheduler.
   */
  async assertOwnership(
    userId: string,
    id: string,
  ): Promise<RecurringExpenseConfig> {
    const config = await this.configRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!config) {
      throw new NotFoundException(
        'Configuración de egreso recurrente no encontrada',
      );
    }

    return config;
  }

  private async processConfig(
    config: RecurringExpenseConfig,
    now: Date,
  ): Promise<number> {
    const timezone = await this.getTimezone(config.userId);
    const rule = this.buildRule(config);
    let generated = 0;
    let occurrences = 0;

    while (
      occurrences < MAX_OCCURRENCES_PER_RUN &&
      config.isActive &&
      config.nextRunAt.getTime() <= now.getTime()
    ) {
      const occurrence = config.nextRunAt;
      const occurrenceDate = RecurrenceUtil.toLocalDateString(
        occurrence,
        timezone,
      );

      if (config.endDate && occurrenceDate > config.endDate) {
        config.isActive = false;
        await this.configRepository.save(config);
        await this.reminderService.cancelBySource(
          ReminderType.RECURRING_EXPENSE,
          config.id,
        );
        break;
      }

      const next = RecurrenceUtil.computeFollowingOccurrence(
        rule,
        occurrence,
        timezone,
      );
      const nextDate = RecurrenceUtil.toLocalDateString(next, timezone);

      await this.dataSource.transaction(async (manager) => {
        const existing = await manager.getRepository(Expense).findOne({
          where: {
            recurringConfigId: config.id,
            occurrenceDate,
          },
        });

        if (!existing) {
          await this.expensesService.createInternal(
            config.userId,
            {
              accountId: config.accountId,
              name: config.name,
              amount: config.isVariableAmount ? 0 : (config.amount ?? 0),
              description: config.description,
              date: occurrence,
              paymentMethod: ExpensePaymentMethod.CORRIENTE,
              amountPending: config.isVariableAmount,
              recurringConfigId: config.id,
              occurrenceDate,
              sourceType: ExpenseSourceType.RECURRING,
              sourceId: config.id,
            },
            manager,
          );
          generated += 1;
        }

        config.lastGeneratedAt = new Date();
        config.nextRunAt = next;
        if (config.endDate && nextDate > config.endDate) {
          config.isActive = false;
        }

        await manager.getRepository(RecurringExpenseConfig).save(config);
      });

      occurrences += 1;

      if (!config.isActive) {
        await this.reminderService.cancelBySource(
          ReminderType.RECURRING_EXPENSE,
          config.id,
        );
        break;
      }

      await this.scheduleReminder(config, timezone);
    }

    return generated;
  }

  /**
   * Calcula la próxima ocurrencia a partir de `after`.
   */
  private computeNextRunAt(
    config: RecurringExpenseConfig,
    timezone: string,
    after: Date,
  ): Date {
    return RecurrenceUtil.computeNextOccurrence(
      this.buildRule(config),
      after,
      timezone,
    );
  }

  /**
   * Calcula la próxima ocurrencia desde hoy, respetando `startDate` si es futura.
   */
  private computeFromToday(
    config: RecurringExpenseConfig,
    timezone: string,
  ): Date {
    const now = new Date();
    const startInstant = this.startInstant(config, timezone);
    const after = now.getTime() > startInstant.getTime() ? now : startInstant;

    return this.computeNextRunAt(config, timezone, after);
  }

  /**
   * Instante UTC de la medianoche local de `startDate`.
   */
  private startInstant(
    config: RecurringExpenseConfig,
    timezone: string,
  ): Date {
    return RecurrenceUtil.localDateToUtc(config.startDate, timezone);
  }

  private async scheduleReminder(
    config: RecurringExpenseConfig,
    timezone: string,
  ) {
    if (
      !config.reminderEnabled ||
      config.reminderOffset == null ||
      config.reminderHour == null
    ) {
      await this.reminderService.cancelBySource(
        ReminderType.RECURRING_EXPENSE,
        config.id,
      );
      return null;
    }

    const offsetDays =
      config.reminderOffset === ReminderOffset.ONE_DAY_BEFORE ? -1 : 0;
    const scheduledAt = DateUtil.computeScheduledAt(
      config.nextRunAt,
      config.reminderHour,
      timezone,
      offsetDays,
    );

    const body = config.isVariableAmount
      ? `Se aproxima el egreso recurrente "${config.name}". Recuerda definir el monto.`
      : `Se aproxima el egreso recurrente "${config.name}" por ${config.amount ?? 0}.`;

    return this.reminderService.reschedule(
      ReminderType.RECURRING_EXPENSE,
      config.id,
      {
        userId: config.userId,
        type: ReminderType.RECURRING_EXPENSE,
        sourceId: config.id,
        title: `Egreso recurrente ${config.name}`,
        body,
        scheduledAt,
      },
    );
  }

  private async getTimezone(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    return user.timezone || 'America/Bogota';
  }

  private buildRule(config: RecurringExpenseConfig): RecurrenceRule {
    return {
      frequency: config.frequency,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
      monthOfYear: config.monthOfYear,
    };
  }

  private normalizeFrequencyFields(config: RecurringExpenseConfig): void {
    switch (config.frequency) {
      case RecurrenceFrequency.WEEKLY:
        config.dayOfMonth = null;
        config.monthOfYear = null;
        break;
      case RecurrenceFrequency.MONTHLY:
        config.dayOfWeek = null;
        config.monthOfYear = null;
        break;
      case RecurrenceFrequency.YEARLY:
        config.dayOfWeek = null;
        break;
    }
  }

  private validateFrequencyFields(config: RecurringExpenseConfig): void {
    if (
      config.frequency === RecurrenceFrequency.WEEKLY &&
      config.dayOfWeek == null
    ) {
      throw new BadRequestException(
        'dayOfWeek es obligatorio para la frecuencia WEEKLY',
      );
    }

    if (
      config.frequency === RecurrenceFrequency.MONTHLY &&
      config.dayOfMonth == null
    ) {
      throw new BadRequestException(
        'dayOfMonth es obligatorio para la frecuencia MONTHLY',
      );
    }

    if (
      config.frequency === RecurrenceFrequency.YEARLY &&
      config.monthOfYear == null
    ) {
      throw new BadRequestException(
        'monthOfYear es obligatorio para la frecuencia YEARLY',
      );
    }
  }

  private validateAmount(config: RecurringExpenseConfig): void {
    if (config.isVariableAmount) {
      config.amount = null;
      return;
    }

    if (config.amount == null) {
      throw new BadRequestException(
        'El monto es obligatorio cuando isVariableAmount es false',
      );
    }
  }

  private validateReminderFields(config: RecurringExpenseConfig): void {
    if (config.reminderEnabled) {
      if (config.reminderOffset == null) {
        throw new BadRequestException(
          'reminderOffset es obligatorio cuando reminderEnabled es true',
        );
      }
      if (config.reminderHour == null) {
        throw new BadRequestException(
          'reminderHour es obligatorio cuando reminderEnabled es true',
        );
      }
      return;
    }

    config.reminderOffset = null;
    config.reminderHour = null;
  }

  private validateDateRange(config: RecurringExpenseConfig): void {
    if (config.endDate && config.endDate < config.startDate) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
  }
}
