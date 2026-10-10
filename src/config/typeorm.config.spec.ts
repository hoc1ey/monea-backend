import { describe, it, expect, vi } from 'vitest';
import { typeOrmAsyncConfig } from './typeorm.config.js';
import { ConfigService } from '@nestjs/config';

describe('typeorm.config', () => {
  it('should generate correct TypeORM options from ConfigService', () => {
    const configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://postgres:postgres@localhost:5432/monea_dev';
        if (key === 'DB_SYNCHRONIZE') return true;
        return undefined;
      }),
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    } as unknown as ConfigService;

    if (typeof typeOrmAsyncConfig.useFactory === 'function') {
      const options = typeOrmAsyncConfig.useFactory(configService) as Record<string, unknown>;
      expect(options.type).toBe('postgres');
      expect(options.url).toBe('postgresql://postgres:postgres@localhost:5432/monea_dev');
      expect(options.autoLoadEntities).toBe(true);
      expect(options.synchronize).toBe(true);
      expect(options.ssl).toBe(false);
    }
  });

  it('should enable ssl in production', () => {
    const configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://postgres:postgres@localhost:5432/monea_prod';
        if (key === 'DB_SYNCHRONIZE') return false;
        return undefined;
      }),
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    } as unknown as ConfigService;

    if (typeof typeOrmAsyncConfig.useFactory === 'function') {
      const options = typeOrmAsyncConfig.useFactory(configService) as Record<string, unknown>;
      expect(options.ssl).toEqual({ rejectUnauthorized: false });
    }
  });
});
