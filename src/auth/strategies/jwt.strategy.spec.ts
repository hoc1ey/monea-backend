import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtStrategy, JwtPayload } from './jwt.strategy.js';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockRedis: Partial<Redis>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
    };

    mockConfigService = {
      getOrThrow: vi.fn().mockReturnValue('test_secret_with_32_characters_minimum'),
    };

    strategy = new JwtStrategy(
      mockConfigService as ConfigService,
      mockRedis as Redis,
    );
  });

  it('should validate and return user payload when jti exists in Redis and matches userId', async () => {
    vi.mocked(mockRedis.get!).mockResolvedValue('user-uuid');

    const payload: JwtPayload = {
      sub: 'user-uuid',
      email: 'user@example.com',
      jti: 'jti-uuid',
    };

    const result = await strategy.validate(payload);
    expect(result).toEqual({
      id: 'user-uuid',
      email: 'user@example.com',
      jti: 'jti-uuid',
    });
    expect(mockRedis.get).toHaveBeenCalledWith('auth:access:jti-uuid');
  });

  it('should throw UnauthorizedException when jti does not exist in Redis', async () => {
    vi.mocked(mockRedis.get!).mockResolvedValue(null);

    const payload: JwtPayload = {
      sub: 'user-uuid',
      email: 'user@example.com',
      jti: 'jti-uuid',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when jti in Redis does not match sub', async () => {
    vi.mocked(mockRedis.get!).mockResolvedValue('another-user-uuid');

    const payload: JwtPayload = {
      sub: 'user-uuid',
      email: 'user@example.com',
      jti: 'jti-uuid',
    };

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
