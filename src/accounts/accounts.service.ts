import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    protected readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Valida que la cuenta exista, no esté eliminada y pertenezca al usuario autenticado.
   * Reutilizable por otros módulos (Income, Expense, Loan, etc.).
   * Si no pertenece al usuario o está eliminada, lanza NotFoundException.
   */
  async assertOwnership(userId: string, accountId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, userId, isDeleted: false },
    });

    if (!account) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    return account;
  }

  /**
   * Crea una nueva cuenta bancaria asociada al usuario autenticado.
   */
  async create(userId: string, dto: CreateAccountDto) {
    const account = this.accountRepository.create({
      userId,
      name: dto.name,
      financialInstitution: dto.financialInstitution,
      color: dto.color,
      initialBalance: dto.initialBalance,
      description: dto.description ?? null,
    });

    const saved = await this.accountRepository.save(account);

    return {
      data: saved,
      message: 'Cuenta creada correctamente',
    };
  }

  /**
   * Lista todas las cuentas activas del usuario.
   */
  async findAll(userId: string) {
    const accounts = await this.accountRepository.find({
      where: { userId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return {
      data: accounts,
      message: 'Cuentas obtenidas correctamente',
    };
  }

  /**
   * Obtiene una cuenta específica del usuario autenticado.
   */
  async findOne(userId: string, id: string) {
    const account = await this.assertOwnership(userId, id);

    return {
      data: account,
      message: 'Cuenta obtenida correctamente',
    };
  }

  /**
   * Actualiza una cuenta bancaria. Permite editar alias, institución, color, descripción y saldo inicial.
   * Si se edita el saldo inicial, se informa en el mensaje.
   */
  async update(userId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.assertOwnership(userId, id);

    const initialBalanceModified =
      dto.initialBalance !== undefined &&
      dto.initialBalance !== account.initialBalance;

    if (dto.name !== undefined) {
      account.name = dto.name;
    }
    if (dto.financialInstitution !== undefined) {
      account.financialInstitution = dto.financialInstitution;
    }
    if (dto.color !== undefined) {
      account.color = dto.color;
    }
    if (dto.initialBalance !== undefined) {
      account.initialBalance = dto.initialBalance;
    }
    if (dto.description !== undefined) {
      account.description = dto.description;
    }

    const updated = await this.accountRepository.save(account);

    const message = initialBalanceModified
      ? 'Cuenta actualizada correctamente (el saldo inicial fue modificado y afectó el saldo calculado actual)'
      : 'Cuenta actualizada correctamente';

    return {
      data: updated,
      message,
    };
  }

  /**
   * Borrado lógico de una cuenta bancaria (isDeleted = true, deletedAt = fecha actual).
   * Los registros de ingresos/egresos históricos se conservan.
   */
  async remove(userId: string, id: string) {
    const account = await this.assertOwnership(userId, id);

    account.isDeleted = true;
    account.deletedAt = new Date();
    await this.accountRepository.save(account);

    return {
      data: null,
      message: 'Cuenta eliminada correctamente',
    };
  }
}
