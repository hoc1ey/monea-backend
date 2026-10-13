import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountsService } from './accounts.service.js';
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Account } from './entities/account.entity.js';

describe('AccountsService', () => {
  let service: AccountsService;
  let mockAccountRepo: Partial<Repository<Account>>;

  beforeEach(() => {
    mockAccountRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      query: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    service = new AccountsService(mockAccountRepo as Repository<Account>);
  });

  describe('assertOwnership', () => {
    it('debe devolver la cuenta si pertenece al usuario y no está eliminada', async () => {
      const mockAccount = {
        id: 'acc-uuid',
        userId: 'user-uuid',
        name: 'Ahorros',
        financialInstitution: 'Banco',
        color: '#FFFFFF',
        initialBalance: 1000,
        description: null,
        isDeleted: false,
      } as Account;

      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(mockAccount);

      const result = await service.assertOwnership('user-uuid', 'acc-uuid');
      expect(result).toBe(mockAccount);
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'acc-uuid', userId: 'user-uuid', isDeleted: false },
      });
    });

    it('debe lanzar NotFoundException si la cuenta no existe o no pertenece al usuario', async () => {
      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(null);

      await expect(
        service.assertOwnership('user-uuid', 'acc-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('debe crear la cuenta con initialBalance y retornar el mensaje de éxito', async () => {
      const dto = {
        name: 'Nómina',
        financialInstitution: 'Bancolombia',
        color: '#10B981',
        initialBalance: 500.5,
        description: 'Cuenta nómina',
      };

      const createdAccount = {
        id: 'acc-1',
        userId: 'user-1',
        ...dto,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Account;

      vi.mocked(mockAccountRepo.create!).mockReturnValue(createdAccount);
      vi.mocked(mockAccountRepo.save!).mockResolvedValue(createdAccount);

      const result = await service.create('user-1', dto);

      expect(result.message).toBe('Cuenta creada correctamente');
      expect(result.data.id).toBe('acc-1');
      expect(result.data.currentBalance).toBe(500.5);
    });
  });

  describe('findAll', () => {
    it('debe listar cuentas del usuario con currentBalance calculado', async () => {
      vi.mocked(mockAccountRepo.query!).mockResolvedValue([
        { incomes: null, expenses: null },
      ]);

      const mockAccounts = [
        {
          id: 'acc-1',
          userId: 'user-1',
          name: 'Ahorros',
          financialInstitution: 'Banco A',
          color: '#3B82F6',
          initialBalance: 1000,
          isDeleted: false,
        } as Account,
      ];

      vi.mocked(mockAccountRepo.find!).mockResolvedValue(mockAccounts);

      const result = await service.findAll('user-1');

      expect(result.message).toBe('Cuentas obtenidas correctamente');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentBalance).toBe(1000);
    });
  });

  describe('findOne', () => {
    it('debe retornar la cuenta y el saldo calculado', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Ahorros',
        financialInstitution: 'Banco A',
        color: '#3B82F6',
        initialBalance: 1500.25,
        isDeleted: false,
      } as Account;

      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(mockAccount);
      vi.mocked(mockAccountRepo.query!).mockResolvedValue([
        { incomes: null, expenses: null },
      ]);

      const result = await service.findOne('user-1', 'acc-1');

      expect(result.message).toBe('Cuenta obtenida correctamente');
      expect(result.data.id).toBe('acc-1');
      expect(result.data.currentBalance).toBe(1500.25);
    });
  });

  describe('update', () => {
    it('debe actualizar los datos y avisar si se modificó el saldo inicial', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Ahorros',
        financialInstitution: 'Banco A',
        color: '#3B82F6',
        initialBalance: 1000,
        description: null,
        isDeleted: false,
      } as Account;

      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(mockAccount);
      vi.mocked(mockAccountRepo.query!).mockResolvedValue([
        { incomes: null, expenses: null },
      ]);
      vi.mocked(mockAccountRepo.save!).mockImplementation(async (acc) => acc as Account);

      const result = await service.update('user-1', 'acc-1', {
        initialBalance: 2000,
        name: 'Ahorros Principal',
      });

      expect(result.message).toContain('el saldo inicial fue modificado');
      expect(result.data.name).toBe('Ahorros Principal');
      expect(result.data.initialBalance).toBe(2000);
      expect(result.data.currentBalance).toBe(2000);
    });

    it('debe actualizar los datos sin nota de saldo si initialBalance no cambió', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Ahorros',
        financialInstitution: 'Banco A',
        color: '#3B82F6',
        initialBalance: 1000,
        description: null,
        isDeleted: false,
      } as Account;

      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(mockAccount);
      vi.mocked(mockAccountRepo.query!).mockResolvedValue([
        { incomes: null, expenses: null },
      ]);
      vi.mocked(mockAccountRepo.save!).mockImplementation(async (acc) => acc as Account);

      const result = await service.update('user-1', 'acc-1', {
        name: 'Nuevo Alias',
      });

      expect(result.message).toBe('Cuenta actualizada correctamente');
      expect(result.data.name).toBe('Nuevo Alias');
    });
  });

  describe('remove', () => {
    it('debe realizar borrado lógico (isDeleted = true, deletedAt asignado)', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Ahorros',
        isDeleted: false,
        deletedAt: null,
      } as Account;

      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(mockAccount);
      vi.mocked(mockAccountRepo.save!).mockImplementation(async (acc) => acc as Account);

      const result = await service.remove('user-1', 'acc-1');

      expect(mockAccount.isDeleted).toBe(true);
      expect(mockAccount.deletedAt).toBeInstanceOf(Date);
      expect(result.message).toBe('Cuenta eliminada correctamente');
      expect(result.data).toBeNull();
    });
  });

  describe('getBalance', () => {
    it('debe calcular correctamente el saldo sumando ingresos y restando egresos corrientes', async () => {
      const mockAccount = {
        id: 'acc-1',
        userId: 'user-1',
        name: 'Ahorros',
        initialBalance: 1000,
        isDeleted: false,
      } as Account;

      vi.mocked(mockAccountRepo.findOne!).mockResolvedValue(mockAccount);

      // Simular que existen las tablas y devuelven totales
      vi.mocked(mockAccountRepo.query!)
        .mockResolvedValueOnce([{ incomes: 'incomes', expenses: 'expenses' }])
        .mockResolvedValueOnce([{ total: '500.50' }])
        .mockResolvedValueOnce([{ total: '200.25' }]);

      const balance = await service.getBalance('acc-1', 'user-1');

      // 1000 + 500.50 - 200.25 = 1300.25
      expect(balance).toBe(1300.25);
    });
  });
});
