import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  In,
} from 'typeorm';
import { Debt } from './entities/debt.entity.js';
import { DebtInstallment } from './entities/debt-installment.entity.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { UpdateDebtDto } from './dto/update-debt.dto.js';
import { QueryDebtDto } from './dto/query-debt.dto.js';
import { PayDebtInstallmentDto } from './dto/pay-installment.dto.js';
import { DebtStatus } from './debts.constants.js';
import {
  InstallmentReminderConfig,
  InstallmentScheduleBuilder,
} from '../common/utils/installment-schedule.builder.js';
import { RecurrenceFrequency } from '../common/utils/recurrence.util.js';
import { MoneyUtil } from '../common/utils/money.util.js';
import { ReminderService } from '../notifications/reminder.service.js';
import { ReminderType } from '../notifications/notifications.constants.js';
import { UsersService } from '../users/users.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from '../expenses/expenses.constants.js';

interface ReminderFields {
  reminderFrequency: RecurrenceFrequency | null;
  reminderDayOfWeek: number | null;
  reminderDayOfMonth: number | null;
  reminderMonth: number | null;
  reminderAt: string | null;
  reminderHour: number | null;
}

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(Debt)
    protected readonly debtRepository: Repository<Debt>,
    @InjectRepository(DebtInstallment)
    protected readonly installmentRepository: Repository<DebtInstallment>,
    private readonly dataSource: DataSource,
    private readonly reminderService: ReminderService,
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly expensesService: ExpensesService,
  ) {}

  /**
   * Crea una deuda, genera su plan de cuotas (último = residuo) y programa un
   * recordatorio por cada cuota pendiente.
   */
  async create(userId: string, dto: CreateDebtDto) {
    const timezone = await this.getTimezone(userId);
    const reminderEnabled = dto.reminderEnabled ?? false;

    const fields = this.fieldsFromCreateDto(dto);
    this.validateCreateReminder(dto, fields, reminderEnabled);

    const debt = this.debtRepository.create({
      userId,
      personName: dto.personName,
      totalAmount: dto.totalAmount,
      installmentsCount: dto.installmentsCount,
      reminderEnabled: false,
      reminderFrequency: null,
      reminderDayOfWeek: null,
      reminderDayOfMonth: null,
      reminderMonth: null,
      reminderAt: null,
      reminderHour: null,
      status: DebtStatus.PENDING,
    });
    this.assignReminderFields(debt, dto.installmentsCount, fields, reminderEnabled);

    const savedDebt = await this.debtRepository.save(debt);
    const savedInstallments = await this.createInstallments(savedDebt, timezone);

    await this.scheduleReminders(savedDebt, savedInstallments, timezone);

    return {
      data: { ...savedDebt, installments: savedInstallments },
      message: 'Deuda registrada correctamente',
    };
  }

  /**
   * Lista las deudas del usuario con `paidAmount` y `pendingAmount`, con filtro
   * opcional por estado.
   */
  async findAll(userId: string, query: QueryDebtDto) {
    const qb = this.debtRepository
      .createQueryBuilder('debt')
      .where('debt.userId = :userId', { userId })
      .andWhere('debt.isDeleted = false')
      .orderBy('debt.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('debt.status = :status', { status: query.status });
    }

    const debts = await qb.getMany();

    if (debts.length === 0) {
      return {
        data: [],
        message: 'Deudas obtenidas correctamente',
      };
    }

    const installments = await this.installmentRepository.find({
      where: {
        debtId: In(debts.map((debt) => debt.id)),
        isDeleted: false,
      },
    });

    const paidMap = new Map<string, number>();
    const pendingMap = new Map<string, number>();
    for (const installment of installments) {
      const target = installment.isPaid ? paidMap : pendingMap;
      target.set(
        installment.debtId,
        MoneyUtil.round(
          MoneyUtil.add(target.get(installment.debtId) ?? 0, installment.amount),
        ),
      );
    }

    const data = debts.map((debt) => ({
      ...debt,
      paidAmount: paidMap.get(debt.id) ?? 0,
      pendingAmount: pendingMap.get(debt.id) ?? 0,
    }));

    return {
      data,
      message: 'Deudas obtenidas correctamente',
    };
  }

  /**
   * Obtiene una deuda con sus cuotas activas.
   */
  async findOne(userId: string, id: string) {
    const debt = await this.assertOwnership(userId, id);
    const installments = await this.getInstallments(debt.id);

    return {
      data: { ...debt, installments },
      message: 'Deuda obtenida correctamente',
    };
  }

  /**
   * Actualiza una deuda.
   * - Con cuotas pagadas: solo `personName` y recordatorio.
   * - Sin cuotas pagadas: permite cambiar monto/cuotas (regenera el plan).
   */
  async update(userId: string, id: string, dto: UpdateDebtDto) {
    const debt = await this.assertOwnership(userId, id);
    const existingInstallments = await this.getInstallments(debt.id);
    const hasPaid = existingInstallments.some((installment) => installment.isPaid);
    const timezone = await this.getTimezone(userId);

    if (
      hasPaid &&
      (dto.totalAmount !== undefined || dto.installmentsCount !== undefined)
    ) {
      throw new BadRequestException(
        'No se puede modificar el monto ni las cuotas de una deuda con cuotas pagadas',
      );
    }

    const oldTotal = debt.totalAmount;
    const oldCount = debt.installmentsCount;
    const newTotal = dto.totalAmount ?? oldTotal;
    const newCount = dto.installmentsCount ?? oldCount;
    const reminderEnabled = dto.reminderEnabled ?? debt.reminderEnabled;
    const reminderChanged =
      dto.reminderEnabled !== undefined ||
      dto.reminderFrequency !== undefined ||
      dto.reminderDayOfWeek !== undefined ||
      dto.reminderDayOfMonth !== undefined ||
      dto.reminderMonth !== undefined ||
      dto.reminderAt !== undefined ||
      dto.reminderHour !== undefined;

    const fields: ReminderFields = {
      reminderFrequency:
        dto.reminderFrequency !== undefined
          ? (dto.reminderFrequency ?? null)
          : debt.reminderFrequency,
      reminderDayOfWeek:
        dto.reminderDayOfWeek !== undefined
          ? (dto.reminderDayOfWeek ?? null)
          : debt.reminderDayOfWeek,
      reminderDayOfMonth:
        dto.reminderDayOfMonth !== undefined
          ? (dto.reminderDayOfMonth ?? null)
          : debt.reminderDayOfMonth,
      reminderMonth:
        dto.reminderMonth !== undefined
          ? (dto.reminderMonth ?? null)
          : debt.reminderMonth,
      reminderAt:
        dto.reminderAt !== undefined
          ? (dto.reminderAt ?? null)
          : (debt.reminderAt ? debt.reminderAt.toISOString() : null),
      reminderHour:
        dto.reminderHour !== undefined
          ? (dto.reminderHour ?? null)
          : debt.reminderHour,
    };

    this.validateUpdateReminder(newCount, dto, fields, reminderEnabled);

    if (dto.personName !== undefined) {
      debt.personName = dto.personName;
    }
    debt.totalAmount = newTotal;
    debt.installmentsCount = newCount;
    this.assignReminderFields(debt, newCount, fields, reminderEnabled);

    const rebuild = !hasPaid && (newTotal !== oldTotal || newCount !== oldCount);

    if (rebuild) {
      for (const installment of existingInstallments) {
        installment.isDeleted = true;
        installment.deletedAt = new Date();
      }
      if (existingInstallments.length > 0) {
        await this.installmentRepository.save(existingInstallments);
        await this.cancelReminders(existingInstallments);
      }

      debt.status = DebtStatus.PENDING;
      const savedDebt = await this.debtRepository.save(debt);
      const savedInstallments = await this.createInstallments(savedDebt, timezone);
      await this.scheduleReminders(savedDebt, savedInstallments, timezone);

      return {
        data: { ...savedDebt, installments: savedInstallments },
        message: 'Deuda actualizada correctamente',
      };
    }

    const savedDebt = await this.debtRepository.save(debt);

    if (reminderChanged) {
      const pending = existingInstallments.filter(
        (installment) => !installment.isPaid,
      );

      if (pending.length > 0) {
        const plan = InstallmentScheduleBuilder.build({
          totalAmount: savedDebt.totalAmount,
          installments: savedDebt.installmentsCount,
          baseDate: new Date(),
          timezone,
          reminder: this.toReminderConfig(savedDebt),
        });
        const dueByNumber = new Map(plan.map((item) => [item.number, item.dueDate]));

        for (const installment of pending) {
          installment.dueDate = dueByNumber.get(installment.number) ?? null;
        }

        await this.installmentRepository.save(pending);
        await this.cancelReminders(pending);
        await this.scheduleReminders(savedDebt, pending, timezone);
      }
    }

    return {
      data: {
        ...savedDebt,
        installments: await this.getInstallments(savedDebt.id),
      },
      message: 'Deuda actualizada correctamente',
    };
  }

  /**
   * Borrado lógico de la deuda y cancelación de sus recordatorios.
   * Los egresos ya generados se conservan.
   */
  async remove(userId: string, id: string) {
    const debt = await this.assertOwnership(userId, id);
    const installments = await this.getInstallments(debt.id);

    debt.isDeleted = true;
    debt.deletedAt = new Date();
    await this.debtRepository.save(debt);
    await this.cancelReminders(installments);

    return {
      data: null,
      message: 'Deuda eliminada correctamente',
    };
  }

  /**
   * Paga una cuota: crea el egreso (`DEBT_PAYMENT`) en la cuenta indicada,
   * marca la cuota, cancela su recordatorio y recalcula el estado.
   * Todo el movimiento monetario ocurre en una transacción.
   */
  async payInstallment(
    userId: string,
    debtId: string,
    installmentId: string,
    dto: PayDebtInstallmentDto,
  ) {
    const debt = await this.assertOwnership(userId, debtId);

    const installment = await this.installmentRepository.findOne({
      where: { id: installmentId, debtId, userId, isDeleted: false },
    });

    if (!installment) {
      throw new NotFoundException('Cuota no encontrada');
    }

    if (installment.isPaid) {
      throw new BadRequestException('La cuota ya fue pagada');
    }

    await this.accountsService.assertOwnership(userId, dto.accountId);

    const paidAt = new Date();

    const status = await this.dataSource.transaction(async (manager) => {
      const expense = await this.expensesService.createInternal(
        userId,
        {
          accountId: dto.accountId,
          name:
            dto.name ??
            `Deuda ${debt.personName} (${installment.number}/${debt.installmentsCount})`,
          amount: installment.amount,
          description: dto.description ?? null,
          date: paidAt,
          paymentMethod: ExpensePaymentMethod.CORRIENTE,
          sourceType: ExpenseSourceType.DEBT_PAYMENT,
          sourceId: installment.id,
        },
        manager,
      );

      installment.isPaid = true;
      installment.paidAt = paidAt;
      installment.expenseId = expense.id;
      await manager.getRepository(DebtInstallment).save(installment);

      const debtStatus = await this.recalculateStatus(debt.id, manager);
      debt.status = debtStatus;
      await manager.getRepository(Debt).save(debt);

      return debtStatus;
    });

    await this.reminderService.cancelBySource(ReminderType.DEBT, installment.id);

    return {
      data: {
        installment: {
          number: installment.number,
          amount: installment.amount,
          isPaid: installment.isPaid,
          paidAt: installment.paidAt,
          expenseId: installment.expenseId,
        },
        debtStatus: status,
      },
      message: 'Cuota pagada correctamente',
    };
  }

  /**
   * Valida que la deuda exista, no esté eliminada y pertenezca al usuario.
   */
  async assertOwnership(userId: string, id: string): Promise<Debt> {
    const debt = await this.debtRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!debt) {
      throw new NotFoundException('Deuda no encontrada');
    }

    return debt;
  }

  /**
   * Recalcula el estado de la deuda según sus cuotas activas.
   */
  private async recalculateStatus(
    debtId: string,
    manager?: EntityManager,
  ): Promise<DebtStatus> {
    const repo = manager
      ? manager.getRepository(DebtInstallment)
      : this.installmentRepository;

    const installments = await repo.find({
      where: { debtId, isDeleted: false },
    });

    if (installments.length === 0) {
      return DebtStatus.PENDING;
    }

    const paidCount = installments.filter(
      (installment) => installment.isPaid,
    ).length;

    if (paidCount === 0) {
      return DebtStatus.PENDING;
    }
    if (paidCount === installments.length) {
      return DebtStatus.PAID;
    }
    return DebtStatus.PARTIAL;
  }

  private async createInstallments(
    debt: Debt,
    timezone: string,
  ): Promise<DebtInstallment[]> {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: debt.totalAmount,
      installments: debt.installmentsCount,
      baseDate: new Date(),
      timezone,
      reminder: this.toReminderConfig(debt),
    });

    const installments = plan.map((item) =>
      this.installmentRepository.create({
        userId: debt.userId,
        debtId: debt.id,
        number: item.number,
        amount: item.amount,
        dueDate: item.dueDate,
        isPaid: false,
        paidAt: null,
        expenseId: null,
      }),
    );

    return this.installmentRepository.save(installments);
  }

  private async getInstallments(debtId: string): Promise<DebtInstallment[]> {
    return this.installmentRepository.find({
      where: { debtId, isDeleted: false },
      order: { number: 'ASC' },
    });
  }

  private async scheduleReminders(
    debt: Debt,
    installments: DebtInstallment[],
    _timezone: string,
  ): Promise<void> {
    if (!debt.reminderEnabled) {
      return;
    }

    for (const installment of installments) {
      if (installment.isPaid || !installment.dueDate) {
        continue;
      }

      await this.reminderService.reschedule(ReminderType.DEBT, installment.id, {
        userId: debt.userId,
        type: ReminderType.DEBT,
        sourceId: installment.id,
        title: `Deuda con ${debt.personName}`,
        body: `Se aproxima la cuota ${installment.number}/${debt.installmentsCount} de la deuda con ${debt.personName} por ${installment.amount}.`,
        scheduledAt: installment.dueDate,
      });
    }
  }

  private async cancelReminders(
    installments: DebtInstallment[],
  ): Promise<void> {
    for (const installment of installments) {
      await this.reminderService.cancelBySource(
        ReminderType.DEBT,
        installment.id,
      );
    }
  }

  private toReminderConfig(debt: Debt): InstallmentReminderConfig {
    return {
      enabled: debt.reminderEnabled,
      frequency: debt.reminderFrequency,
      dayOfWeek: debt.reminderDayOfWeek,
      dayOfMonth: debt.reminderDayOfMonth,
      monthOfYear: debt.reminderMonth,
      at: debt.reminderAt,
      hour: debt.reminderHour,
    };
  }

  private fieldsFromCreateDto(dto: CreateDebtDto): ReminderFields {
    return {
      reminderFrequency: dto.reminderFrequency ?? null,
      reminderDayOfWeek: dto.reminderDayOfWeek ?? null,
      reminderDayOfMonth: dto.reminderDayOfMonth ?? null,
      reminderMonth: dto.reminderMonth ?? null,
      reminderAt: dto.reminderAt ?? null,
      reminderHour: dto.reminderHour ?? null,
    };
  }

  private assignReminderFields(
    debt: Debt,
    installmentsCount: number,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    if (!reminderEnabled) {
      debt.reminderEnabled = false;
      debt.reminderFrequency = null;
      debt.reminderDayOfWeek = null;
      debt.reminderDayOfMonth = null;
      debt.reminderMonth = null;
      debt.reminderAt = null;
      debt.reminderHour = null;
      return;
    }

    debt.reminderEnabled = true;

    if (installmentsCount === 1) {
      debt.reminderFrequency = null;
      debt.reminderDayOfWeek = null;
      debt.reminderDayOfMonth = null;
      debt.reminderMonth = null;
      debt.reminderHour = null;
      debt.reminderAt = fields.reminderAt ? new Date(fields.reminderAt) : null;
      return;
    }

    debt.reminderAt = null;
    debt.reminderFrequency = fields.reminderFrequency;
    debt.reminderDayOfWeek = fields.reminderDayOfWeek;
    debt.reminderDayOfMonth = fields.reminderDayOfMonth;
    debt.reminderMonth = fields.reminderMonth;
    debt.reminderHour = fields.reminderHour;
  }

  /**
   * Reglas de recordatorio en la creación: campos prohibidos según el número de
   * cuotas (aunque `reminderEnabled` no se envíe) y campos obligatorios cuando
   * el recordatorio está activo.
   */
  private validateCreateReminder(
    dto: CreateDebtDto,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    const hasRecurrenceFields =
      dto.reminderFrequency != null ||
      dto.reminderDayOfWeek != null ||
      dto.reminderDayOfMonth != null ||
      dto.reminderMonth != null ||
      dto.reminderHour != null;

    if (dto.installmentsCount === 1 && hasRecurrenceFields) {
      throw new BadRequestException(
        'Una cuota única con recordatorio debe usar reminderAt',
      );
    }

    if (dto.installmentsCount > 1 && dto.reminderAt != null) {
      throw new BadRequestException(
        'reminderAt solo aplica a una deuda de una cuota única',
      );
    }

    if (dto.reminderAt != null) {
      this.assertWholeHour(dto.reminderAt);
    }

    if (reminderEnabled) {
      this.validateReminderRequired(dto.installmentsCount, fields);
    }
  }

  /**
   * Reglas de recordatorio en la actualización: campos prohibidos según el nuevo
   * número de cuotas y campos obligatorios combinando los valores vigentes.
   */
  private validateUpdateReminder(
    installmentsCount: number,
    dto: UpdateDebtDto,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    const recurrenceProvided =
      dto.reminderFrequency !== undefined ||
      dto.reminderDayOfWeek !== undefined ||
      dto.reminderDayOfMonth !== undefined ||
      dto.reminderMonth !== undefined ||
      dto.reminderHour !== undefined;

    if (installmentsCount === 1 && recurrenceProvided) {
      throw new BadRequestException(
        'Una cuota única con recordatorio debe usar reminderAt',
      );
    }

    if (installmentsCount > 1 && dto.reminderAt !== undefined) {
      throw new BadRequestException(
        'reminderAt solo aplica a una deuda de una cuota única',
      );
    }

    if (dto.reminderAt) {
      this.assertWholeHour(dto.reminderAt);
    }

    if (reminderEnabled) {
      this.validateReminderRequired(installmentsCount, fields);
    }
  }

  private validateReminderRequired(
    installmentsCount: number,
    fields: ReminderFields,
  ): void {
    if (installmentsCount === 1) {
      if (!fields.reminderAt) {
        throw new BadRequestException(
          'reminderAt es obligatorio para una cuota única con recordatorio',
        );
      }
      return;
    }

    if (fields.reminderFrequency == null) {
      throw new BadRequestException(
        'La frecuencia del recordatorio es obligatoria para varias cuotas',
      );
    }

    if (
      fields.reminderFrequency === RecurrenceFrequency.WEEKLY &&
      fields.reminderDayOfWeek == null
    ) {
      throw new BadRequestException(
        'reminderDayOfWeek es obligatorio para la frecuencia WEEKLY',
      );
    }

    if (
      fields.reminderFrequency === RecurrenceFrequency.MONTHLY &&
      fields.reminderDayOfMonth == null
    ) {
      throw new BadRequestException(
        'reminderDayOfMonth es obligatorio para la frecuencia MONTHLY',
      );
    }

    if (
      fields.reminderFrequency === RecurrenceFrequency.YEARLY &&
      fields.reminderMonth == null
    ) {
      throw new BadRequestException(
        'reminderMonth es obligatorio para la frecuencia YEARLY',
      );
    }

    if (fields.reminderHour == null) {
      throw new BadRequestException(
        'La hora del recordatorio es obligatoria para varias cuotas',
      );
    }
  }

  private assertWholeHour(value: string): void {
    const at = new Date(value);
    if (
      at.getUTCMinutes() !== 0 ||
      at.getUTCSeconds() !== 0 ||
      at.getUTCMilliseconds() !== 0
    ) {
      throw new BadRequestException(
        'reminderAt solo admite hora exacta (minutos y segundos en 0)',
      );
    }
  }

  private async getTimezone(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    return user.timezone || 'America/Bogota';
  }
}
