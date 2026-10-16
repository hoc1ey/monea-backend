import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { CreditCardBillingService } from './credit-card-billing.service.js';
import type { CreditCardPayment } from './entities/credit-card-payment.entity.js';
import type { ExpenseInstallment } from '../expenses/entities/expense-installment.entity.js';
import type { CreditCardsService } from './credit-cards.service.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { UsersService } from '../users/users.service.js';

describe('CreditCardBillingService.markPeriodAsPaid', () => {
  let service: CreditCardBillingService;
  let paymentRepository: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
  };
  let installmentRepository: { find: ReturnType<typeof vi.fn> };
  let creditCardsService: {
    assertOwnership: ReturnType<typeof vi.fn>;
    scheduleNextPaymentReminder: ReturnType<typeof vi.fn>;
  };
  let accountsService: { assertOwnership: ReturnType<typeof vi.fn> };
  let usersService: { findById: ReturnType<typeof vi.fn> };

  const card = { id: 'card-1', name: 'Visa' };
  const pastPeriod = '2020-01';

  let installments: Partial<ExpenseInstallment>[];

  beforeEach(() => {
    vi.clearAllMocks();

    installments = [
      { id: 'inst-1', amount: 50, isPaid: false, cardPaymentId: null },
      { id: 'inst-2', amount: 30.5, isPaid: false, cardPaymentId: null },
    ];

    paymentRepository = { findOne: vi.fn(), find: vi.fn() };
    installmentRepository = { find: vi.fn().mockResolvedValue(installments) };

    creditCardsService = {
      assertOwnership: vi.fn().mockResolvedValue(card),
      scheduleNextPaymentReminder: vi.fn().mockResolvedValue(undefined),
    };
    accountsService = { assertOwnership: vi.fn().mockResolvedValue(undefined) };
    usersService = {
      findById: vi.fn().mockResolvedValue({ timezone: 'America/Bogota' }),
    };

    const expenseRepo = {
      create: vi.fn((value: unknown) => value),
      save: vi.fn((value: Record<string, unknown>) =>
        Promise.resolve({ ...value, id: 'expense-1' }),
      ),
    };
    const txPaymentRepo = {
      create: vi.fn((value: unknown) => value),
      save: vi.fn((value: Record<string, unknown>) =>
        Promise.resolve({ ...value, id: (value.id as string) ?? 'payment-1' }),
      ),
    };
    const txInstallmentRepo = {
      save: vi.fn((value: unknown) => Promise.resolve(value)),
    };

    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        const name = (entity as { name: string }).name;
        if (name === 'Expense') return expenseRepo;
        if (name === 'CreditCardPayment') return txPaymentRepo;
        return txInstallmentRepo;
      }),
    };

    const dataSource = {
      transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };

    service = new CreditCardBillingService(
      paymentRepository as unknown as Repository<CreditCardPayment>,
      installmentRepository as unknown as Repository<ExpenseInstallment>,
      dataSource as never,
      creditCardsService as unknown as CreditCardsService,
      accountsService as unknown as AccountsService,
      usersService as unknown as UsersService,
    );
  });

  it('crea el egreso, registra el pago y marca las cuotas del periodo como pagadas', async () => {
    paymentRepository.findOne.mockResolvedValue(null);

    const result = await service.markPeriodAsPaid('user-1', 'card-1', {
      accountId: 'acc-1',
      period: pastPeriod,
    });

    expect(result.period).toBe(pastPeriod);
    expect(result.amount).toBe(80.5);
    expect(result.id).toBeTruthy();

    expect(installments[0].isPaid).toBe(true);
    expect(installments[1].isPaid).toBe(true);
    expect(installments[0].cardPaymentId).toBe(result.id);

    expect(creditCardsService.scheduleNextPaymentReminder).toHaveBeenCalledWith(
      card,
    );
  });

  it('rechaza pagar periodos futuros', async () => {
    await expect(
      service.markPeriodAsPaid('user-1', 'card-1', {
        accountId: 'acc-1',
        period: '2999-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un periodo ya pagado con 409', async () => {
    paymentRepository.findOne.mockResolvedValue({ id: 'payment-existing' });

    await expect(
      service.markPeriodAsPaid('user-1', 'card-1', {
        accountId: 'acc-1',
        period: pastPeriod,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza un periodo sin deuda', async () => {
    paymentRepository.findOne.mockResolvedValue(null);
    installmentRepository.find.mockResolvedValue([]);

    await expect(
      service.markPeriodAsPaid('user-1', 'card-1', {
        accountId: 'acc-1',
        period: pastPeriod,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
