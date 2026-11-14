import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository, EntityManager } from 'typeorm';
import { Brackets } from 'typeorm';
import { TransfersService } from './transfers.service.js';
import { Transfer } from './entities/transfer.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { Income } from '../incomes/entities/income.entity.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { IncomesService } from '../incomes/incomes.service.js';
import { ExpenseSourceType, ExpensePaymentMethod } from '../expenses/expenses.constants.js';
import { IncomeSourceType } from '../incomes/incomes.constants.js';

describe('TransfersService', () => {
  let service: TransfersService;
  let mockTransferRepo: { findOne: ReturnType<typeof vi.fn>; createQueryBuilder: ReturnType<typeof vi.fn> };
  let mockAccountsService: { assertOwnership: ReturnType<typeof vi.fn> };
  let mockExpensesService: { createInternal: ReturnType<typeof vi.fn> };
  let mockIncomesService: { createFromSource: ReturnType<typeof vi.fn> };

  let txTransferRepo: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let txRepoFactory: (entity: unknown) => unknown;
  let manager: EntityManager;
  let dataSource: { transaction: (cb: (m: EntityManager) => unknown) => unknown };

  const sourceAccount = { id: 'acc-1', name: 'Banco Origen' };
  const destinationAccount = { id: 'acc-2', name: 'Banco Destino' };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransferRepo = {
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockAccountsService = { assertOwnership: vi.fn() };
    mockExpensesService = { createInternal: vi.fn() };
    mockIncomesService = { createFromSource: vi.fn() };

    txTransferRepo = {
      create: vi.fn((value: unknown) => value),
      save: vi.fn(async (value: Record<string, unknown>) => {
        return { ...value, id: (value.id as string) ?? 'transfer-1' };
      }),
    };

    manager = {
      getRepository: (entity: unknown) => txRepoFactory(entity),
    } as unknown as EntityManager;

    dataSource = {
      transaction: vi.fn((cb: (m: EntityManager) => unknown) => cb(manager)),
    };

    txRepoFactory = (entity: unknown) => {
      const name = (entity as { name: string }).name;
      return name === 'Transfer' ? txTransferRepo : { findOne: vi.fn(), save: vi.fn() };
    };

    service = new TransfersService(
      mockTransferRepo as unknown as Repository<Transfer>,
      dataSource as never,
      mockAccountsService as unknown as AccountsService,
      mockExpensesService as unknown as ExpensesService,
      mockIncomesService as unknown as IncomesService,
    );
  });

  describe('create', () => {
    const dto = {
      sourceAccountId: 'acc-1',
      destinationAccountId: 'acc-2',
      amount: 500,
      description: 'Pago del alquiler',
    };

    it('debe crear la transferencia con egreso e ingreso en una transacción', async () => {
      vi.mocked(mockAccountsService.assertOwnership)
        .mockResolvedValueOnce(sourceAccount as never)
        .mockResolvedValueOnce(destinationAccount as never);

      vi.mocked(mockExpensesService.createInternal).mockResolvedValue({ id: 'expense-1' } as Expense);
      vi.mocked(mockIncomesService.createFromSource).mockResolvedValue({ id: 'income-1' } as Income);

      const result = await service.create('user-1', dto);

      expect(mockAccountsService.assertOwnership).toHaveBeenCalledWith('user-1', 'acc-1');
      expect(mockAccountsService.assertOwnership).toHaveBeenCalledWith('user-1', 'acc-2');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.data.id).toBe('transfer-1');
      expect(result.data.expenseId).toBe('expense-1');
      expect(result.data.incomeId).toBe('income-1');
      expect(result.message).toBe('Transferencia registrada correctamente');
    });

    it('debe nombrar el egreso "Transferencia a {destino}" con sourceType TRANSFER', async () => {
      vi.mocked(mockAccountsService.assertOwnership)
        .mockResolvedValueOnce(sourceAccount as never)
        .mockResolvedValueOnce(destinationAccount as never);
      vi.mocked(mockExpensesService.createInternal).mockResolvedValue({ id: 'expense-1' } as Expense);
      vi.mocked(mockIncomesService.createFromSource).mockResolvedValue({ id: 'income-1' } as Income);

      await service.create('user-1', dto);

      expect(mockExpensesService.createInternal).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          accountId: 'acc-1',
          name: 'Transferencia a Banco Destino',
          amount: 500,
          paymentMethod: ExpensePaymentMethod.CORRIENTE,
          sourceType: ExpenseSourceType.TRANSFER,
          sourceId: 'transfer-1',
        }),
        expect.anything(),
      );
    });

    it('debe nombrar el ingreso "Transferencia desde {origen}" con sourceType TRANSFER', async () => {
      vi.mocked(mockAccountsService.assertOwnership)
        .mockResolvedValueOnce(sourceAccount as never)
        .mockResolvedValueOnce(destinationAccount as never);
      vi.mocked(mockExpensesService.createInternal).mockResolvedValue({ id: 'expense-1' } as Expense);
      vi.mocked(mockIncomesService.createFromSource).mockResolvedValue({ id: 'income-1' } as Income);

      await service.create('user-1', dto);

      expect(mockIncomesService.createFromSource).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          accountId: 'acc-2',
          name: 'Transferencia desde Banco Origen',
          amount: 500,
          sourceType: IncomeSourceType.TRANSFER,
          sourceId: 'transfer-1',
        }),
        expect.anything(),
      );
    });

    it('debe rechazar si la cuenta origen y destino son la misma', async () => {
      await expect(
        service.create('user-1', {
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-1',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockAccountsService.assertOwnership).not.toHaveBeenCalled();
    });

    it('debe lanzar 404 si alguna cuenta no pertenece al usuario', async () => {
      vi.mocked(mockAccountsService.assertOwnership).mockRejectedValueOnce(
        new NotFoundException('Cuenta no encontrada'),
      );

      await expect(service.create('user-1', dto)).rejects.toThrow(NotFoundException);
      expect(mockAccountsService.assertOwnership).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
  it('debe listar transferencias paginadas filtrando por cuenta en origen o destino', async () => {
    let bracketFactory: ((w: {
      where: (sql: string, params?: unknown) => unknown;
      orWhere: (sql: string, params?: unknown) => unknown;
    }) => void) | undefined;

    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn((value: unknown) => {
        const factory = (value as { whereFactory?: typeof bracketFactory })
          .whereFactory;
        if (factory) {
          bracketFactory = factory;
        }
        return qbMock;
      }),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[{ id: 'transfer-1' }], 1]),
    };
    vi.mocked(mockTransferRepo.createQueryBuilder).mockReturnValue(qbMock as never);

    const result = await service.findAll('user-1', {
      page: 1,
      limit: 10,
      accountId: 'acc-1',
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-30T23:59:59.999Z',
    });

    expect(result.message).toBe('Transferencias obtenidas correctamente');
    expect(result.data.items).toHaveLength(1);
    expect(result.data.total).toBe(1);
    expect(result.data.totalPages).toBe(1);

    const w = {
      where: vi.fn().mockReturnThis(),
      orWhere: vi.fn().mockReturnThis(),
    };
    bracketFactory?.(w);
    expect(w.where).toHaveBeenCalledWith('transfer.sourceAccountId = :accountId', {
      accountId: 'acc-1',
    });
    expect(w.orWhere).toHaveBeenCalledWith(
      'transfer.destinationAccountId = :accountId',
      { accountId: 'acc-1' },
    );
    expect(qbMock.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
  });
  });

  describe('findOne', () => {
    it('debe retornar la transferencia si pertenece al usuario', async () => {
      const transfer = { id: 'transfer-1', userId: 'user-1' } as Transfer;
      vi.mocked(mockTransferRepo.findOne).mockResolvedValue(transfer);

      const result = await service.findOne('user-1', 'transfer-1');

      expect(result.data).toBe(transfer);
      expect(result.message).toBe('Transferencia obtenida correctamente');
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      vi.mocked(mockTransferRepo.findOne).mockResolvedValue(null);

      await expect(service.findOne('user-1', 'transfer-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('debe hacer borrado lógico de la transferencia y sus movimientos', async () => {
      const transfer = {
        id: 'transfer-1',
        userId: 'user-1',
        isDeleted: false,
        deletedAt: null,
        expenseId: 'expense-1',
        incomeId: 'income-1',
      } as Transfer;
      vi.mocked(mockTransferRepo.findOne).mockResolvedValue(transfer);

      const expense = { id: 'expense-1', isDeleted: false } as Expense;
      const income = { id: 'income-1', isDeleted: false } as Income;

      txRepoFactory = (entity: unknown) => {
        const name = (entity as { name: string }).name;
        if (name === 'Transfer') {
          return txTransferRepo;
        }
        if (name === 'Expense') {
          return {
            findOne: vi.fn().mockResolvedValue(expense),
            save: vi.fn().mockResolvedValue(expense),
          };
        }
        return {
          findOne: vi.fn().mockResolvedValue(income),
          save: vi.fn().mockResolvedValue(income),
        };
      };

      const result = await service.remove('user-1', 'transfer-1');

      expect(transfer.isDeleted).toBe(true);
      expect(transfer.deletedAt).toBeInstanceOf(Date);
      expect(expense.isDeleted).toBe(true);
      expect(income.isDeleted).toBe(true);
      expect(result.message).toBe('Transferencia eliminada correctamente');
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      vi.mocked(mockTransferRepo.findOne).mockResolvedValue(null);

      await expect(service.remove('user-1', 'transfer-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
