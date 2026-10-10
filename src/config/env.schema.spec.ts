import { describe, it, expect, vi } from 'vitest';
import { validateEnv, envSchema } from './env.schema.js';

describe('env.schema', () => {
  const validEnv: Record<string, unknown> = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/monea_dev',
    DB_SYNCHRONIZE: 'true',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'monea_super_secret_access_token_32chars_min',
    JWT_REFRESH_SECRET: 'monea_super_secret_refresh_token_32chars_min',
    JWT_ACCESS_EXPIRES_SECONDS: '900',
    JWT_REFRESH_EXPIRES_DAYS: '30',
    RATE_LIMIT_ENABLED: 'true',
    RATE_LIMIT_STRICT_LIMIT: '5',
    RATE_LIMIT_STRICT_TTL_SECONDS: '60',
    RATE_LIMIT_STRICT_BLOCK_SECONDS: '60',
    RATE_LIMIT_RELAXED_LIMIT: '30',
    RATE_LIMIT_RELAXED_TTL_SECONDS: '60',
    RATE_LIMIT_RELAXED_BLOCK_SECONDS: '60',
    ACCOUNT_LOCK_5_MINUTES: '15',
    ACCOUNT_LOCK_7_MINUTES: '30',
    ACCOUNT_LOCK_8_MINUTES: '120',
    ACCOUNT_LOCK_9_PLUS_MINUTES: '300',
    IP_LOCK_WINDOW_MINUTES: '5',
    IP_LOCK_MINUTES: '15',
    FIREBASE_SERVICE_ACCOUNT_BASE64: 'e30=',
    DEFAULT_TIMEZONE: 'America/Bogota',
    SCHEDULER_ENABLED: 'true',
  };

  it('should validate valid environment configuration successfully', () => {
    const config = validateEnv(validEnv);
    expect(config.PORT).toBe(3000);
    expect(config.DB_SYNCHRONIZE).toBe(true);
    expect(config.RATE_LIMIT_ENABLED).toBe(true);
    expect(config.SCHEDULER_ENABLED).toBe(true);
  });

  it('should throw an error with legible details on invalid env vars', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const invalidEnv = { ...validEnv, JWT_ACCESS_SECRET: 'too_short' };

    expect(() => validateEnv(invalidEnv)).toThrowError(/Configuración de entorno inválida/);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should reject invalid timezone', () => {
    const invalidEnv = { ...validEnv, DEFAULT_TIMEZONE: 'Invalid/Timezone' };
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('should reject non-postgres database url', () => {
    const invalidEnv = { ...validEnv, DATABASE_URL: 'mysql://root@localhost/db' };
    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });
});
