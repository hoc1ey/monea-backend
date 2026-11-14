import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

describe('ReportsController', () => {
  let controller: ReportsController;
  let mockReportsService: Partial<ReportsService>;

  beforeEach(() => {
    mockReportsService = {
      getMonthlySummary: vi.fn(),
      getMonthlyHistory: vi.fn(),
      getBalanceHistory: vi.fn(),
    };

    controller = new ReportsController(mockReportsService as ReportsService);
  });

  it('getMonthlySummary debe invocar reportsService.getMonthlySummary con userId y query', async () => {
    const query = { accountId: 'acc-1' };
    const expected = {
      data: { period: '2026-11', totalIncomes: 3200.5, totalExpenses: 1275.25, net: 1925.25 },
      message: 'Resumen mensual obtenido correctamente',
    };
    vi.mocked(mockReportsService.getMonthlySummary!).mockResolvedValue(expected as any);

    const result = await controller.getMonthlySummary('user-1', query);

    expect(result).toBe(expected);
    expect(mockReportsService.getMonthlySummary).toHaveBeenCalledWith('user-1', query);
  });

  it('getMonthlyHistory debe invocar reportsService.getMonthlyHistory con userId y query', async () => {
    const expected = {
      data: { items: [] },
      message: 'Historial mensual obtenido correctamente',
    };
    vi.mocked(mockReportsService.getMonthlyHistory!).mockResolvedValue(expected as any);

    const result = await controller.getMonthlyHistory('user-1', {});

    expect(result).toBe(expected);
    expect(mockReportsService.getMonthlyHistory).toHaveBeenCalledWith('user-1', {});
  });

  it('getBalanceHistory debe invocar reportsService.getBalanceHistory con userId y query', async () => {
    const expected = {
      data: { items: [{ period: '2026-11', balance: 1220 }] },
      message: 'Balance general obtenido correctamente',
    };
    vi.mocked(mockReportsService.getBalanceHistory!).mockResolvedValue(expected as any);

    const result = await controller.getBalanceHistory('user-1', {});

    expect(result).toBe(expected);
    expect(mockReportsService.getBalanceHistory).toHaveBeenCalledWith('user-1', {});
  });
});
