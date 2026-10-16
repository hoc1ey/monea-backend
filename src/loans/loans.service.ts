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
import { Loan } from './entities/loan.entity.js';
import { LoanInstallment } from './entities/loan-installment.entity.js';
import { CreateLoanDto } from './dto/create-loan.dto.js';
import { UpdateLoanDto } from './dto/update-loan.dto.js';
import { QueryLoanDto } from './dto/query-loan.dto.js';
import { PayLoanInstallmentDto } from './dto/pay-installment.dto.js';
import { LoanStatus } from './loans.constants.js';
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
import { IncomesService } from '../incomes/incomes.service.js';
import { IncomeSourceType } from '../incomes/incomes.constants.js';
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
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    protected readonly loanRepository: Repository<Loan>,
    @InjectRepository(LoanInstallment)
    protected readonly installmentRepository: Repository<LoanInstallment>,
    private readonly dataSource: DataSource,
    private readonly reminderService: ReminderService,
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly incomesService: IncomesService,
    private readonly expensesService: ExpensesService,
  ) {}

  /**
   * Crea un préstamo, genera su plan de cuotas y registra el egreso corriente
   * por el monto total en una única transacción. Luego programa un recordatorio
   * por cada cuota pendiente.
   */
  async create(userId: string, dto: CreateLoanDto) {
    const timezone = await this.getTimezone(userId);
    const reminderEnabled = dto.reminderEnabled ?? false;

    const fields = this.fieldsFromCreateDto(dto);
    this.validateCreateReminder(dto, fields, reminderEnabled);

    const { loan, installments } = await this.dataSource.transaction(
      async (manager) => {
        await this.accountsService.assertOwnership(userId, dto.accountId);

        const loanRepo = manager.getRepository(Loan);
        const installmentRepo = manager.getRepository(LoanInstallment);

        const loan = loanRepo.create({
          userId,
          accountId: dto.accountId,
          personName: dto.personName,
          totalAmount: dto.totalAmount,
          installmentsCount: dto.installmentsCount,
          description: dto.description ?? null,
          expenseId: null,
          reminderEnabled: false,
          reminderFrequency: null,
          reminderDayOfWeek: null,
          reminderDayOfMonth: null,
          reminderMonth: null,
          reminderAt: null,
          reminderHour: null,
          status: LoanStatus.PENDING,
        });
        this.assignReminderFields(
          loan,
          dto.installmentsCount,
          fields,
          reminderEnabled,
        );

        const savedLoan = await loanRepo.save(loan);
        const savedInstallments = await this.createInstallments(
          savedLoan,
          installmentRepo,
        );

        const expense = await this.expensesService.createInternal(
          userId,
          {
            accountId: savedLoan.accountId,
            name: `Préstamo a ${savedLoan.personName}`,
            amount: savedLoan.totalAmount,
            description: savedLoan.description,
            paymentMethod: ExpensePaymentMethod.CORRIENTE,
            sourceType: ExpenseSourceType.LOAN_CREATION,
            sourceId: savedLoan.id,
          },
          manager,
        );

        savedLoan.expenseId = expense.id;
        await loanRepo.save(savedLoan);

        return { loan: savedLoan, installments: savedInstallments };
      },
    );

    await this.scheduleReminders(loan, installments, timezone);

    return {
      data: { ...loan, installments },
      message: 'Préstamo registrado correctamente',
    };
  }

  /**
   * Lista los préstamos del usuario con `paidAmount` y `pendingAmount`, con
   * filtro opcional por estado.
   */
  async findAll(userId: string, query: QueryLoanDto) {
    const qb = this.loanRepository
      .createQueryBuilder('loan')
      .where('loan.userId = :userId', { userId })
      .andWhere('loan.isDeleted = false')
      .orderBy('loan.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('loan.status = :status', { status: query.status });
    }

    const loans = await qb.getMany();

    if (loans.length === 0) {
      return {
        data: [],
        message: 'Préstamos obtenidos correctamente',
      };
    }

    const installments = await this.installmentRepository.find({
      where: {
        loanId: In(loans.map((loan) => loan.id)),
        isDeleted: false,
      },
    });

    const paidMap = new Map<string, number>();
    const pendingMap = new Map<string, number>();
    for (const installment of installments) {
      const target = installment.isPaid ? paidMap : pendingMap;
      target.set(
        installment.loanId,
        MoneyUtil.round(
          MoneyUtil.add(target.get(installment.loanId) ?? 0, installment.amount),
        ),
      );
    }

    const data = loans.map((loan) => ({
      ...loan,
      paidAmount: paidMap.get(loan.id) ?? 0,
      pendingAmount: pendingMap.get(loan.id) ?? 0,
    }));

    return {
      data,
      message: 'Préstamos obtenidos correctamente',
    };
  }

  /**
   * Obtiene un préstamo con sus cuotas activas.
   */
  async findOne(userId: string, id: string) {
    const loan = await this.assertOwnership(userId, id);
    const installments = await this.getInstallments(loan.id);

    return {
      data: { ...loan, installments },
      message: 'Préstamo obtenido correctamente',
    };
  }

  /**
   * Actualiza un préstamo.
   * - `accountId` y `totalAmount` nunca se pueden cambiar: ya existe el egreso.
   * - Con cuotas pagadas: solo `personName`, `description` y recordatorio.
   * - Sin cuotas pagadas: permite cambiar el número de cuotas (regenera el plan).
   */
  async update(userId: string, id: string, dto: UpdateLoanDto) {
    const loan = await this.assertOwnership(userId, id);
    const existingInstallments = await this.getInstallments(loan.id);
    const hasPaid = existingInstallments.some((installment) => installment.isPaid);
    const timezone = await this.getTimezone(userId);

    if (dto.accountId !== undefined) {
      throw new BadRequestException(
        'No se puede modificar la cuenta de un préstamo (ya se generó el egreso)',
      );
    }

    if (dto.totalAmount !== undefined) {
      throw new BadRequestException(
        'No se puede modificar el monto de un préstamo (ya se generó el egreso)',
      );
    }

    if (hasPaid && dto.installmentsCount !== undefined) {
      throw new BadRequestException(
        'No se puede modificar el número de cuotas de un préstamo con cuotas pagadas',
      );
    }

    const oldCount = loan.installmentsCount;
    const newCount = dto.installmentsCount ?? oldCount;
    const reminderEnabled = dto.reminderEnabled ?? loan.reminderEnabled;
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
          : loan.reminderFrequency,
      reminderDayOfWeek:
        dto.reminderDayOfWeek !== undefined
          ? (dto.reminderDayOfWeek ?? null)
          : loan.reminderDayOfWeek,
      reminderDayOfMonth:
        dto.reminderDayOfMonth !== undefined
          ? (dto.reminderDayOfMonth ?? null)
          : loan.reminderDayOfMonth,
      reminderMonth:
        dto.reminderMonth !== undefined
          ? (dto.reminderMonth ?? null)
          : loan.reminderMonth,
      reminderAt:
        dto.reminderAt !== undefined
          ? (dto.reminderAt ?? null)
          : (loan.reminderAt ? loan.reminderAt.toISOString() : null),
      reminderHour:
        dto.reminderHour !== undefined
          ? (dto.reminderHour ?? null)
          : loan.reminderHour,
    };

    this.validateUpdateReminder(newCount, dto, fields, reminderEnabled);

    if (dto.personName !== undefined) {
      loan.personName = dto.personName;
    }
    if (dto.description !== undefined) {
      loan.description = dto.description ?? null;
    }
    loan.installmentsCount = newCount;
    this.assignReminderFields(loan, newCount, fields, reminderEnabled);

    const rebuild = !hasPaid && newCount !== oldCount;

    if (rebuild) {
      for (const installment of existingInstallments) {
        installment.isDeleted = true;
        installment.deletedAt = new Date();
      }
      if (existingInstallments.length > 0) {
        await this.installmentRepository.save(existingInstallments);
        await this.cancelReminders(existingInstallments);
      }

      loan.status = LoanStatus.PENDING;
      const savedLoan = await this.loanRepository.save(loan);
      const savedInstallments = await this.createInstallments(
        savedLoan,
        this.installmentRepository,
      );
      await this.scheduleReminders(savedLoan, savedInstallments, timezone);

      return {
        data: { ...savedLoan, installments: savedInstallments },
        message: 'Préstamo actualizado correctamente',
      };
    }

    const savedLoan = await this.loanRepository.save(loan);

    if (reminderChanged) {
      const pending = existingInstallments.filter(
        (installment) => !installment.isPaid,
      );

      if (pending.length > 0) {
        const plan = InstallmentScheduleBuilder.build({
          totalAmount: savedLoan.totalAmount,
          installments: savedLoan.installmentsCount,
          baseDate: new Date(),
          timezone,
          reminder: this.toReminderConfig(savedLoan),
        });
        const dueByNumber = new Map(plan.map((item) => [item.number, item.dueDate]));

        for (const installment of pending) {
          installment.dueDate = dueByNumber.get(installment.number) ?? null;
        }

        await this.installmentRepository.save(pending);
        await this.cancelReminders(pending);
        await this.scheduleReminders(savedLoan, pending, timezone);
      }
    }

    return {
      data: {
        ...savedLoan,
        installments: await this.getInstallments(savedLoan.id),
      },
      message: 'Préstamo actualizado correctamente',
    };
  }

  /**
   * Borrado lógico del préstamo y cancelación de sus recordatorios.
   * El egreso de creación y los ingresos ya generados se conservan.
   */
  async remove(userId: string, id: string) {
    const loan = await this.assertOwnership(userId, id);
    const installments = await this.getInstallments(loan.id);

    loan.isDeleted = true;
    loan.deletedAt = new Date();
    await this.loanRepository.save(loan);
    await this.cancelReminders(installments);

    return {
      data: null,
      message: 'Préstamo eliminado correctamente',
    };
  }

  /**
   * Paga una cuota: crea el ingreso (`LOAN_INSTALLMENT`) en la cuenta indicada,
   * marca la cuota, cancela su recordatorio y recalcula el estado.
   * Todo el movimiento monetario ocurre en una transacción.
   */
  async payInstallment(
    userId: string,
    loanId: string,
    installmentId: string,
    dto: PayLoanInstallmentDto,
  ) {
    const loan = await this.assertOwnership(userId, loanId);

    const installment = await this.installmentRepository.findOne({
      where: { id: installmentId, loanId, userId, isDeleted: false },
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
      const income = await this.incomesService.createFromSource(
        userId,
        {
          accountId: dto.accountId,
          name:
            dto.name ??
            `Préstamo ${loan.personName} (${installment.number}/${loan.installmentsCount})`,
          amount: installment.amount,
          description: dto.description ?? loan.description,
          date: paidAt,
          sourceType: IncomeSourceType.LOAN_INSTALLMENT,
          sourceId: installment.id,
        },
        manager,
      );

      installment.isPaid = true;
      installment.paidAt = paidAt;
      installment.incomeId = income.id;
      await manager.getRepository(LoanInstallment).save(installment);

      const loanStatus = await this.recalculateStatus(loan.id, manager);
      loan.status = loanStatus;
      await manager.getRepository(Loan).save(loan);

      return loanStatus;
    });

    await this.reminderService.cancelBySource(ReminderType.LOAN, installment.id);

    return {
      data: {
        installment: {
          number: installment.number,
          amount: installment.amount,
          isPaid: installment.isPaid,
          paidAt: installment.paidAt,
          incomeId: installment.incomeId,
        },
        loanStatus: status,
      },
      message: 'Cuota pagada correctamente',
    };
  }

  /**
   * Valida que el préstamo exista, no esté eliminado y pertenezca al usuario.
   */
  async assertOwnership(userId: string, id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!loan) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    return loan;
  }

  /**
   * Recalcula el estado del préstamo según sus cuotas activas.
   */
  private async recalculateStatus(
    loanId: string,
    manager?: EntityManager,
  ): Promise<LoanStatus> {
    const repo = manager
      ? manager.getRepository(LoanInstallment)
      : this.installmentRepository;

    const installments = await repo.find({
      where: { loanId, isDeleted: false },
    });

    if (installments.length === 0) {
      return LoanStatus.PENDING;
    }

    const paidCount = installments.filter(
      (installment) => installment.isPaid,
    ).length;

    if (paidCount === 0) {
      return LoanStatus.PENDING;
    }
    if (paidCount === installments.length) {
      return LoanStatus.PAID;
    }
    return LoanStatus.PARTIAL;
  }

  private async createInstallments(
    loan: Loan,
    repo: Repository<LoanInstallment>,
  ): Promise<LoanInstallment[]> {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: loan.totalAmount,
      installments: loan.installmentsCount,
      baseDate: new Date(),
      timezone: await this.getTimezone(loan.userId),
      reminder: this.toReminderConfig(loan),
    });

    const installments = plan.map((item) =>
      repo.create({
        userId: loan.userId,
        loanId: loan.id,
        number: item.number,
        amount: item.amount,
        dueDate: item.dueDate,
        isPaid: false,
        paidAt: null,
        incomeId: null,
      }),
    );

    return repo.save(installments);
  }

  private async getInstallments(
    loanId: string,
  ): Promise<LoanInstallment[]> {
    return this.installmentRepository.find({
      where: { loanId, isDeleted: false },
      order: { number: 'ASC' },
    });
  }

  private async scheduleReminders(
    loan: Loan,
    installments: LoanInstallment[],
    _timezone: string,
  ): Promise<void> {
    if (!loan.reminderEnabled) {
      return;
    }

    for (const installment of installments) {
      if (installment.isPaid || !installment.dueDate) {
        continue;
      }

      await this.reminderService.reschedule(
        ReminderType.LOAN,
        installment.id,
        {
          userId: loan.userId,
          type: ReminderType.LOAN,
          sourceId: installment.id,
          title: `Préstamo a ${loan.personName}`,
          body: `Se aproxima la cuota ${installment.number}/${loan.installmentsCount} del préstamo a ${loan.personName} por ${installment.amount}.`,
          scheduledAt: installment.dueDate,
        },
      );
    }
  }

  private async cancelReminders(
    installments: LoanInstallment[],
  ): Promise<void> {
    for (const installment of installments) {
      await this.reminderService.cancelBySource(
        ReminderType.LOAN,
        installment.id,
      );
    }
  }

  private toReminderConfig(loan: Loan): InstallmentReminderConfig {
    return {
      enabled: loan.reminderEnabled,
      frequency: loan.reminderFrequency,
      dayOfWeek: loan.reminderDayOfWeek,
      dayOfMonth: loan.reminderDayOfMonth,
      monthOfYear: loan.reminderMonth,
      at: loan.reminderAt,
      hour: loan.reminderHour,
    };
  }

  private fieldsFromCreateDto(dto: CreateLoanDto): ReminderFields {
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
    loan: Loan,
    installmentsCount: number,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    if (!reminderEnabled) {
      loan.reminderEnabled = false;
      loan.reminderFrequency = null;
      loan.reminderDayOfWeek = null;
      loan.reminderDayOfMonth = null;
      loan.reminderMonth = null;
      loan.reminderAt = null;
      loan.reminderHour = null;
      return;
    }

    loan.reminderEnabled = true;

    if (installmentsCount === 1) {
      loan.reminderFrequency = null;
      loan.reminderDayOfWeek = null;
      loan.reminderDayOfMonth = null;
      loan.reminderMonth = null;
      loan.reminderHour = null;
      loan.reminderAt = fields.reminderAt ? new Date(fields.reminderAt) : null;
      return;
    }

    loan.reminderAt = null;
    loan.reminderFrequency = fields.reminderFrequency;
    loan.reminderDayOfWeek = fields.reminderDayOfWeek;
    loan.reminderDayOfMonth = fields.reminderDayOfMonth;
    loan.reminderMonth = fields.reminderMonth;
    loan.reminderHour = fields.reminderHour;
  }

  /**
   * Reglas de recordatorio en la creación: campos prohibidos según el número de
   * cuotas (aunque `reminderEnabled` no se envíe) y campos obligatorios cuando
   * el recordatorio está activo.
   */
  private validateCreateReminder(
    dto: CreateLoanDto,
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
        'reminderAt solo aplica a un préstamo de una cuota única',
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
    dto: UpdateLoanDto,
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
        'reminderAt solo aplica a un préstamo de una cuota única',
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
