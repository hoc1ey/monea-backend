import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ShoppingListsService } from './shopping-lists.service.js';
import { ShoppingListStatus } from './shopping-lists.constants.js';
import type { ShoppingList } from './entities/shopping-list.entity.js';
import type { ShoppingListItem } from './entities/shopping-list-item.entity.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { ExpensesService } from '../expenses/expenses.service.js';

function makeItem(id: string, overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id,
    userId: 'user-1',
    listId: 'list-1',
    name: `Item ${id}`,
    isPurchased: false,
    price: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ShoppingListItem;
}

function makeList(overrides: Partial<ShoppingList> = {}): ShoppingList {
  return {
    id: 'list-1',
    userId: 'user-1',
    name: 'Mercado',
    status: ShoppingListStatus.OPEN,
    closedAt: null,
    total: null,
    accountId: null,
    expenseId: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ShoppingList;
}

describe('ShoppingListsService.close', () => {
  let service: ShoppingListsService;
  let listRepository: { findOne: ReturnType<typeof vi.fn> };
  let itemRepository: { find: ReturnType<typeof vi.fn> };
  let accountsService: { assertOwnership: ReturnType<typeof vi.fn> };
  let expensesService: { createInternal: ReturnType<typeof vi.fn> };

  let items: ShoppingListItem[];
  let list: ShoppingList;

  beforeEach(() => {
    vi.clearAllMocks();

    list = makeList();
    items = [makeItem('i1'), makeItem('i2')];

    listRepository = { findOne: vi.fn().mockResolvedValue(list) };
    itemRepository = { find: vi.fn().mockResolvedValue(items) };
    accountsService = { assertOwnership: vi.fn().mockResolvedValue(undefined) };
    expensesService = {
      createInternal: vi.fn().mockResolvedValue({ id: 'expense-1' }),
    };

    const txListRepo = {
      create: vi.fn((value: unknown) => value),
      save: vi.fn((value: Record<string, unknown>) =>
        Promise.resolve({ ...value, id: (value.id as string) ?? 'new-list-1' }),
      ),
    };
    const txItemRepo = {
      create: vi.fn((value: unknown) => value),
      save: vi.fn((value: unknown) => Promise.resolve(value)),
    };

    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        const name = (entity as { name: string }).name;
        return name === 'ShoppingList' ? txListRepo : txItemRepo;
      }),
    };

    const dataSource = {
      transaction: vi.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };

    service = new ShoppingListsService(
      listRepository as unknown as Repository<ShoppingList>,
      itemRepository as unknown as Repository<ShoppingListItem>,
      dataSource as never,
      accountsService as unknown as AccountsService,
      expensesService as unknown as ExpensesService,
    );
  });

  it('cierra con precios por ítem, suma el total y crea el egreso', async () => {
    const result = await service.close('user-1', 'list-1', {
      accountId: 'acc-1',
      purchasedItems: [
        { id: 'i1', price: 10 },
        { id: 'i2', price: 5.5 },
      ],
    });

    expect(result.message).toBe('Lista cerrada correctamente');
    expect(result.data.closedList.status).toBe(ShoppingListStatus.CLOSED);
    expect(result.data.closedList.total).toBe(15.5);
    expect(result.data.closedList.expenseId).toBe('expense-1');
    expect(result.data.newList).toBeNull();
    expect(expensesService.createInternal).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ amount: 15.5, sourceId: 'list-1' }),
      expect.anything(),
    );
  });

  it('cierra usando un total único cuando los ítems no traen precio', async () => {
    const result = await service.close('user-1', 'list-1', {
      accountId: 'acc-1',
      purchasedItems: [{ id: 'i1' }, { id: 'i2' }],
      total: 100,
    });

    expect(result.data.closedList.total).toBe(100);
    expect(expensesService.createInternal).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ amount: 100 }),
      expect.anything(),
    );
  });

  it('traslada los ítems no comprados a una nueva lista abierta', async () => {
    items = [makeItem('i1'), makeItem('i2'), makeItem('i3')];
    itemRepository.find.mockResolvedValue(items);

    const result = await service.close('user-1', 'list-1', {
      accountId: 'acc-1',
      purchasedItems: [{ id: 'i1' }, { id: 'i2' }],
      notPurchasedItems: [{ id: 'i3' }],
      total: 50,
    });

    expect(result.data.newList).not.toBeNull();
    expect(result.data.newList?.items).toHaveLength(1);
    expect(result.data.closedList.items).toHaveLength(2);
  });

  it('rechaza el cierre si no se indica el estado de todos los ítems', async () => {
    await expect(
      service.close('user-1', 'list-1', {
        accountId: 'acc-1',
        purchasedItems: [{ id: 'i1' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza precios por ítem y total a la vez (XOR)', async () => {
    await expect(
      service.close('user-1', 'list-1', {
        accountId: 'acc-1',
        purchasedItems: [
          { id: 'i1', price: 1 },
          { id: 'i2', price: 2 },
        ],
        total: 3,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza precios parciales sin total', async () => {
    await expect(
      service.close('user-1', 'list-1', {
        accountId: 'acc-1',
        purchasedItems: [{ id: 'i1', price: 1 }, { id: 'i2' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un total menor o igual a cero', async () => {
    await expect(
      service.close('user-1', 'list-1', {
        accountId: 'acc-1',
        purchasedItems: [{ id: 'i1' }, { id: 'i2' }],
        total: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cerrar una lista que ya está cerrada', async () => {
    list = makeList({ status: ShoppingListStatus.CLOSED });
    listRepository.findOne.mockResolvedValue(list);

    await expect(
      service.close('user-1', 'list-1', {
        accountId: 'acc-1',
        purchasedItems: [{ id: 'i1' }, { id: 'i2' }],
        total: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
