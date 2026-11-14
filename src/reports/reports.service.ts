import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Income } from '../incomes/entities/income.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { Account } from '../accounts/entities/account.entity.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { QueryReportDto } from './dto/query-report.dto.js';
import { DateUtil } from '../common/utils/date.util.js';
import { MoneyUtil } from '../common/utils/money.util.js';

const HISTORY_MONTHS = 5;

interface PeriodTotalRow {
  period: string;
  total: string | number;
}

interface TotalRow {
  total: string | number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Income)
    private readonly incomeRepository: Repository<Income>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Devuelve los 5 periodos (mes actual + 4 anteriores) ordenados del más antiguo al más reciente.
   */
  private getHistoryPeriods(): string[] {
    const currentIndex = DateUtil.periodToIndex(DateUtil.formatPeriod(new Date()));
    return Array.from({ length: HISTORY_MONTHS }, (_, i) =>
      DateUtil.indexToPeriod(currentIndex - (HISTORY_MONTHS - 1 - i)),
    );
  }

  /**
   * Instante UTC de medianoche del primer día del periodo YYYY-MM.
   */
  private periodStart(period: string): Date {
    const [year, month] = period.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  }

  /**
   * Valida la pertenencia de la cuenta filtrada (404, nunca 403).
   */
  private async assertAccountFilter(userId: string, accountId?: string): Promise<void> {
    if (accountId) {
      await this.accountsService.assertOwnership(userId, accountId);
    }
  }

  /**
   * Agrega la condición opcional de cuenta a una consulta SQL.
   */
  private appendAccountCondition(sql: string, params: unknown[], accountId?: string): string {
    if (accountId) {
      params.push(accountId);
      return `${sql} AND "accountId" = $${params.length}`;
    }
    return sql;
  }

  /**
   * Suma de ingresos agrupados por periodo YYYY-MM (UTC) dentro de una ventana de fechas.
   */
  private async sumIncomesByPeriod(
    userId: string,
    from: Date,
    to: Date,
    accountId?: string,
  ): Promise<Map<string, number>> {
    const params: unknown[] = [userId, from, to];
    let sql = `SELECT to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM') AS period, COALESCE(SUM(amount), 0) AS total
      FROM incomes
      WHERE "userId" = $1 AND "isDeleted" = false AND "date" >= $2 AND "date" < $3`;
    sql = this.appendAccountCondition(sql, params, accountId);
    sql += ` GROUP BY 1`;

    const rows = (await this.incomeRepository.query(sql, params)) as PeriodTotalRow[];
    return new Map(rows.map((row) => [row.period, Number(row.total)]));
  }

  /**
   * Suma de egresos agrupados por periodo YYYY-MM (UTC) dentro de una ventana de fechas.
   * paymentMethod='CORRIENTE' limita el cálculo a los egresos que afectan el saldo.
   */
  private async sumExpensesByPeriod(
    userId: string,
    from: Date,
    to: Date,
    accountId?: string,
    onlyCorriente = false,
  ): Promise<Map<string, number>> {
    const params: unknown[] = [userId, from, to];
    let sql = `SELECT to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM') AS period, COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE "userId" = $1 AND "isDeleted" = false AND "date" >= $2 AND "date" < $3`;
    if (onlyCorriente) {
      sql += ` AND "paymentMethod" = 'CORRIENTE'`;
    }
    sql = this.appendAccountCondition(sql, params, accountId);
    sql += ` GROUP BY 1`;

    const rows = (await this.expenseRepository.query(sql, params)) as PeriodTotalRow[];
    return new Map(rows.map((row) => [row.period, Number(row.total)]));
  }

  /**
   * Suma de ingresos dentro de una ventana de fechas (sin agrupar).
   */
  private async sumIncomes(
    userId: string,
    from: Date,
    to: Date,
    accountId?: string,
  ): Promise<number> {
    const params: unknown[] = [userId, from, to];
    let sql = `SELECT COALESCE(SUM(amount), 0) AS total
      FROM incomes
      WHERE "userId" = $1 AND "isDeleted" = false AND "date" >= $2 AND "date" < $3`;
    sql = this.appendAccountCondition(sql, params, accountId);

    const rows = (await this.incomeRepository.query(sql, params)) as TotalRow[];
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Suma de egresos dentro de una ventana de fechas (sin agrupar).
   * paymentMethod='CORRIENTE' limita el cálculo a los egresos que afectan el saldo.
   */
  private async sumExpenses(
    userId: string,
    from: Date,
    to: Date,
    accountId?: string,
    onlyCorriente = false,
  ): Promise<number> {
    const params: unknown[] = [userId, from, to];
    let sql = `SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE "userId" = $1 AND "isDeleted" = false AND "date" >= $2 AND "date" < $3`;
    if (onlyCorriente) {
      sql += ` AND "paymentMethod" = 'CORRIENTE'`;
    }
    sql = this.appendAccountCondition(sql, params, accountId);

    const rows = (await this.expenseRepository.query(sql, params)) as TotalRow[];
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Sumatoria de ingresos y egresos del mes actual (por separado).
   * Los egresos incluyen todos los métodos de pago (CORRIENTE + DIFERIDO).
   */
  async getMonthlySummary(userId: string, query: QueryReportDto) {
    await this.assertAccountFilter(userId, query.accountId);

    const period = DateUtil.formatPeriod(new Date());
    const start = this.periodStart(period);
    const end = this.periodStart(
      DateUtil.indexToPeriod(DateUtil.periodToIndex(period) + 1),
    );

    const [totalIncomes, totalExpenses] = await Promise.all([
      this.sumIncomes(userId, start, end, query.accountId),
      this.sumExpenses(userId, start, end, query.accountId),
    ]);

    return {
      data: {
        period,
        totalIncomes: MoneyUtil.round(totalIncomes),
        totalExpenses: MoneyUtil.round(totalExpenses),
        net: MoneyUtil.round(MoneyUtil.subtract(totalIncomes, totalExpenses)),
      },
      message: 'Resumen mensual obtenido correctamente',
    };
  }

  /**
   * Sumatoria mensual de ingresos y egresos del mes actual y los 4 meses anteriores.
   * Los egresos incluyen todos los métodos de pago (CORRIENTE + DIFERIDO).
   * Los meses sin movimientos se reportan en 0.
   */
  async getMonthlyHistory(userId: string, query: QueryReportDto) {
    await this.assertAccountFilter(userId, query.accountId);

    const periods = this.getHistoryPeriods();
    const start = this.periodStart(periods[0]);
    const end = this.periodStart(
      DateUtil.indexToPeriod(DateUtil.periodToIndex(periods[periods.length - 1]) + 1),
    );

    const [incomeTotals, expenseTotals] = await Promise.all([
      this.sumIncomesByPeriod(userId, start, end, query.accountId),
      this.sumExpensesByPeriod(userId, start, end, query.accountId),
    ]);

    const items = periods.map((period) => {
      const totalIncomes = MoneyUtil.round(incomeTotals.get(period) ?? 0);
      const totalExpenses = MoneyUtil.round(expenseTotals.get(period) ?? 0);
      return {
        period,
        totalIncomes,
        totalExpenses,
        net: MoneyUtil.round(MoneyUtil.subtract(totalIncomes, totalExpenses)),
      };
    });

    return {
      data: { items },
      message: 'Historial mensual obtenido correctamente',
    };
  }

  /**
   * Balance general de la(s) cuenta(s) al cierre del mes actual y los 4 meses anteriores.
   * Réplica de AccountsService.calculateAccountBalance por mes:
   * saldos iniciales + Σ ingresos − Σ egresos CORRIENTE, acumulados hasta el fin de cada mes.
   * Los egresos diferidos no descuentan hasta que se paga la tarjeta (F07).
   */
  async getBalanceHistory(userId: string, query: QueryReportDto) {
    await this.assertAccountFilter(userId, query.accountId);

    const periods = this.getHistoryPeriods();
    const start = this.periodStart(periods[0]);
    const end = this.periodStart(
      DateUtil.indexToPeriod(DateUtil.periodToIndex(periods[periods.length - 1]) + 1),
    );

    const accountParams: unknown[] = [userId];
    let accountSql = `SELECT COALESCE(SUM("initialBalance"), 0) AS total
      FROM accounts
      WHERE "userId" = $1 AND "isDeleted" = false`;
    accountSql = this.appendAccountCondition(accountSql, accountParams, query.accountId);
    const accountRows = (await this.accountRepository.query(accountSql, accountParams)) as TotalRow[];
    const initialBalance = Number(accountRows[0]?.total ?? 0);

    const [beforeIncomes, beforeExpenses, incomeTotals, expenseTotals] = await Promise.all([
      this.sumIncomes(userId, new Date(0), start, query.accountId),
      this.sumExpenses(userId, new Date(0), start, query.accountId, true),
      this.sumIncomesByPeriod(userId, start, end, query.accountId),
      this.sumExpensesByPeriod(userId, start, end, query.accountId, true),
    ]);

    let running = MoneyUtil.subtract(
      MoneyUtil.add(initialBalance, beforeIncomes),
      beforeExpenses,
    );

    const items = periods.map((period) => {
      running = MoneyUtil.round(
        MoneyUtil.add(
          running,
          MoneyUtil.subtract(incomeTotals.get(period) ?? 0, expenseTotals.get(period) ?? 0),
        ),
      );
      return { period, balance: running };
    });

    return {
      data: { items },
      message: 'Balance general obtenido correctamente',
    };
  }
}
