import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncomesController } from './incomes.controller.js';
import { IncomesService } from './incomes.service.js';

describe('IncomesController', () => {
  let controller: IncomesController;
  let mockIncomesService: Partial<IncomesService>;

  beforeEach(() => {
    mockIncomesService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    controller = new IncomesController(mockIncomesService as IncomesService);
  });

  it('create debe invocar incomesService.create con userId y dto', async () => {
    const dto = {
      accountId: 'acc-1',
      name: 'Salario',
      amount: 1000,
    };
    const expected = {
      data: { id: 'inc-1', ...dto },
      message: 'Ingreso registrado correctamente',
    };
    vi.mocked(mockIncomesService.create!).mockResolvedValue(expected as any);

    const result = await controller.create('user-1', dto);

    expect(result).toBe(expected);
    expect(mockIncomesService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('findAll debe invocar incomesService.findAll con userId y query', async () => {
    const query = { page: 1, limit: 10 };
    const expected = {
      data: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
      message: 'Ingresos obtenidos correctamente',
    };
    vi.mocked(mockIncomesService.findAll!).mockResolvedValue(expected as any);

    const result = await controller.findAll('user-1', query);

    expect(result).toBe(expected);
    expect(mockIncomesService.findAll).toHaveBeenCalledWith('user-1', query);
  });

  it('findOne debe invocar incomesService.findOne con userId e id', async () => {
    const expected = {
      data: { id: 'inc-1' },
      message: 'Ingreso obtenido correctamente',
    };
    vi.mocked(mockIncomesService.findOne!).mockResolvedValue(expected as any);

    const result = await controller.findOne('user-1', 'inc-1');

    expect(result).toBe(expected);
    expect(mockIncomesService.findOne).toHaveBeenCalledWith('user-1', 'inc-1');
  });

  it('update debe invocar incomesService.update con userId, id y dto', async () => {
    const dto = { name: 'Nuevo concepto' };
    const expected = {
      data: { id: 'inc-1', name: 'Nuevo concepto' },
      message: 'Ingreso actualizado correctamente',
    };
    vi.mocked(mockIncomesService.update!).mockResolvedValue(expected as any);

    const result = await controller.update('user-1', 'inc-1', dto);

    expect(result).toBe(expected);
    expect(mockIncomesService.update).toHaveBeenCalledWith('user-1', 'inc-1', dto);
  });

  it('remove debe invocar incomesService.remove con userId e id', async () => {
    const expected = {
      data: null,
      message: 'Ingreso eliminado correctamente',
    };
    vi.mocked(mockIncomesService.remove!).mockResolvedValue(expected as any);

    const result = await controller.remove('user-1', 'inc-1');

    expect(result).toBe(expected);
    expect(mockIncomesService.remove).toHaveBeenCalledWith('user-1', 'inc-1');
  });
});
