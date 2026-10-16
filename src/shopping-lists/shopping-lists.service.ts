import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ShoppingList } from './entities/shopping-list.entity.js';
import { ShoppingListItem } from './entities/shopping-list-item.entity.js';
import { CreateShoppingListDto } from './dto/create-shopping-list.dto.js';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto.js';
import { QueryShoppingListDto } from './dto/query-shopping-list.dto.js';
import { CreateShoppingListItemDto } from './dto/create-shopping-list-item.dto.js';
import { UpdateShoppingListItemDto } from './dto/update-shopping-list-item.dto.js';
import { ToggleShoppingListItemCheckDto } from './dto/toggle-shopping-list-item-check.dto.js';
import { CloseShoppingListDto } from './dto/close-shopping-list.dto.js';
import { ShoppingListStatus } from './shopping-lists.constants.js';
import { MoneyUtil } from '../common/utils/money.util.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from '../expenses/expenses.constants.js';

@Injectable()
export class ShoppingListsService {
  constructor(
    @InjectRepository(ShoppingList)
    private readonly listRepository: Repository<ShoppingList>,
    @InjectRepository(ShoppingListItem)
    private readonly itemRepository: Repository<ShoppingListItem>,
    private readonly dataSource: DataSource,
    private readonly accountsService: AccountsService,
    private readonly expensesService: ExpensesService,
  ) {}

  /**
   * Crea una lista `OPEN` con sus ítems iniciales opcionales.
   */
  async create(userId: string, dto: CreateShoppingListDto) {
    const list = this.listRepository.create({
      userId,
      name: dto.name,
      status: ShoppingListStatus.OPEN,
      closedAt: null,
      total: null,
      accountId: null,
      expenseId: null,
    });

    const savedList = await this.listRepository.save(list);
    const items = await this.createItems(savedList, dto.items ?? []);

    return {
      data: { ...savedList, items },
      message: 'Lista creada correctamente',
    };
  }

  /**
   * Lista las listas del usuario (filtro opcional por estado) con sus ítems
   * activos.
   */
  async findAll(userId: string, query: QueryShoppingListDto) {
    const qb = this.listRepository
      .createQueryBuilder('list')
      .where('list.userId = :userId', { userId })
      .andWhere('list.isDeleted = false')
      .orderBy('list.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('list.status = :status', { status: query.status });
    }

    const lists = await qb.getMany();

    if (lists.length === 0) {
      return {
        data: [],
        message: 'Listas obtenidas correctamente',
      };
    }

    const items = await this.itemRepository.find({
      where: {
        listId: In(lists.map((list) => list.id)),
        userId,
        isDeleted: false,
      },
      order: { createdAt: 'ASC' },
    });

    const itemsByList = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const bucket = itemsByList.get(item.listId) ?? [];
      bucket.push(item);
      itemsByList.set(item.listId, bucket);
    }

    return {
      data: lists.map((list) => ({
        ...list,
        items: itemsByList.get(list.id) ?? [],
      })),
      message: 'Listas obtenidas correctamente',
    };
  }

  /**
   * Obtiene una lista con sus ítems activos.
   */
  async findOne(userId: string, id: string) {
    const list = await this.assertOwnership(userId, id);
    const items = await this.getItems(list.id);

    return {
      data: { ...list, items },
      message: 'Lista obtenida correctamente',
    };
  }

  /**
   * Renombra una lista. Solo listas `OPEN`.
   */
  async update(userId: string, id: string, dto: UpdateShoppingListDto) {
    const list = await this.assertOpenList(userId, id);

    if (dto.name !== undefined) {
      list.name = dto.name;
    }

    const saved = await this.listRepository.save(list);

    return {
      data: { ...saved, items: await this.getItems(saved.id) },
      message: 'Lista actualizada correctamente',
    };
  }

  /**
   * Borrado lógico de la lista y de sus ítems.
   */
  async remove(userId: string, id: string) {
    const list = await this.assertOwnership(userId, id);
    const items = await this.getItems(list.id);

    const now = new Date();
    list.isDeleted = true;
    list.deletedAt = now;
    await this.listRepository.save(list);

    if (items.length > 0) {
      for (const item of items) {
        item.isDeleted = true;
        item.deletedAt = now;
      }
      await this.itemRepository.save(items);
    }

    return {
      data: null,
      message: 'Lista eliminada correctamente',
    };
  }

  /**
   * Agrega un ítem a una lista `OPEN`.
   */
  async addItem(userId: string, listId: string, dto: CreateShoppingListItemDto) {
    const list = await this.assertOpenList(userId, listId);

    const item = this.itemRepository.create({
      userId,
      listId: list.id,
      name: dto.name,
      isPurchased: false,
      price: null,
    });

    const saved = await this.itemRepository.save(item);

    return {
      data: saved,
      message: 'Ítem agregado correctamente',
    };
  }

  /**
   * Actualiza el nombre y/o precio de un ítem de una lista `OPEN`.
   */
  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    dto: UpdateShoppingListItemDto,
  ) {
    const list = await this.assertOpenList(userId, listId);
    const item = await this.getItemOrFail(userId, list.id, itemId);

    if (dto.name !== undefined) {
      item.name = dto.name;
    }
    if (dto.price !== undefined) {
      item.price = dto.price;
    }

    const saved = await this.itemRepository.save(item);

    return {
      data: saved,
      message: 'Ítem actualizado correctamente',
    };
  }

  /**
   * Marca o desmarca un ítem como comprado en una lista `OPEN`.
   */
  async toggleItemCheck(
    userId: string,
    listId: string,
    itemId: string,
    dto: ToggleShoppingListItemCheckDto,
  ) {
    const list = await this.assertOpenList(userId, listId);
    const item = await this.getItemOrFail(userId, list.id, itemId);

    item.isPurchased = dto.isPurchased;

    const saved = await this.itemRepository.save(item);

    return {
      data: saved,
      message: 'Ítem actualizado correctamente',
    };
  }

  /**
   * Borrado lógico de un ítem de una lista `OPEN`.
   */
  async removeItem(userId: string, listId: string, itemId: string) {
    const list = await this.assertOpenList(userId, listId);
    const item = await this.getItemOrFail(userId, list.id, itemId);

    item.isDeleted = true;
    item.deletedAt = new Date();
    await this.itemRepository.save(item);

    return {
      data: null,
      message: 'Ítem eliminado correctamente',
    };
  }

  /**
   * Cierra una lista `OPEN`: valida la cobertura de ítems y el XOR precios/total,
   * crea el egreso (`SHOPPING_LIST`), traslada los ítems no comprados a una nueva
   * lista `OPEN` y marca la lista como `CLOSED`. Todo en una transacción.
   */
  async close(userId: string, listId: string, dto: CloseShoppingListDto) {
    const list = await this.assertOwnership(userId, listId);

    if (list.status !== ShoppingListStatus.OPEN) {
      throw new BadRequestException('La lista ya está cerrada');
    }

    await this.accountsService.assertOwnership(userId, dto.accountId);

    const items = await this.getItems(list.id);

    if (items.length === 0) {
      throw new BadRequestException('La lista no tiene ítems para cerrar');
    }

    const purchased = dto.purchasedItems ?? [];
    const notPurchased = dto.notPurchasedItems ?? [];

    const providedIds = [
      ...purchased.map((item) => item.id),
      ...notPurchased.map((item) => item.id),
    ];
    const uniqueIds = new Set(providedIds);

    if (uniqueIds.size !== providedIds.length) {
      throw new BadRequestException('Hay ítems repetidos en el cierre');
    }

    const itemById = new Map(items.map((item) => [item.id, item]));

    for (const id of uniqueIds) {
      if (!itemById.has(id)) {
        throw new BadRequestException(
          'Uno o más ítems no pertenecen a la lista',
        );
      }
    }

    if (uniqueIds.size !== items.length) {
      throw new BadRequestException(
        'Debes indicar el estado de todos los ítems de la lista',
      );
    }

    const withPrice = purchased.filter(
      (item) => item.price !== undefined && item.price !== null,
    );
    const hasPrice = withPrice.length > 0;
    const allHavePrice =
      purchased.length > 0 && withPrice.length === purchased.length;
    const hasTotal = dto.total !== undefined && dto.total !== null;

    if (hasPrice && hasTotal) {
      throw new BadRequestException(
        'Debes enviar precios por ítem o un total, pero no ambos',
      );
    }
    if (hasPrice && !allHavePrice) {
      throw new BadRequestException(
        'Todos los ítems comprados deben traer precio',
      );
    }
    if (!hasPrice && !hasTotal) {
      throw new BadRequestException(
        'Debes enviar los precios de los ítems o un total',
      );
    }

    const total = MoneyUtil.round(
      hasPrice
        ? purchased.reduce(
            (acc, item) => MoneyUtil.add(acc, item.price as number),
            0,
          )
        : (dto.total as number),
    );

    if (total <= 0) {
      throw new BadRequestException('El total debe ser mayor que 0');
    }

    const closedAt = new Date();

    const result = await this.dataSource.transaction(async (manager) => {
      const listRepo = manager.getRepository(ShoppingList);
      const itemRepo = manager.getRepository(ShoppingListItem);

      for (const entry of purchased) {
        const item = itemById.get(entry.id);
        if (!item) {
          continue;
        }
        item.isPurchased = true;
        if (entry.price !== undefined && entry.price !== null) {
          item.price = entry.price;
        }
        await itemRepo.save(item);
      }

      let newList: ShoppingList | null = null;
      let newItems: ShoppingListItem[] = [];

      if (notPurchased.length > 0) {
        newList = await listRepo.save(
          listRepo.create({
            userId,
            name: list.name,
            status: ShoppingListStatus.OPEN,
            closedAt: null,
            total: null,
            accountId: null,
            expenseId: null,
          }),
        );

        newItems = notPurchased.map((entry) => {
          const original = itemById.get(entry.id);
          return itemRepo.create({
            userId,
            listId: newList!.id,
            name: original?.name ?? '',
            isPurchased: false,
            price: null,
          });
        });
        await itemRepo.save(newItems);

        for (const entry of notPurchased) {
          const item = itemById.get(entry.id);
          if (!item) {
            continue;
          }
          item.isDeleted = true;
          item.deletedAt = closedAt;
          await itemRepo.save(item);
        }
      }

      const expense = await this.expensesService.createInternal(
        userId,
        {
          accountId: dto.accountId,
          name: list.name,
          amount: total,
          description: null,
          date: closedAt,
          paymentMethod: ExpensePaymentMethod.CORRIENTE,
          sourceType: ExpenseSourceType.SHOPPING_LIST,
          sourceId: list.id,
        },
        manager,
      );

      list.status = ShoppingListStatus.CLOSED;
      list.closedAt = closedAt;
      list.total = total;
      list.accountId = dto.accountId;
      list.expenseId = expense.id;
      const savedList = await listRepo.save(list);

      const closedItems = purchased
        .map((entry) => itemById.get(entry.id))
        .filter((item): item is ShoppingListItem => item !== undefined);

      return {
        closedList: { ...savedList, items: closedItems },
        newList: newList ? { ...newList, items: newItems } : null,
      };
    });

    return {
      data: result,
      message: 'Lista cerrada correctamente',
    };
  }

  /**
   * Valida que la lista exista, no esté eliminada y pertenezca al usuario.
   */
  async assertOwnership(userId: string, id: string): Promise<ShoppingList> {
    const list = await this.listRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!list) {
      throw new NotFoundException('Lista de compras no encontrada');
    }

    return list;
  }

  private async assertOpenList(
    userId: string,
    id: string,
  ): Promise<ShoppingList> {
    const list = await this.assertOwnership(userId, id);

    if (list.status !== ShoppingListStatus.OPEN) {
      throw new BadRequestException(
        'La lista está cerrada y no puede modificarse',
      );
    }

    return list;
  }

  private async getItemOrFail(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<ShoppingListItem> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId, listId, userId, isDeleted: false },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    return item;
  }

  private async getItems(listId: string): Promise<ShoppingListItem[]> {
    return this.itemRepository.find({
      where: { listId, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
  }

  private async createItems(
    list: ShoppingList,
    items: CreateShoppingListItemDto[],
  ): Promise<ShoppingListItem[]> {
    if (items.length === 0) {
      return [];
    }

    const rows = items.map((item) =>
      this.itemRepository.create({
        userId: list.userId,
        listId: list.id,
        name: item.name,
        isPurchased: false,
        price: null,
      }),
    );

    return this.itemRepository.save(rows);
  }
}
