import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { CreditCard } from './entities/credit-card.entity.js';
import { CreditCardPayment } from './entities/credit-card-payment.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { ExpenseInstallment } from '../expenses/entities/expense-installment.entity.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from '../expenses/expenses.constants.js';
import { CreditCardsService } from './credit-cards.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { UsersService } from '../users/users.service.js';
import { MoneyUtil } from '../common/utils/money.util.js';
import { DateUtil } from '../common/utils/date.util.js';

export interface CreditCardReportItem {
  name: string;
  installmentNumber: number;
  installmentsTotal: number;
  amount: number;
}

export interface CreditCardMonthlyReport {
  period: string;
  total: number;
  paid: boolean;
  paidAt: Date | null;
  cutoffDate: string | null;
  paymentDate: string | null;
  items: CreditCardReportItem[];
}

export interface CreditCardRangeMonth {
  period: string;
  total: number;
  paid: boolean;
}

export interface CreditCardRangeReport {
  months: CreditCardRangeMonth[];
  grandTotal: number;
}

export interface CreditCardDebt {
  currentDebt: number;
  upcoming: number;
  totalPending: number;
  creditLimit: number | null;
  availableCredit: number | null;
}

const MAX_RANGE_MONTHS = 24;

@Injectable()
export class CreditCardBillingService {
  constructor(
    @InjectRepository(CreditCardPayment)
    private readonly paymentRepository: Repository<CreditCardPayment>,
    @InjectRepository(ExpenseInstallment)
    private readonly installmentRepository: Repository<ExpenseInstallment>,
    private readonly dataSource: DataSource,
    private readonly creditCardsService: CreditCardsService,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Reporte mensual de una tarjeta: total, estado de pago y cuotas que componen
   * el periodo, junto con las fechas de corte y pago del periodo.
   */
  async getMonthlyReport(
    userId: string,
    cardId: string,
    period: string,
  ): Promise<CreditCardMonthlyReport> {
    const card = await this.creditCardsService.assertOwnership(userId, cardId);

    const installments = await this.getPeriodInstallments(cardId, period);
    const total = this.sumAmounts(installments.map((i) => i.amount));

    const payment = await this.paymentRepository.findOne({
      where: { creditCardId: cardId, period, isDeleted: false },
    });

    const items: CreditCardReportItem[] = installments.map((installment) => ({
      name: installment.expense?.name ?? '',
      installmentNumber: installment.number,
      installmentsTotal: installment.expense?.installments ?? installment.number,
      amount: installment.amount,
    }));

    return {
      period,
      total,
      paid: payment !== null,
      paidAt: payment?.paidAt ?? null,
      cutoffDate: this.computeCutoffDate(card, period),
      paymentDate: this.computePaymentDate(card, period),
      items,
    };
  }

  /**
   * Resumen mes a mes (pasados y futuros) limitado a 24 meses.
   */
  async getRangeReport(
    userId: string,
    cardId: string,
    from: string,
    to: string,
  ): Promise<CreditCardRangeReport> {
    await this.creditCardsService.assertOwnership(userId, cardId);

    const fromIndex = DateUtil.periodToIndex(from);
    const toIndex = DateUtil.periodToIndex(to);

    if (fromIndex > toIndex) {
      throw new BadRequestException(
        'El periodo inicial no puede ser posterior al periodo final',
      );
    }

    if (toIndex - fromIndex + 1 > MAX_RANGE_MONTHS) {
      throw new BadRequestException(
        `El rango no puede superar los ${MAX_RANGE_MONTHS} meses`,
      );
    }

    const installments = await this.installmentRepository
      .createQueryBuilder('installment')
      .where('installment.creditCardId = :cardId', { cardId })
      .andWhere('installment.isDeleted = false')
      .andWhere('installment.period >= :from', { from })
      .andWhere('installment.period <= :to', { to })
      .getMany();

    const totals = new Map<string, number>();
    for (const installment of installments) {
      totals.set(
        installment.period,
        MoneyUtil.round(
          MoneyUtil.add(totals.get(installment.period) ?? 0, installment.amount),
        ),
      );
    }

    const payments = await this.paymentRepository.find({
      where: { creditCardId: cardId, isDeleted: false },
    });
    const paidPeriods = new Set(payments.map((payment) => payment.period));

    const months: CreditCardRangeMonth[] = [];
    let grandTotal = 0;
    for (let index = fromIndex; index <= toIndex; index++) {
      const period = DateUtil.indexToPeriod(index);
      const total = totals.get(period) ?? 0;
      grandTotal = MoneyUtil.round(MoneyUtil.add(grandTotal, total));
      months.push({
        period,
        total,
        paid: paidPeriods.has(period),
      });
    }

    return { months, grandTotal };
  }

  /**
   * Deuda exigible hoy (cuotas no pagadas con periodo <= actual), deuda futura
   * y cupo disponible.
   */
  async getCurrentDebt(userId: string, cardId: string): Promise<CreditCardDebt> {
    const card = await this.creditCardsService.assertOwnership(userId, cardId);

    const user = await this.usersService.findById(userId);
    const currentPeriod = DateUtil.formatPeriodInTimezone(
      new Date(),
      user.timezone || 'America/Bogota',
    );

    const installments = await this.installmentRepository.find({
      where: { creditCardId: cardId, isDeleted: false },
    });

    const currentDebt = this.sumAmounts(
      installments
        .filter((i) => !i.isPaid && i.period <= currentPeriod)
        .map((i) => i.amount),
    );
    const upcoming = this.sumAmounts(
      installments
        .filter((i) => !i.isPaid && i.period > currentPeriod)
        .map((i) => i.amount),
    );
    const totalPending = MoneyUtil.round(MoneyUtil.add(currentDebt, upcoming));

    const creditLimit = card.creditLimit;
    const availableCredit =
      creditLimit != null
        ? MoneyUtil.round(MoneyUtil.subtract(creditLimit, totalPending))
        : null;

    return { currentDebt, upcoming, totalPending, creditLimit, availableCredit };
  }

  /**
   * Marca un periodo como pagado: crea un egreso CORRIENTE (origen CARD_PAYMENT),
   * registra el pago y marca las cuotas del periodo. Todo dentro de una
   * transacción. Luego reprograma el recordatorio de pago de la tarjeta.
   */
  async markPeriodAsPaid(
    userId: string,
    cardId: string,
    options: { accountId: string; period?: string },
  ): Promise<CreditCardPayment> {
    const card = await this.creditCardsService.assertOwnership(userId, cardId);
    await this.accountsService.assertOwnership(userId, options.accountId);

    const user = await this.usersService.findById(userId);
    const timezone = user.timezone || 'America/Bogota';
    const currentPeriod = DateUtil.formatPeriodInTimezone(new Date(), timezone);
    const period = options.period ?? currentPeriod;

    if (period > currentPeriod) {
      throw new BadRequestException('No se pueden pagar periodos futuros');
    }

    const existing = await this.paymentRepository.findOne({
      where: { creditCardId: cardId, period, isDeleted: false },
    });
    if (existing) {
      throw new ConflictException('El periodo ya fue pagado');
    }

    const installments = await this.getPeriodInstallments(cardId, period);
    const total = this.sumAmounts(installments.map((i) => i.amount));

    if (total <= 0) {
      throw new BadRequestException('No hay deuda para el periodo indicado');
    }

    const paidAt = new Date();

    const payment = await this.dataSource.transaction(async (manager) => {
      const paymentId = randomUUID();

      const expenseRepo = manager.getRepository(Expense);
      const expense = expenseRepo.create({
        userId,
        accountId: options.accountId,
        name: `Pago tarjeta ${card.name} (${period})`,
        amount: total,
        description: null,
        date: paidAt,
        paymentMethod: ExpensePaymentMethod.CORRIENTE,
        creditCardId: null,
        installments: null,
        graceMonths: 0,
        amountPending: false,
        recurringConfigId: null,
        occurrenceDate: null,
        sourceType: ExpenseSourceType.CARD_PAYMENT,
        sourceId: paymentId,
      });
      const savedExpense = await expenseRepo.save(expense);

      const paymentRepo = manager.getRepository(CreditCardPayment);
      const savedPayment = await paymentRepo.save(
        paymentRepo.create({
          id: paymentId,
          userId,
          creditCardId: card.id,
          accountId: options.accountId,
          expenseId: savedExpense.id,
          period,
          amount: total,
          paidAt,
        }),
      );

      for (const installment of installments) {
        installment.isPaid = true;
        installment.cardPaymentId = paymentId;
      }
      if (installments.length > 0) {
        await manager.getRepository(ExpenseInstallment).save(installments);
      }

      return savedPayment;
    });

    await this.creditCardsService.scheduleNextPaymentReminder(card);

    return payment;
  }

  /**
   * Consulta interna reutilizable: cuotas (con su egreso) de un periodo.
   */
  async getPeriodInstallments(
    cardId: string,
    period: string,
  ): Promise<ExpenseInstallment[]> {
    return this.installmentRepository.find({
      where: { creditCardId: cardId, period, isDeleted: false },
      relations: { expense: true },
      order: { createdAt: 'ASC', number: 'ASC' },
    });
  }

  private sumAmounts(amounts: number[]): number {
    return MoneyUtil.round(
      amounts.reduce((acc, amount) => MoneyUtil.add(acc, amount), 0),
    );
  }

  private computeCutoffDate(card: CreditCard, period: string): string | null {
    if (card.cutoffDay == null) {
      return null;
    }
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(card.cutoffDay, lastDay);
    return `${period}-${String(day).padStart(2, '0')}`;
  }

  private computePaymentDate(card: CreditCard, period: string): string | null {
    if (card.paymentDay == null) {
      return null;
    }
    const nextIndex = DateUtil.periodToIndex(period) + 1;
    const nextYear = Math.floor(nextIndex / 12);
    const nextMonth = nextIndex % 12;
    const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    const day = Math.min(card.paymentDay, lastDay);
    return `${DateUtil.indexToPeriod(nextIndex)}-${String(day).padStart(2, '0')}`;
  }
}
