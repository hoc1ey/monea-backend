import { z } from 'zod';

const booleanCoerce = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((val) => val === 'true'),
]);

const positiveInt = z.coerce.number().int().positive();

const ianaTimezone = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Debe ser una zona horaria IANA válida (ej. America/Bogota)' },
);

const postgresUrl = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith('postgres://') || url.startsWith('postgresql://'),
    { message: 'Debe ser una URL de PostgreSQL válida (postgres:// o postgresql://)' },
  );

const redisUrl = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith('redis://') || url.startsWith('rediss://'),
    { message: 'Debe ser una URL de Redis válida (redis:// o rediss://)' },
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: postgresUrl,
  DB_SYNCHRONIZE: booleanCoerce,
  REDIS_URL: redisUrl,
  JWT_ACCESS_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_SECONDS: positiveInt,
  JWT_REFRESH_EXPIRES_DAYS: positiveInt,
  RATE_LIMIT_ENABLED: booleanCoerce,
  RATE_LIMIT_STRICT_LIMIT: positiveInt,
  RATE_LIMIT_STRICT_TTL_SECONDS: positiveInt,
  RATE_LIMIT_STRICT_BLOCK_SECONDS: positiveInt,
  RATE_LIMIT_RELAXED_LIMIT: positiveInt,
  RATE_LIMIT_RELAXED_TTL_SECONDS: positiveInt,
  RATE_LIMIT_RELAXED_BLOCK_SECONDS: positiveInt,
  ACCOUNT_LOCK_5_MINUTES: positiveInt,
  ACCOUNT_LOCK_7_MINUTES: positiveInt,
  ACCOUNT_LOCK_8_MINUTES: positiveInt,
  ACCOUNT_LOCK_9_PLUS_MINUTES: positiveInt,
  IP_LOCK_WINDOW_MINUTES: positiveInt,
  IP_LOCK_MINUTES: positiveInt,
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().min(1, 'No puede estar vacío'),
  MAIL_HOST: z.string().min(1, 'No puede estar vacío'),
  MAIL_PORT: positiveInt,
  MAIL_SECURE: booleanCoerce,
  MAIL_USER: z.string().min(1, 'No puede estar vacío'),
  MAIL_PASSWORD: z.string().min(1, 'No puede estar vacío'),
  MAIL_FROM: z.email('Debe ser un correo electrónico válido'),
  MAIL_FROM_NAME: z.string().min(1).default('Monea'),
  EMAIL_VERIFICATION_CODE_TTL_MINUTES: positiveInt.default(15),
  DEFAULT_TIMEZONE: ianaTimezone,
  SCHEDULER_ENABLED: booleanCoerce,
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `❌ [Config Error] Variable "${path}": ${issue.message}`;
    });

    console.error('\n' + '='.repeat(60));
    console.error('ERROR EN LA CONFIGURACIÓN DE VARIABLES DE ENTORNO:');
    console.error('='.repeat(60));
    for (const msg of errorMessages) {
      console.error(msg);
    }
    console.error('='.repeat(60) + '\n');

    throw new Error(`Configuración de entorno inválida:\n${errorMessages.join('\n')}`);
  }

  return result.data;
}
