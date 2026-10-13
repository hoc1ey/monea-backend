import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncomesService } from './incomes.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { Repository, EntityManager } from 'typeorm';
import { Income } from './entities/income.entity.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { IncomeSourceType } from './incomes.constants.js';

describe('IncomesService', () => {
  let service: IncomesService;
  let mockIncomeRepo: Partial<Repository<Income>>;
  let mockAccountsService: Partial<AccountsService>;

  beforeEach(() => {
    mockIncomeRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockAccountsService = {
      assertOwnership: vi.fn(),
    };

    service = new IncomesService(
      mockIncomeRepo as Repository<Income>,
      mockAccountsService as AccountsService,
    );
  });

  describe('create', () => {
    it('debe registrar un ingreso manual validando la cuenta', async () => {
      vi.mocked(mockAccountsService.assertOwnership!).mockResolvedValue({} as any);

      const dto = {
        accountId: 'acc-1',
        name: 'Nómina',
        amount: 2500,
        description: 'Pago quincenal',
      };

      const created = {
        id: 'inc-1',
        userId: 'user-1',
        ...dto,
        sourceType: IncomeSourceType.MANUAL,
        sourceId: null,
      } as Income;

      vi.mocked(mockIncomeRepo.create!).mockReturnValue(created);
      vi.mocked(mockIncomeRepo.save!).mockResolvedValue(created);

      const result = await service.create('user-1', dto);

      expect(mockAccountsService.assertOwnership).toHaveBeenCalledWith('user-1', 'acc-1');
      expect(result.message).toBe('Ingreso registrado correctamente');
      expect(result.data.id).toBe('inc-1');
    });
  });

  describe('createFromSource', () => {
    it('debe crear un ingreso desde Cobros o Préstamos usando manager opcional', async () => {
      vi.mocked(mockAccountsService.assertOwnership!).mockResolvedValue({} as any);

      const mockManagerRepo = {
        create: vi.fn(),
        save: vi.fn(),
      };
      const mockManager = {
        getRepository: vi.fn().mockReturnValue(mockManagerRepo),
      } as unknown as EntityManager;

      const input = {
        accountId: 'acc-1',
        name: 'Pago de cuota de cobro',
        amount: 300,
        sourceType: IncomeSourceType.COLLECTION_INSTALLMENT,
        sourceId: 'collection-installment-1',
      };

      const created = {
        id: 'inc-auto-1',
        userId: 'user-1',
        ...input,
      } as Income;

      mockManagerRepo.create.mockReturnValue(created);
      mockManagerRepo.save.mockResolvedValue(created);

      const result = await service.createFromSource('user-1', input, mockManager);

      expect(mockAccountsService.assertOwnership).toHaveBeenCalledWith('user-1', 'acc-1');
      expect(mockManager.getRepository).toHaveBeenCalledWith(Income);
      expect(result.id).toBe('inc-auto-1');
      expect(result.sourceType).toBe(IncomeSourceType.COLLECTION_INSTALLMENT);
    });

    it('debe lanzar BadRequestException si el monto es <= 0', async () => {
      vi.mocked(mockAccountsService.assertOwnership!).mockResolvedValue({} as any);

      await expect(
        service.createFromSource('user-1', {
          accountId: 'acc-1',
          name: 'Inválido',
          amount: 0,
          sourceType: IncomeSourceType.LOAN_INSTALLMENT,
          sourceId: 'loan-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('debe listar ingresos paginados aplicando filtros', async () => {
      const qbMock = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[{ id: 'inc-1' }], 1]),
      };

      vi.mocked(mockIncomeRepo.createQueryBuilder!).mockReturnValue(qbMock as any);

      const result = await service.findAll('user-1', {
        page: 1,
        limit: 10,
        accountId: 'acc-1',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
      });

      expect(result.message).toBe('Ingresos obtenidos correctamente');
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(result.data.totalPages).toBe(1);
      expect(qbMock.andWhere).toHaveBeenCalledWith('income.accountId = :accountId', {
        accountId: 'acc-1',
      });
    });
  });

  describe('findOne', () => {
    it('debe retornar el ingreso si pertenece al usuario', async () => {
      const income = { id: 'inc-1', userId: 'user-1' } as Income;
      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(income);

      const result = await service.findOne('user-1', 'inc-1');

      expect(result.data).toBe(income);
      expect(result.message).toBe('Ingreso obtenido correctamente');
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(null);

      await expect(service.findOne('user-1', 'inc-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('debe actualizar campos de un ingreso manual', async () => {
      const income = {
        id: 'inc-1',
        userId: 'user-1',
        name: 'Antiguo',
        amount: 100,
        sourceType: IncomeSourceType.MANUAL,
        accountId: 'acc-1',
      } as Income;

      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(income);
      vi.mocked(mockIncomeRepo.save!).mockImplementation(async (inc) => inc as Income);

      const result = await service.update('user-1', 'inc-1', {
        name: 'Nuevo',
        amount: 150,
      });

      expect(result.message).toBe('Ingreso actualizado correctamente');
      expect(result.data.name).toBe('Nuevo');
      expect(result.data.amount).toBe(150);
    });

    it('debe rechazar la modificación de monto si el ingreso es automático', async () => {
      const autoIncome = {
        id: 'inc-auto',
        userId: 'user-1',
        name: 'Cuota',
        amount: 200,
        sourceType: IncomeSourceType.COLLECTION_INSTALLMENT,
        sourceId: 'src-1',
      } as Income;

      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(autoIncome);

      await expect(
        service.update('user-1', 'inc-auto', {
          amount: 300,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe permitir modificar solo nombre y descripción en ingresos automáticos', async () => {
      const autoIncome = {
        id: 'inc-auto',
        userId: 'user-1',
        name: 'Cuota Original',
        description: null,
        amount: 200,
        sourceType: IncomeSourceType.COLLECTION_INSTALLMENT,
        sourceId: 'src-1',
      } as Income;

      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(autoIncome);
      vi.mocked(mockIncomeRepo.save!).mockImplementation(async (inc) => inc as Income);

      const result = await service.update('user-1', 'inc-auto', {
        name: 'Cuota Modificada',
        description: 'Nota extra',
      });

      expect(result.data.name).toBe('Cuota Modificada');
      expect(result.data.description).toBe('Nota extra');
      expect(result.data.amount).toBe(200);
    });
  });

  describe('remove', () => {
    it('debe realizar borrado lógico en ingresos manuales', async () => {
      const income = {
        id: 'inc-1',
        userId: 'user-1',
        sourceType: IncomeSourceType.MANUAL,
        isDeleted: false,
        deletedAt: null,
      } as Income;

      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(income);
      vi.mocked(mockIncomeRepo.save!).mockImplementation(async (inc) => inc as Income);

      const result = await service.remove('user-1', 'inc-1');

      expect(income.isDeleted).toBe(true);
      expect(income.deletedAt).toBeInstanceOf(Date);
      expect(result.message).toBe('Ingreso eliminado correctamente');
    });

    it('debe lanzar BadRequestException si se intenta eliminar un ingreso automático', async () => {
      const autoIncome = {
        id: 'inc-auto',
        userId: 'user-1',
        sourceType: IncomeSourceType.LOAN_INSTALLMENT,
        isDeleted: false,
      } as Income;

      vi.mocked(mockIncomeRepo.findOne!).mockResolvedValue(autoIncome);

      await expect(service.remove('user-1', 'inc-auto')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
