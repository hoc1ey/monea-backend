import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';
import type { AuthService } from '../auth/auth.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: Partial<UsersService>;
  let mockAuthService: Partial<AuthService>;

  beforeEach(() => {
    mockUsersService = {
      findById: vi.fn().mockResolvedValue({ id: 'user-1', name: 'User 1' } as any),
      updateProfile: vi.fn().mockResolvedValue({ id: 'user-1', name: 'User Updated' } as any),
      changePassword: vi.fn().mockResolvedValue({ message: 'Contraseña actualizada correctamente' }),
    };

    mockAuthService = {
      logoutAll: vi.fn().mockResolvedValue({ message: 'Todas las sesiones activas han sido cerradas' }),
    };

    controller = new UsersController(
      mockUsersService as UsersService,
      mockAuthService as AuthService,
    );
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

  it('changePassword should return success message and revoke all sessions', async () => {
    const result = await controller.changePassword('user-1', {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword123',
    });
    expect(result.message).toBe('Contraseña actualizada correctamente');
    expect(mockUsersService.changePassword).toHaveBeenCalledWith(
      'user-1',
      { currentPassword: 'OldPassword123', newPassword: 'NewPassword123' },
      expect.any(Function),
    );
  });
});
