import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from './reports.service.js';
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Income } from '../incomes/entities/income.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { Account } from '../accounts/entities/account.entity.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { DateUtil } from '../common/utils/date.util.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockIncomeRepo: Partial<Repository<Income>>;
  let mockExpenseRepo: Partial<Repository<Expense>>;
  let mockAccountRepo: Partial<Repository<Account>>;
  let mockAccountsService: Partial<AccountsService>;

  const currentPeriod = DateUtil.formatPeriod(new Date());
  const currentIndex = DateUtil.periodToIndex(currentPeriod);

  beforeEach(() => {
    mockIncomeRepo = { query: vi.fn() };
    mockExpenseRepo = { query: vi.fn() };
    mockAccountRepo = { query: vi.fn() };
    mockAccountsService = { assertOwnership: vi.fn() };

    service = new ReportsService(
      mockIncomeRepo as Repository<Income>,
      mockExpenseRepo as Repository<Expense>,
      mockAccountRepo as Repository<Account>,
      mockAccountsService as AccountsService,
    );
  });

  describe('getMonthlySummary', () => {
    it('debe devolver la sumatoria de ingresos y egresos del mes actual por separado', async () => {
      vi.mocked(mockIncomeRepo.query!).mockResolvedValue([{ total: '3200.50' }]);
      vi.mocked(mockExpenseRepo.query!).mockResolvedValue([{ total: '1275.25' }]);

      const result = await service.getMonthlySummary('user-1', {});

      expect(result.data).toEqual({
        period: currentPeriod,
        totalIncomes: 3200.5,
        totalExpenses: 1275.25,
        net: 1925.25,
      });
      expect(result.message).toBe('Resumen mensual obtenido correctamente');

      const [incomeSql, incomeParams] = vi.mocked(mockIncomeRepo.query!).mock.calls[0];
      const [expenseSql, expenseParams] = vi.mocked(mockExpenseRepo.query!).mock.calls[0];
      expect(incomeSql).toContain('FROM incomes');
      expect(incomeSql).toContain('"isDeleted" = false');
      expect(expenseParams[0]).toBe('user-1');
      expect(incomeParams[0]).toBe('user-1');
      expect(expenseSql).not.toContain('paymentMethod');
    });

    it('debe validar la cuenta y agregar el filtro accountId cuando se envía', async () => {
      vi.mocked(mockAccountsService.assertOwnership!).mockResolvedValue({} as any);
      vi.mocked(mockIncomeRepo.query!).mockResolvedValue([{ total: '0' }]);
      vi.mocked(mockExpenseRepo.query!).mockResolvedValue([{ total: '0' }]);

      const result = await service.getMonthlySummary('user-1', {
        accountId: 'acc-1',
      });

      expect(mockAccountsService.assertOwnership).toHaveBeenCalledWith('user-1', 'acc-1');
      const [incomeSql, incomeParams] = vi.mocked(mockIncomeRepo.query!).mock.calls[0];
      expect(incomeSql).toContain('"accountId" = $4');
      expect(incomeParams).toContain('acc-1');
      expect(result.data.totalIncomes).toBe(0);
    });

    it('debe lanzar NotFoundException si la cuenta no pertenece al usuario', async () => {
      vi.mocked(mockAccountsService.assertOwnership!).mockRejectedValue(
        new NotFoundException('Cuenta no encontrada'),
      );

      await expect(
        service.getMonthlySummary('user-1', { accountId: 'acc-ajena' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockIncomeRepo.query).not.toHaveBeenCalled();
    });
  });

  describe('getMonthlyHistory', () => {
    it('debe devolver 5 periodos ordenados con meses sin movimientos en 0', async () => {
      vi.mocked(mockIncomeRepo.query!).mockResolvedValue([
        { period: DateUtil.indexToPeriod(currentIndex), total: '500.00' },
        { period: DateUtil.indexToPeriod(currentIndex - 2), total: '300.75' },
      ]);
      vi.mocked(mockExpenseRepo.query!).mockResolvedValue([
        { period: DateUtil.indexToPeriod(currentIndex - 1), total: '150.25' },
      ]);

      const result = await service.getMonthlyHistory('user-1', {});

      expect(result.data.items).toHaveLength(5);
      expect(result.data.items.map((item) => item.period)).toEqual([
        DateUtil.indexToPeriod(currentIndex - 4),
        DateUtil.indexToPeriod(currentIndex - 3),
        DateUtil.indexToPeriod(currentIndex - 2),
        DateUtil.indexToPeriod(currentIndex - 1),
        currentPeriod,
      ]);
      expect(result.data.items[4]).toEqual({
        period: currentPeriod,
        totalIncomes: 500,
        totalExpenses: 0,
        net: 500,
      });
      expect(result.data.items[0]).toEqual({
        period: DateUtil.indexToPeriod(currentIndex - 4),
        totalIncomes: 0,
        totalExpenses: 0,
        net: 0,
      });
      expect(result.data.items[2].totalIncomes).toBe(300.75);
      expect(result.data.items[3].totalExpenses).toBe(150.25);
      expect(result.message).toBe('Historial mensual obtenido correctamente');
    });
  });

  describe('getBalanceHistory', () => {
    it('debe calcular el balance acumulado al cierre de cada mes', async () => {
      // Σ initialBalance de las cuentas
      vi.mocked(mockAccountRepo.query!).mockResolvedValue([{ total: '1000.00' }]);
      // ingresos antes de la ventana / ingresos agrupados por periodo
      vi.mocked(mockIncomeRepo.query!)
        .mockResolvedValueOnce([{ total: '100.00' }])
        .mockResolvedValueOnce([
          { period: DateUtil.indexToPeriod(currentIndex - 1), total: '200.00' },
          { period: currentPeriod, total: '50.00' },
        ]);
      // egresos CORRIENTE antes de la ventana / egresos CORRIENTE agrupados por periodo
      vi.mocked(mockExpenseRepo.query!)
        .mockResolvedValueOnce([{ total: '50.00' }])
        .mockResolvedValueOnce([{ period: currentPeriod, total: '80.00' }]);

      const result = await service.getBalanceHistory('user-1', {});

      // base: 1000 + 100 - 50 = 1050
      expect(result.data.items).toEqual([
        { period: DateUtil.indexToPeriod(currentIndex - 4), balance: 1050 },
        { period: DateUtil.indexToPeriod(currentIndex - 3), balance: 1050 },
        { period: DateUtil.indexToPeriod(currentIndex - 2), balance: 1050 },
        { period: DateUtil.indexToPeriod(currentIndex - 1), balance: 1250 },
        { period: currentPeriod, balance: 1220 },
      ]);
      expect(result.message).toBe('Balance general obtenido correctamente');

      const [expenseSql] = vi.mocked(mockExpenseRepo.query!).mock.calls[1];
      expect(expenseSql).toContain(`"paymentMethod" = 'CORRIENTE'`);
    });

    it('debe lanzar NotFoundException si la cuenta no pertenece al usuario', async () => {
      vi.mocked(mockAccountsService.assertOwnership!).mockRejectedValue(
        new NotFoundException('Cuenta no encontrada'),
      );

      await expect(
        service.getBalanceHistory('user-1', { accountId: 'acc-ajena' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockAccountRepo.query).not.toHaveBeenCalled();
    });
  });
});
