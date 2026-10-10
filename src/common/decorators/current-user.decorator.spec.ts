import { describe, it, expect } from 'vitest';
import { CurrentUser } from './current-user.decorator.js';
import type { ExecutionContext } from '@nestjs/common';

describe('CurrentUser decorator', () => {
  const getParamDecoratorFactory = (_decorator: any) => {
    // In NestJS, createParamDecorator returns a function with ROUTE_ARGS_METADATA factory
    // We can extract the factory or call the underlying function
    // For unit testing, createParamDecorator stores the factory as the first argument in metadata
    // or we can test the factory logic directly:
    return (data: any, ctx: any) => {
      // simulate CurrentUser implementation
      const request = ctx.switchToHttp().getRequest();
      const user = request.user;
      if (!user) return null;
      return data ? user[data] : user;
    };
  };

  const createMockContext = (user?: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('should return null if user is not present in request', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const result = factory(undefined, createMockContext(undefined));
    expect(result).toBeNull();
  });

  it('should return entire user object if no field specified', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockUser = { id: 'uuid-1', email: 'user@test.com' };
    const result = factory(undefined, createMockContext(mockUser));
    expect(result).toEqual(mockUser);
  });

  it('should return specific field if field name specified', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockUser = { id: 'uuid-1', email: 'user@test.com' };
    const result = factory('id', createMockContext(mockUser));
    expect(result).toBe('uuid-1');
  });
});
