import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Expense } from './entities/expense.entity.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { QueryExpenseDto } from './dto/query-expense.dto.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from './expenses.constants.js';
import { AccountsService } from '../accounts/accounts.service.js';

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

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    protected readonly expenseRepository: Repository<Expense>,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Registra un egreso corriente (instantáneo) manual.
   */
  async create(userId: string, dto: CreateExpenseDto) {
    await this.accountsService.assertOwnership(userId, dto.accountId);

    const paymentMethod = dto.paymentMethod ?? ExpensePaymentMethod.CORRIENTE;

    if (paymentMethod === ExpensePaymentMethod.DIFERIDO) {
      throw new BadRequestException(
        'Los egresos diferidos aún no están disponibles',
      );
    }
    if (
      dto.creditCardId != null ||
      dto.installments != null ||
      dto.graceMonths != null
    ) {
      throw new BadRequestException(
        'creditCardId, installments y graceMonths solo aplican a egresos diferidos',
      );
    }

    const expense = this.expenseRepository.create({
      userId,
      accountId: dto.accountId,
      name: dto.name,
      amount: dto.amount,
      description: dto.description ?? null,
      date: dto.date ? new Date(dto.date) : new Date(),
      paymentMethod: ExpensePaymentMethod.CORRIENTE,
      creditCardId: null,
      installments: null,
      graceMonths: 0,
      amountPending: false,
      recurringConfigId: null,
      sourceType: ExpenseSourceType.MANUAL,
      sourceId: null,
    });

    const saved = await this.expenseRepository.save(expense);

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

    const repo = manager
      ? manager.getRepository(Expense)
      : this.expenseRepository;

    const expense = repo.create({
      userId,
      accountId: input.accountId,
      name: input.name,
      amount: input.amount,
      description: input.description ?? null,
      date: input.date ?? new Date(),
      paymentMethod: ExpensePaymentMethod.CORRIENTE,
      creditCardId: null,
      installments: null,
      graceMonths: 0,
      amountPending: input.amountPending ?? false,
      recurringConfigId: input.recurringConfigId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });

    return repo.save(expense);
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
   * Obtiene un egreso validando pertenencia al usuario.
   */
  async findOne(userId: string, id: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!expense) {
      throw new NotFoundException('Egreso no encontrado');
    }

    return {
      data: expense,
      message: 'Egreso obtenido correctamente',
    };
  }

  /**
   * Actualiza un egreso corriente.
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

    if (
      dto.creditCardId !== undefined ||
      dto.installments !== undefined ||
      dto.graceMonths !== undefined
    ) {
      throw new BadRequestException(
        'creditCardId, installments y graceMonths solo aplican a egresos diferidos',
      );
    }

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

    const updated = await this.expenseRepository.save(expense);

    return {
      data: updated,
      message: 'Egreso actualizado correctamente',
    };
  }

  /**
   * Borrado lógico del egreso. No permite eliminar egresos de origen automático.
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

    expense.isDeleted = true;
    expense.deletedAt = new Date();
    await this.expenseRepository.save(expense);

    return {
      data: null,
      message: 'Egreso eliminado correctamente',
    };
  }
}
