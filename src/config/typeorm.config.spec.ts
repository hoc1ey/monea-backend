import { describe, it, expect, vi } from 'vitest';
import { typeOrmAsyncConfig } from './typeorm.config.js';
import { ConfigService } from '@nestjs/config';

function createConfigService(dbSsl: boolean): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (key === 'DATABASE_URL')
        return 'postgresql://postgres:postgres@localhost:5432/monea_dev';
      if (key === 'DB_SYNCHRONIZE') return true;
      if (key === 'DB_SSL') return dbSsl;
      return undefined;
    }),
    get: vi.fn(),
  } as unknown as ConfigService;
}

describe('typeorm.config', () => {
  it('should generate correct TypeORM options from ConfigService', () => {
    const configService = createConfigService(false);

    if (typeof typeOrmAsyncConfig.useFactory === 'function') {
      const options = typeOrmAsyncConfig.useFactory(configService) as Record<
        string,
        unknown
      >;
      expect(options.type).toBe('postgres');
      expect(options.url).toBe(
        'postgresql://postgres:postgres@localhost:5432/monea_dev',
      );
      expect(options.autoLoadEntities).toBe(true);
      expect(options.synchronize).toBe(true);
      expect(options.ssl).toBe(false);
    }
  });

  it('should enable ssl when DB_SSL is true', () => {
    const configService = createConfigService(true);

    if (typeof typeOrmAsyncConfig.useFactory === 'function') {
      const options = typeOrmAsyncConfig.useFactory(configService) as Record<
        string,
        unknown
      >;
      expect(options.ssl).toEqual({ rejectUnauthorized: false });
    }
  });

  it('should disable ssl when DB_SSL is false', () => {
    const configService = createConfigService(false);

    if (typeof typeOrmAsyncConfig.useFactory === 'function') {
      const options = typeOrmAsyncConfig.useFactory(configService) as Record<
        string,
        unknown
      >;
      expect(options.ssl).toBe(false);
    }
  });
});
