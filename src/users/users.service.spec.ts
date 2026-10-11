import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersService } from './users.service.js';
import { ConflictException, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity.js';
import * as argon2 from 'argon2';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepo: Partial<Repository<User>>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('America/Bogota'),
    };

    service = new UsersService(
      mockUserRepo as Repository<User>,
      mockConfigService as ConfigService,
    );
  });

  describe('create', () => {
    it('should hash password with argon2id and save user without returning passwordHash', async () => {
      vi.mocked(mockUserRepo.findOne!).mockResolvedValue(null);
      vi.mocked(mockUserRepo.create!).mockImplementation((dto) => dto as any);
      vi.mocked(mockUserRepo.save!).mockImplementation(async (entity) => ({
        id: 'user-uuid',
        email: (entity as User).email,
        name: (entity as User).name,
        timezone: (entity as User).timezone,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
        refreshTokens: [],
      } as any));

      const result = await service.create({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });

      expect(result).toHaveProperty('id', 'user-uuid');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw ConflictException if email is already taken', async () => {
      vi.mocked(mockUserRepo.findOne!).mockResolvedValue({ id: 'existing-id' } as any);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if timezone is invalid', async () => {
      vi.mocked(mockUserRepo.findOne!).mockResolvedValue(null);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
          timezone: 'Invalid/Zone',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should verify current password and hash new password', async () => {
      const currentPasswordHash = await argon2.hash('OldPassword123', { type: argon2.argon2id });
      const mockUser = {
        id: 'user-uuid',
        passwordHash: currentPasswordHash,
      };

      const queryBuilder = {
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockUser),
      };
      vi.mocked(mockUserRepo.createQueryBuilder!).mockReturnValue(queryBuilder as any);
      vi.mocked(mockUserRepo.save!).mockResolvedValue(mockUser as any);

      const callback = vi.fn().mockResolvedValue(undefined);

      const result = await service.changePassword(
        'user-uuid',
        {
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword123',
        },
        callback,
      );

      expect(result.message).toBe('Contraseña actualizada correctamente');
      expect(callback).toHaveBeenCalledWith('user-uuid');
    });

    it('should throw UnauthorizedException if current password does not match', async () => {
      const currentPasswordHash = await argon2.hash('OldPassword123', { type: argon2.argon2id });
      const mockUser = {
        id: 'user-uuid',
        passwordHash: currentPasswordHash,
      };

      const queryBuilder = {
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockUser),
      };
      vi.mocked(mockUserRepo.createQueryBuilder!).mockReturnValue(queryBuilder as any);

      await expect(
        service.changePassword('user-uuid', {
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      vi.mocked(mockUserRepo.findOne!).mockResolvedValue({ id: 'user-uuid', name: 'User' } as any);
      const user = await service.findById('user-uuid');
      expect(user.id).toBe('user-uuid');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      vi.mocked(mockUserRepo.findOne!).mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
