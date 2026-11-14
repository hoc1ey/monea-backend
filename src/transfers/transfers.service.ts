import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets } from 'typeorm';
import { Transfer } from './entities/transfer.entity.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { QueryTransferDto } from './dto/query-transfer.dto.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { Income } from '../incomes/entities/income.entity.js';
import {
  ExpenseSourceType,
  ExpensePaymentMethod,
} from '../expenses/expenses.constants.js';
import { IncomeSourceType } from '../incomes/incomes.constants.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { IncomesService } from '../incomes/incomes.service.js';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly expensesService: ExpensesService,
    private readonly incomesService: IncomesService,
  ) {}

  /**
   * Crea una transferencia entre dos cuentas del usuario: genera un egreso
   * corriente en la cuenta origen ("Transferencia a {destino}") y un ingreso
   * en la cuenta destino ("Transferencia desde {origen}"), todo en una transacción.
   */
  async create(userId: string, dto: CreateTransferDto) {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new BadRequestException(
        'La cuenta origen y la cuenta destino deben ser distintas',
      );
    }

    const sourceAccount = await this.accountsService.assertOwnership(
      userId,
      dto.sourceAccountId,
    );
    const destinationAccount = await this.accountsService.assertOwnership(
      userId,
      dto.destinationAccountId,
    );

    const date = dto.date ? new Date(dto.date) : new Date();

    const transfer = await this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(Transfer);

      const saved = await transferRepo.save(
        transferRepo.create({
          userId,
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id,
          amount: dto.amount,
          description: dto.description ?? null,
          date,
        }),
      );

      const expense = await this.expensesService.createInternal(
        userId,
        {
          accountId: sourceAccount.id,
          name: `Transferencia a ${destinationAccount.name}`,
          amount: dto.amount,
          description: dto.description ?? null,
          date,
          paymentMethod: ExpensePaymentMethod.CORRIENTE,
          sourceType: ExpenseSourceType.TRANSFER,
          sourceId: saved.id,
        },
        manager,
      );

      const income = await this.incomesService.createFromSource(
        userId,
        {
          accountId: destinationAccount.id,
          name: `Transferencia desde ${sourceAccount.name}`,
          amount: dto.amount,
          description: dto.description ?? null,
          date,
          sourceType: IncomeSourceType.TRANSFER,
          sourceId: saved.id,
        },
        manager,
      );

      saved.expenseId = expense.id;
      saved.incomeId = income.id;

      return transferRepo.save(saved);
    });

    return {
      data: transfer,
      message: 'Transferencia registrada correctamente',
    };
  }

  /**
   * Lista transferencias del usuario con filtros por cuenta (origen o destino),
   * rango de fechas y paginación. Ordenado por date DESC, createdAt DESC.
   */
  async findAll(userId: string, query: QueryTransferDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const qb = this.transferRepository
      .createQueryBuilder('transfer')
      .where('transfer.userId = :userId', { userId })
      .andWhere('transfer.isDeleted = false');

    if (query.accountId) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('transfer.sourceAccountId = :accountId', {
            accountId: query.accountId,
          }).orWhere('transfer.destinationAccountId = :accountId', {
            accountId: query.accountId,
          });
        }),
      );
    }

    if (query.from) {
      qb.andWhere('transfer.date >= :from', { from: new Date(query.from) });
    }

    if (query.to) {
      qb.andWhere('transfer.date <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('transfer.date', 'DESC')
      .addOrderBy('transfer.createdAt', 'DESC')
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
      message: 'Transferencias obtenidas correctamente',
    };
  }

  /**
   * Obtiene una transferencia validando pertenencia al usuario y borrado lógico.
   */
  async findOne(userId: string, id: string) {
    const transfer = await this.transferRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    return {
      data: transfer,
      message: 'Transferencia obtenida correctamente',
    };
  }

  /**
   * Borrado lógico de la transferencia junto con su egreso e ingreso
   * asociados, para que ambas cuentas recuperen el saldo.
   */
  async remove(userId: string, id: string) {
    const transfer = await this.transferRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    await this.dataSource.transaction(async (manager) => {
      transfer.isDeleted = true;
      transfer.deletedAt = new Date();
      await manager.getRepository(Transfer).save(transfer);

      if (transfer.expenseId) {
        const expense = await manager.getRepository(Expense).findOne({
          where: { id: transfer.expenseId, userId, isDeleted: false },
        });
        if (expense) {
          expense.isDeleted = true;
          expense.deletedAt = new Date();
          await manager.getRepository(Expense).save(expense);
        }
      }

      if (transfer.incomeId) {
        const income = await manager.getRepository(Income).findOne({
          where: { id: transfer.incomeId, userId, isDeleted: false },
        });
        if (income) {
          income.isDeleted = true;
          income.deletedAt = new Date();
          await manager.getRepository(Income).save(income);
        }
      }
    });

    return {
      data: null,
      message: 'Transferencia eliminada correctamente',
    };
  }
}
