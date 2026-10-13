import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

describe('AccountsController', () => {
  let controller: AccountsController;
  let mockAccountsService: Partial<AccountsService>;

  beforeEach(() => {
    mockAccountsService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    controller = new AccountsController(mockAccountsService as AccountsService);
  });

  it('create debe invocar accountsService.create con userId y dto', async () => {
    const dto = {
      name: 'Bancolombia Ahorros',
      financialInstitution: 'Bancolombia',
      color: '#3B82F6',
      initialBalance: 1000,
    };
    const expected = {
      data: { id: 'acc-1', ...dto, currentBalance: 1000 },
      message: 'Cuenta creada correctamente',
    };
    vi.mocked(mockAccountsService.create!).mockResolvedValue(expected as any);

    const result = await controller.create('user-1', dto);
    expect(result).toBe(expected);
    expect(mockAccountsService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('findAll debe invocar accountsService.findAll con userId', async () => {
    const expected = {
      data: [],
      message: 'Cuentas obtenidas correctamente',
    };
    vi.mocked(mockAccountsService.findAll!).mockResolvedValue(expected as any);

    const result = await controller.findAll('user-1');
    expect(result).toBe(expected);
    expect(mockAccountsService.findAll).toHaveBeenCalledWith('user-1');
  });

  it('findOne debe invocar accountsService.findOne con userId e id', async () => {
    const expected = {
      data: { id: 'acc-1', currentBalance: 1000 },
      message: 'Cuenta obtenida correctamente',
    };
    vi.mocked(mockAccountsService.findOne!).mockResolvedValue(expected as any);

    const result = await controller.findOne('user-1', 'acc-1');
    expect(result).toBe(expected);
    expect(mockAccountsService.findOne).toHaveBeenCalledWith('user-1', 'acc-1');
  });

  it('update debe invocar accountsService.update con userId, id y dto', async () => {
    const dto = { name: 'Ahorros 2' };
    const expected = {
      data: { id: 'acc-1', name: 'Ahorros 2', currentBalance: 1000 },
      message: 'Cuenta actualizada correctamente',
    };
    vi.mocked(mockAccountsService.update!).mockResolvedValue(expected as any);

    const result = await controller.update('user-1', 'acc-1', dto);
    expect(result).toBe(expected);
    expect(mockAccountsService.update).toHaveBeenCalledWith('user-1', 'acc-1', dto);
  });

  it('remove debe invocar accountsService.remove con userId e id', async () => {
    const expected = {
      data: null,
      message: 'Cuenta eliminada correctamente',
    };
    vi.mocked(mockAccountsService.remove!).mockResolvedValue(expected as any);

    const result = await controller.remove('user-1', 'acc-1');
    expect(result).toBe(expected);
    expect(mockAccountsService.remove).toHaveBeenCalledWith('user-1', 'acc-1');
  });
});
