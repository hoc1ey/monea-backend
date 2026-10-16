import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Expense } from './entities/expense.entity.js';
import { ExpenseInstallment } from './entities/expense-installment.entity.js';
import { CreditCard } from '../credit-cards/entities/credit-card.entity.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { QueryExpenseDto } from './dto/query-expense.dto.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from './expenses.constants.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { CreditCardsService } from '../credit-cards/credit-cards.service.js';
import { InstallmentUtil } from '../common/utils/installment.util.js';

export interface CreateExpenseInternalInput {
  accountId: string;
  name: string;
  amount: number;
  description?: string | null;
  date?: Date;
  paymentMethod?: ExpensePaymentMethod;
  creditCardId?: string | null;
  installments?: number | null;
  graceMonths?: number;
  amountPending?: boolean;
  recurringConfigId?: string | null;
  sourceType: ExpenseSourceType;
  sourceId: string | null;
}

interface PersistExpenseParams {
  userId: string;
  accountId: string;
  name: string;
  amount: number;
  description: string | null;
  date: Date;
  paymentMethod: ExpensePaymentMethod;
  creditCardId: string | null;
  installments: number | null;
  graceMonths: number;
  amountPending: boolean;
  recurringConfigId: string | null;
  sourceType: ExpenseSourceType;
  sourceId: string | null;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    protected readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseInstallment)
    protected readonly installmentRepository: Repository<ExpenseInstallment>,
    private readonly dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly creditCardsService: CreditCardsService,
  ) {}

  /**
   * Registra un egreso manual. Si es DIFERIDO valida la tarjeta y genera el
   * plan de cuotas dentro de la misma transacción.
   */
  async create(userId: string, dto: CreateExpenseDto) {
    await this.accountsService.assertOwnership(userId, dto.accountId);

    const paymentMethod = dto.paymentMethod ?? ExpensePaymentMethod.CORRIENTE;
    let card: CreditCard | null = null;

    if (paymentMethod === ExpensePaymentMethod.DIFERIDO) {
      if (!dto.creditCardId || dto.installments == null) {
        throw new BadRequestException(
          'Los egresos diferidos requieren creditCardId e installments (>= 1)',
        );
      }
      card = await this.creditCardsService.assertOwnership(
        userId,
        dto.creditCardId,
      );
    } else if (
      dto.creditCardId != null ||
      dto.installments != null ||
      dto.graceMonths != null
    ) {
      throw new BadRequestException(
        'creditCardId, installments y graceMonths solo aplican a egresos diferidos',
      );
    }

    const saved = await this.dataSource.transaction((manager) =>
      this.saveExpenseWithInstallments(
        manager,
        {
          userId,
          accountId: dto.accountId,
          name: dto.name,
          amount: dto.amount,
          description: dto.description ?? null,
          date: dto.date ? new Date(dto.date) : new Date(),
          paymentMethod,
          creditCardId: card?.id ?? null,
          installments:
            paymentMethod === ExpensePaymentMethod.DIFERIDO
              ? (dto.installments ?? null)
              : null,
          graceMonths:
            paymentMethod === ExpensePaymentMethod.DIFERIDO
              ? (dto.graceMonths ?? 0)
              : 0,
          amountPending: false,
          recurringConfigId: null,
          sourceType: ExpenseSourceType.MANUAL,
          sourceId: null,
        },
        card,
      ),
    );

    return {
      data: saved,
      message: 'Egreso registrado correctamente',
    };
  }

  /**
   * Método transaccional para uso de F07, F08, F10, F11 y F12.
   * Acepta un EntityManager opcional para participar en transacciones externas.
   */
  async createInternal(
    userId: string,
    input: CreateExpenseInternalInput,
    manager?: EntityManager,
  ): Promise<Expense> {
    await this.accountsService.assertOwnership(userId, input.accountId);

    const paymentMethod = input.paymentMethod ?? ExpensePaymentMethod.CORRIENTE;
    let card: CreditCard | null = null;

    if (paymentMethod === ExpensePaymentMethod.DIFERIDO) {
      if (!input.creditCardId || input.installments == null) {
        throw new BadRequestException(
          'Los egresos diferidos requieren creditCardId e installments (>= 1)',
        );
      }
      card = await this.creditCardsService.assertOwnership(
        userId,
        input.creditCardId,
      );
    }

    const run = (em: EntityManager) =>
      this.saveExpenseWithInstallments(
        em,
        {
          userId,
          accountId: input.accountId,
          name: input.name,
          amount: input.amount,
          description: input.description ?? null,
          date: input.date ?? new Date(),
          paymentMethod,
          creditCardId: card?.id ?? null,
          installments:
            paymentMethod === ExpensePaymentMethod.DIFERIDO
              ? (input.installments ?? null)
              : null,
          graceMonths:
            paymentMethod === ExpensePaymentMethod.DIFERIDO
              ? (input.graceMonths ?? 0)
              : 0,
          amountPending: input.amountPending ?? false,
          recurringConfigId: input.recurringConfigId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
        card,
      );

    if (manager) {
      return run(manager);
    }
    return this.dataSource.transaction(run);
  }

  /**
   * Lista egresos del usuario con filtros y paginación.
   */
  async findAll(userId: string, query: QueryExpenseDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.userId = :userId', { userId })
      .andWhere('expense.isDeleted = false');

    if (query.accountId) {
      qb.andWhere('expense.accountId = :accountId', {
        accountId: query.accountId,
      });
    }

    if (query.creditCardId) {
      qb.andWhere('expense.creditCardId = :creditCardId', {
        creditCardId: query.creditCardId,
      });
    }

    if (query.paymentMethod) {
      qb.andWhere('expense.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }

    if (query.amountPending !== undefined) {
      qb.andWhere('expense.amountPending = :amountPending', {
        amountPending: query.amountPending,
      });
    }

    if (query.from) {
      qb.andWhere('expense.date >= :from', { from: new Date(query.from) });
    }

    if (query.to) {
      qb.andWhere('expense.date <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('expense.date', 'DESC')
      .addOrderBy('expense.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: {
        items,
        total,
        page,
        limit,
        totalPages,
      },
      message: 'Egresos obtenidos correctamente',
    };
  }

  /**
   * Obtiene un egreso validando pertenencia al usuario. Incluye las cuotas
   * cuando el egreso es diferido.
   */
  async findOne(userId: string, id: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!expense) {
      throw new NotFoundException('Egreso no encontrado');
    }

    if (expense.paymentMethod === ExpensePaymentMethod.DIFERIDO) {
      expense.expenseInstallments = await this.installmentRepository.find({
        where: { expenseId: expense.id, userId, isDeleted: false },
        order: { number: 'ASC' },
      });
    }

    return {
      data: expense,
      message: 'Egreso obtenido correctamente',
    };
  }

  /**
   * Actualiza un egreso. No permite cambiar el método de pago. Si alguna cuota
   * ya fue pagada no permite tocar monto, cuotas, gracia ni tarjeta. Si cambian
   * monto/cuotas/gracia y ninguna cuota está pagada, regenera el plan.
   */
  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.expenseRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!expense) {
      throw new NotFoundException('Egreso no encontrado');
    }

    if (
      dto.paymentMethod !== undefined &&
      dto.paymentMethod !== expense.paymentMethod
    ) {
      throw new BadRequestException(
        'No se puede cambiar el método de pago de un egreso',
      );
    }

    const isDiferido =
      expense.paymentMethod === ExpensePaymentMethod.DIFERIDO;

    if (!isDiferido) {
      if (
        dto.creditCardId !== undefined ||
        dto.installments !== undefined ||
        dto.graceMonths !== undefined
      ) {
        throw new BadRequestException(
          'creditCardId, installments y graceMonths solo aplican a egresos diferidos',
        );
      }
    }

    let currentInstallments: ExpenseInstallment[] = [];
    if (isDiferido) {
      currentInstallments = await this.installmentRepository.find({
        where: { expenseId: expense.id, userId, isDeleted: false },
        order: { number: 'ASC' },
      });
    }

    const anyPaid = currentInstallments.some((i) => i.isPaid);

    if (anyPaid) {
      const touchesPlan =
        dto.amount !== undefined ||
        dto.creditCardId !== undefined ||
        dto.installments !== undefined ||
        dto.graceMonths !== undefined;
      if (touchesPlan) {
        throw new BadRequestException(
          'No se puede modificar el monto, la tarjeta ni las cuotas de un egreso con cuotas ya pagadas',
        );
      }
    }

    let nextCard: CreditCard | null = null;
    if (isDiferido && dto.creditCardId !== undefined && !anyPaid) {
      if (dto.creditCardId !== expense.creditCardId) {
        nextCard = await this.creditCardsService.assertOwnership(
          userId,
          dto.creditCardId,
        );
      }
    }

    const nextAmount = dto.amount ?? expense.amount;
    const nextInstallments = dto.installments ?? expense.installments;
    const nextGraceMonths = dto.graceMonths ?? expense.graceMonths;
    const nextCardId = nextCard?.id ?? expense.creditCardId;

    const planChanged =
      isDiferido &&
      !anyPaid &&
      (nextAmount !== expense.amount ||
        nextInstallments !== expense.installments ||
        nextGraceMonths !== expense.graceMonths ||
        nextCardId !== expense.creditCardId);

    if (nextCardId === null && isDiferido) {
      throw new BadRequestException(
        'Los egresos diferidos requieren una tarjeta de crédito',
      );
    }
    if (isDiferido && nextInstallments == null) {
      throw new BadRequestException(
        'Los egresos diferidos requieren un número de cuotas',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const expenseRepo = manager.getRepository(Expense);

      if (dto.name !== undefined) {
        expense.name = dto.name;
      }
      if (dto.description !== undefined) {
        expense.description = dto.description ?? null;
      }
      if (dto.date !== undefined) {
        expense.date = new Date(dto.date);
      }
      if (dto.amount !== undefined) {
        expense.amount = dto.amount;
      }

      if (planChanged) {
        const oldInstallments = await manager
          .getRepository(ExpenseInstallment)
          .find({
            where: { expenseId: expense.id, userId, isDeleted: false },
          });

        for (const installment of oldInstallments) {
          installment.isDeleted = true;
          installment.deletedAt = new Date();
        }
        if (oldInstallments.length > 0) {
          await manager.getRepository(ExpenseInstallment).save(oldInstallments);
        }

        expense.creditCardId = nextCardId;
        expense.installments = nextInstallments;
        expense.graceMonths = nextGraceMonths;

        const card =
          nextCard ??
          (await this.creditCardsService.assertOwnership(
            userId,
            nextCardId as string,
          ));

        const saved = await expenseRepo.save(expense);
        await this.persistInstallments(
          manager,
          saved,
          card,
          saved.amount,
          nextInstallments as number,
          nextGraceMonths,
        );

        return saved;
      }

      return expenseRepo.save(expense);
    });

    return this.findOne(userId, id).then((result) => ({
      data: result.data,
      message: 'Egreso actualizado correctamente',
    }));
  }

  /**
   * Borrado lógico del egreso y sus cuotas. No permite eliminar egresos de
   * origen automático ni egresos con cuotas ya pagadas.
   */
  async remove(userId: string, id: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!expense) {
      throw new NotFoundException('Egreso no encontrado');
    }

    if (
      expense.sourceType !== ExpenseSourceType.MANUAL &&
      expense.sourceType !== ExpenseSourceType.RECURRING
    ) {
      throw new BadRequestException(
        'No se puede eliminar un egreso generado automáticamente; debe revertirse desde su módulo de origen',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const installments = await manager.getRepository(ExpenseInstallment).find({
        where: { expenseId: expense.id, userId, isDeleted: false },
      });

      if (installments.some((i) => i.isPaid)) {
        throw new BadRequestException(
          'No se puede eliminar un egreso con cuotas ya pagadas',
        );
      }

      for (const installment of installments) {
        installment.isDeleted = true;
        installment.deletedAt = new Date();
      }
      if (installments.length > 0) {
        await manager.getRepository(ExpenseInstallment).save(installments);
      }

      expense.isDeleted = true;
      expense.deletedAt = new Date();
      await manager.getRepository(Expense).save(expense);
    });

    return {
      data: null,
      message: 'Egreso eliminado correctamente',
    };
  }

  /**
   * Persiste el egreso y, si es diferido, genera y guarda su plan de cuotas
   * dentro del EntityManager recibido.
   */
  private async saveExpenseWithInstallments(
    manager: EntityManager,
    params: PersistExpenseParams,
    card: CreditCard | null,
  ): Promise<Expense> {
    const repo = manager.getRepository(Expense);

    const expense = repo.create({
      userId: params.userId,
      accountId: params.accountId,
      name: params.name,
      amount: params.amount,
      description: params.description,
      date: params.date,
      paymentMethod: params.paymentMethod,
      creditCardId: params.creditCardId,
      installments: params.installments,
      graceMonths: params.graceMonths,
      amountPending: params.amountPending,
      recurringConfigId: params.recurringConfigId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    });

    const saved = await repo.save(expense);

    if (
      saved.paymentMethod === ExpensePaymentMethod.DIFERIDO &&
      card &&
      saved.installments != null
    ) {
      saved.expenseInstallments = await this.persistInstallments(
        manager,
        saved,
        card,
        saved.amount,
        saved.installments,
        saved.graceMonths,
      );
    }

    return saved;
  }

  /**
   * Genera y guarda las cuotas del egreso diferido usando `buildInstallmentSchedule`.
   */
  private async persistInstallments(
    manager: EntityManager,
    expense: Expense,
    card: CreditCard,
    amount: number,
    installments: number,
    graceMonths: number,
  ): Promise<ExpenseInstallment[]> {
    const schedule = InstallmentUtil.buildInstallmentSchedule({
      date: expense.date,
      amount,
      installments,
      graceMonths,
      cutoffDay: card.cutoffDay,
    });

    const repo = manager.getRepository(ExpenseInstallment);

    const rows = schedule.map((item) =>
      repo.create({
        userId: expense.userId,
        expenseId: expense.id,
        creditCardId: card.id,
        number: item.number,
        amount: item.amount,
        period: item.period,
        isPaid: false,
        cardPaymentId: null,
      }),
    );

    return repo.save(rows);
  }
}
