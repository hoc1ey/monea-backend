import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditCard } from './entities/credit-card.entity.js';
import { CreditCardPayment } from './entities/credit-card-payment.entity.js';
import { ExpenseInstallment } from '../expenses/entities/expense-installment.entity.js';
import { CreditCardsService } from './credit-cards.service.js';
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

const MAX_RANGE_MONTHS = 24;

@Injectable()
export class CreditCardBillingService {
  constructor(
    @InjectRepository(CreditCardPayment)
    private readonly paymentRepository: Repository<CreditCardPayment>,
    @InjectRepository(ExpenseInstallment)
    private readonly installmentRepository: Repository<ExpenseInstallment>,
    private readonly creditCardsService: CreditCardsService,
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
