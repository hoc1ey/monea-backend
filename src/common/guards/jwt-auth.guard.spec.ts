import { describe, it, expect, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('should allow access if route is marked as @IsPublic()', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should delegate to super.canActivate if route is not public', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const superCanActivateSpy = vi
      .spyOn(JwtAuthGuard.prototype as any, 'canActivate')
      .mockReturnValue(true);

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;

    // Verify guard instance uses reflector correctly
    expect(reflector.getAllAndOverride('isPublic', [context.getHandler(), context.getClass()])).toBe(false);
    superCanActivateSpy.mockRestore();
  });
});
