import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Income } from './entities/income.entity.js';
import { CreateIncomeDto } from './dto/create-income.dto.js';
import { UpdateIncomeDto } from './dto/update-income.dto.js';
import { QueryIncomeDto } from './dto/query-income.dto.js';
import { IncomeSourceType } from './incomes.constants.js';
import { AccountsService } from '../accounts/accounts.service.js';

export interface CreateIncomeFromSourceInput {
  accountId: string;
  name: string;
  amount: number;
  description?: string | null;
  date?: Date;
  sourceType: IncomeSourceType;
  sourceId: string;
}

@Injectable()
export class IncomesService {
  constructor(
    @InjectRepository(Income)
    protected readonly incomeRepository: Repository<Income>,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Crea un ingreso manual validando la pertenencia de la cuenta.
   */
  async create(userId: string, dto: CreateIncomeDto) {
    await this.accountsService.assertOwnership(userId, dto.accountId);

    const income = this.incomeRepository.create({
      userId,
      accountId: dto.accountId,
      name: dto.name,
      amount: dto.amount,
      description: dto.description ?? null,
      date: dto.date ? new Date(dto.date) : new Date(),
      sourceType: IncomeSourceType.MANUAL,
      sourceId: null,
    });

    const saved = await this.incomeRepository.save(income);

    return {
      data: saved,
      message: 'Ingreso registrado correctamente',
    };
  }

  /**
   * Método transaccional para uso de módulos de Cobros/Préstamos.
   * Acepta un EntityManager opcional para participar en transacciones externas.
   */
  async createFromSource(
    userId: string,
    data: CreateIncomeFromSourceInput,
    manager?: EntityManager,
  ): Promise<Income> {
    await this.accountsService.assertOwnership(userId, data.accountId);

    if (data.amount <= 0) {
      throw new BadRequestException('El monto del ingreso debe ser mayor que 0');
    }

    const repo = manager
      ? manager.getRepository(Income)
      : this.incomeRepository;

    const income = repo.create({
      userId,
      accountId: data.accountId,
      name: data.name,
      amount: data.amount,
      description: data.description ?? null,
      date: data.date ?? new Date(),
      sourceType: data.sourceType,
      sourceId: data.sourceId,
    });

    return repo.save(income);
  }

  /**
   * Lista ingresos del usuario con filtros por cuenta, rango de fechas y paginación.
   * Ordenado por date DESC, createdAt DESC.
   */
  async findAll(userId: string, query: QueryIncomeDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const qb = this.incomeRepository
      .createQueryBuilder('income')
      .where('income.userId = :userId', { userId })
      .andWhere('income.isDeleted = false');

    if (query.accountId) {
      qb.andWhere('income.accountId = :accountId', {
        accountId: query.accountId,
      });
    }

    if (query.from) {
      qb.andWhere('income.date >= :from', { from: new Date(query.from) });
    }

    if (query.to) {
      qb.andWhere('income.date <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('income.date', 'DESC')
      .addOrderBy('income.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: {
        items,
        total,
        page,
        limit,
        totalPages,
      },
      message: 'Ingresos obtenidos correctamente',
    };
  }

  /**
   * Obtiene un ingreso validando pertenencia al usuario y borrado lógico.
   */
  async findOne(userId: string, id: string) {
    const income = await this.incomeRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!income) {
      throw new NotFoundException('Ingreso no encontrado');
    }

    return {
      data: income,
      message: 'Ingreso obtenido correctamente',
    };
  }

  /**
   * Actualiza un ingreso.
   * Si sourceType !== MANUAL, solo se permite modificar name y description (monto lo gobierna el módulo origen).
   */
  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    const income = await this.incomeRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!income) {
      throw new NotFoundException('Ingreso no encontrado');
    }

    const isAutomatic = income.sourceType !== IncomeSourceType.MANUAL;

    if (isAutomatic && (dto.amount !== undefined || dto.accountId !== undefined)) {
      throw new BadRequestException(
        'No se puede modificar el monto o cuenta de un ingreso generado automáticamente',
      );
    }

    if (dto.accountId && dto.accountId !== income.accountId) {
      await this.accountsService.assertOwnership(userId, dto.accountId);
      income.accountId = dto.accountId;
    }

    if (dto.name !== undefined) {
      income.name = dto.name;
    }

    if (dto.description !== undefined) {
      income.description = dto.description;
    }

    if (dto.amount !== undefined && !isAutomatic) {
      income.amount = dto.amount;
    }

    if (dto.date !== undefined && !isAutomatic) {
      income.date = new Date(dto.date);
    }

    const updated = await this.incomeRepository.save(income);

    return {
      data: updated,
      message: 'Ingreso actualizado correctamente',
    };
  }

  /**
   * Borrado lógico del ingreso.
   * Si es de origen automático, lanza BadRequestException (debe revertirse desde el módulo de origen).
   */
  async remove(userId: string, id: string) {
    const income = await this.incomeRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!income) {
      throw new NotFoundException('Ingreso no encontrado');
    }

    if (income.sourceType !== IncomeSourceType.MANUAL) {
      throw new BadRequestException(
        'No se puede eliminar un ingreso generado automáticamente; debe revertirse desde su módulo de origen',
      );
    }

    income.isDeleted = true;
    income.deletedAt = new Date();
    await this.incomeRepository.save(income);

    return {
      data: null,
      message: 'Ingreso eliminado correctamente',
    };
  }
}
