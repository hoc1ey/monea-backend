import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: Partial<UsersService>;

  beforeEach(() => {
    mockUsersService = {
      findById: vi.fn().mockResolvedValue({ id: 'user-1', name: 'User 1' } as any),
      updateProfile: vi.fn().mockResolvedValue({ id: 'user-1', name: 'User Updated' } as any),
      changePassword: vi.fn().mockResolvedValue({ message: 'Contraseña actualizada correctamente' }),
    };

    controller = new UsersController(mockUsersService as UsersService);
  });

  it('getProfile should return standardized user data', async () => {
    const result = await controller.getProfile('user-1');
    expect(result.data).toEqual({ id: 'user-1', name: 'User 1' });
    expect(result.message).toBe('Perfil obtenido correctamente');
  });

  it('updateProfile should return updated user data', async () => {
    const result = await controller.updateProfile('user-1', { name: 'User Updated' });
    expect(result.data).toEqual({ id: 'user-1', name: 'User Updated' });
    expect(result.message).toBe('Perfil actualizado correctamente');
  });

  it('changePassword should return success message', async () => {
    const result = await controller.changePassword('user-1', {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
    });
    expect(result.message).toBe('Contraseña actualizada correctamente');
  });
});
