import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { MoneyUtil } from '../common/utils/money.util.js';

@Injectable()
export class AccountsService {
  private movementsTablesExist: boolean | null = null;

  constructor(
    @InjectRepository(Account)
    protected readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Verifica de forma segura si las tablas 'incomes' y 'expenses' existen en la base de datos.
   * Permite que F02 funcione independientemente y se integre automáticamente cuando se implementen F04/F06.
   */
  private async checkMovementsTablesExist(): Promise<boolean> {
    if (this.movementsTablesExist !== null) {
      return this.movementsTablesExist;
    }
    try {
      const result = (await this.accountRepository.query(
        `SELECT to_regclass('public.incomes') AS incomes, to_regclass('public.expenses') AS expenses`,
      )) as Array<{ incomes: string | null; expenses: string | null }>;
      this.movementsTablesExist = !!(result[0]?.incomes && result[0]?.expenses);
      return this.movementsTablesExist;
    } catch {
      return false;
    }
  }

  /**
   * Calcula el saldo actual de una cuenta bancaria a partir de movimientos:
   * initialBalance + Σ ingresos (isDeleted=false) − Σ egresos con paymentMethod=CORRIENTE (isDeleted=false).
   * Los egresos diferidos no descuentan de la cuenta hasta que se paga la tarjeta (F07).
   */
  private async calculateAccountBalance(account: Account): Promise<number> {
    const hasTables = await this.checkMovementsTablesExist();
    if (!hasTables) {
      return MoneyUtil.round(account.initialBalance);
    }

    const rawResult = (await this.accountRepository.query(
      `
      SELECT 
        COALESCE((
          SELECT SUM(amount) 
          FROM incomes 
          WHERE "accountId" = $1 AND "isDeleted" = false
        ), 0) AS total_incomes,
        COALESCE((
          SELECT SUM(amount) 
          FROM expenses 
          WHERE "accountId" = $1 AND "paymentMethod" = 'CORRIENTE' AND "isDeleted" = false
        ), 0) AS total_expenses
      `,
      [account.id],
    )) as Array<{ total_incomes: string | number; total_expenses: string | number }>;

    const totalIncomes = Number(rawResult[0]?.total_incomes ?? 0);
    const totalExpenses = Number(rawResult[0]?.total_expenses ?? 0);

    return MoneyUtil.round(
      MoneyUtil.subtract(
        MoneyUtil.add(account.initialBalance, totalIncomes),
        totalExpenses,
      ),
    );
  }

  /**
   * Valida que la cuenta exista, no esté eliminada y pertenezca al usuario autenticado.
   * Reutilizable por otros módulos (Income, Expense, Loan, etc.).
   * Si no pertenece al usuario o está eliminada, lanza NotFoundException.
   */
  async assertOwnership(userId: string, accountId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, userId, isDeleted: false },
    });

    if (!account) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    return account;
  }

  /**
   * Expone el cálculo de saldo para que otros módulos lo reutilicen (F04, F06, F07, etc.).
   */
  async getBalance(accountId: string, userId: string): Promise<number> {
    const account = await this.assertOwnership(userId, accountId);
    return this.calculateAccountBalance(account);
  }

  /**
   * Crea una nueva cuenta bancaria asociada al usuario autenticado.
   */
  async create(userId: string, dto: CreateAccountDto) {
    const account = this.accountRepository.create({
      userId,
      name: dto.name,
      financialInstitution: dto.financialInstitution,
      color: dto.color,
      initialBalance: dto.initialBalance,
      description: dto.description ?? null,
    });

    const saved = await this.accountRepository.save(account);

    return {
      data: {
        ...saved,
        currentBalance: MoneyUtil.round(saved.initialBalance),
      },
      message: 'Cuenta creada correctamente',
    };
  }

  /**
   * Lista todas las cuentas activas del usuario con currentBalance calculado en 1 query agregada (sin N+1).
   */
  async findAll(userId: string) {
    const hasTables = await this.checkMovementsTablesExist();

    let accountsWithBalance: Array<Account & { currentBalance: number }>;

    if (hasTables) {
      const qb = this.accountRepository
        .createQueryBuilder('account')
        .where('account.userId = :userId', { userId })
        .andWhere('account.isDeleted = false')
        .orderBy('account.createdAt', 'DESC')
        .addSelect(
          `ROUND(
            account."initialBalance"
            + COALESCE((SELECT SUM(inc.amount) FROM incomes inc WHERE inc."accountId" = account.id AND inc."isDeleted" = false), 0)
            - COALESCE((SELECT SUM(exp.amount) FROM expenses exp WHERE exp."accountId" = account.id AND exp."paymentMethod" = 'CORRIENTE' AND exp."isDeleted" = false), 0),
            2
          )`,
          'calculated_balance',
        );

      const { entities, raw } = await qb.getRawAndEntities();

      accountsWithBalance = entities.map((account, index) => ({
        ...account,
        currentBalance: Number(
          raw[index]?.calculated_balance ?? account.initialBalance,
        ),
      }));
    } else {
      const accounts = await this.accountRepository.find({
        where: { userId, isDeleted: false },
        order: { createdAt: 'DESC' },
      });

      accountsWithBalance = accounts.map((account) => ({
        ...account,
        currentBalance: MoneyUtil.round(account.initialBalance),
      }));
    }

    return {
      data: accountsWithBalance,
      message: 'Cuentas obtenidas correctamente',
    };
  }

  /**
   * Obtiene una cuenta específica del usuario autenticado con su saldo actual calculado.
   */
  async findOne(userId: string, id: string) {
    const account = await this.assertOwnership(userId, id);
    const currentBalance = await this.calculateAccountBalance(account);

    return {
      data: {
        ...account,
        currentBalance,
      },
      message: 'Cuenta obtenida correctamente',
    };
  }

  /**
   * Actualiza una cuenta bancaria. Permite editar alias, institución, color, descripción y saldo inicial.
   * Si se edita el saldo inicial, se informa en el mensaje que modifica el saldo calculado actual.
   */
  async update(userId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.assertOwnership(userId, id);

    const initialBalanceModified =
      dto.initialBalance !== undefined &&
      dto.initialBalance !== account.initialBalance;

    if (dto.name !== undefined) {
      account.name = dto.name;
    }
    if (dto.financialInstitution !== undefined) {
      account.financialInstitution = dto.financialInstitution;
    }
    if (dto.color !== undefined) {
      account.color = dto.color;
    }
    if (dto.initialBalance !== undefined) {
      account.initialBalance = dto.initialBalance;
    }
    if (dto.description !== undefined) {
      account.description = dto.description;
    }

    const updated = await this.accountRepository.save(account);
    const currentBalance = await this.calculateAccountBalance(updated);

    const message = initialBalanceModified
      ? 'Cuenta actualizada correctamente (el saldo inicial fue modificado y afectó el saldo calculado actual)'
      : 'Cuenta actualizada correctamente';

    return {
      data: {
        ...updated,
        currentBalance,
      },
      message,
    };
  }

  /**
   * Borrado lógico de una cuenta bancaria (isDeleted = true, deletedAt = fecha actual).
   * Los registros de ingresos/egresos históricos se conservan.
   */
  async remove(userId: string, id: string) {
    const account = await this.assertOwnership(userId, id);

    account.isDeleted = true;
    account.deletedAt = new Date();
    await this.accountRepository.save(account);

    return {
      data: null,
      message: 'Cuenta eliminada correctamente',
    };
  }
}
