## F00 — Base del proyecto

**Objetivo:** dejar listo el esqueleto: configuración validada con Zod, conexión a PostgreSQL y Redis, entidad base con borrado lógico, interceptor/filtro de respuesta y validación global.

- **Rama:** `feature/00-project-base`

### Pasos

1. `nest new monea-backend --package-manager pnpm` y **eliminar** `src/modules` si existe.
2. Crear `src/config/env.schema.ts` con Zod (ver tabla de variables abajo). En `ConfigModule.forRoot({ isGlobal: true, validate: (env) => schema.parse(env) })`. Capturar `ZodError` y mostrar un mensaje legible por variable antes de abortar el arranque.
3. Crear `RedisModule` global (proveedor `REDIS_CLIENT` con `ioredis`).
4. Configurar `TypeOrmModule.forRootAsync` (`autoLoadEntities: true`, `synchronize: env.DB_SYNCHRONIZE`).
5. Crear `common/entities/base.entity.ts`:
   - `id` (uuid, PK), `createdAt`, `updatedAt`, `isDeleted` (bool, default false, indexado), `deletedAt` (nullable).
6. Crear `DecimalTransformer`.
7. Crear `ResponseInterceptor` y `AllExceptionsFilter` (contrato de 0.3).
8. En `main.ts`: `setGlobalPrefix('api/v1')`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, `helmet()`, CORS configurable, `enableShutdownHooks()`.
9. Crear helpers de soft delete: método utilitario `softDelete(repo, id, userId)` que hace `update({ id, userId }, { isDeleted: true, deletedAt: new Date() })`.
10. Endpoint `GET /health` con `@IsPublic()` (el decorador se crea en F01; hasta entonces es público por no haber guard).

### Variables de entorno (Zod)

| Variable | Tipo / Validación |
|---|---|
| `NODE_ENV` | enum `development \| production \| test` |
| `PORT` | número entero |
| `DATABASE_URL` | URL postgres |
| `DB_SYNCHRONIZE` | `'true' \| 'false'` → boolean |
| `REDIS_URL` | URL redis |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | string ≥ 32 caracteres |
| `JWT_ACCESS_EXPIRES_SECONDS` | entero positivo (ej. 900) |
| `JWT_REFRESH_EXPIRES_DAYS` | entero positivo (ej. 30) |
| `RATE_LIMIT_ENABLED` | `'true' \| 'false'` |
| `RATE_LIMIT_STRICT_LIMIT` / `_TTL_SECONDS` / `_BLOCK_SECONDS` | enteros positivos |
| `RATE_LIMIT_RELAXED_LIMIT` / `_TTL_SECONDS` / `_BLOCK_SECONDS` | enteros positivos |
| `ACCOUNT_LOCK_5_MINUTES` | entero (ej. 15) — 5 y 6 intentos |
| `ACCOUNT_LOCK_7_MINUTES` | entero (ej. 30) |
| `ACCOUNT_LOCK_8_MINUTES` | entero (ej. 120) |
| `ACCOUNT_LOCK_9_PLUS_MINUTES` | entero (ej. 300) |
| `IP_LOCK_WINDOW_MINUTES` | entero (ej. 5) |
| `IP_LOCK_MINUTES` | entero (ej. 15) |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | string no vacío (JSON del service account en base64) |
| `DEFAULT_TIMEZONE` | string IANA válido |
| `SCHEDULER_ENABLED` | `'true' \| 'false'` |

Incluir un `.env.example` completo y agregar `.env` a `.gitignore`.

### Dependencias

```bash
pnpm add @nestjs/config zod @nestjs/typeorm typeorm pg ioredis class-validator class-transformer helmet decimal.js
pnpm add @nestjs/swagger          # opcional, documentación
```

### Commits

```
chore: inicializar proyecto NestJS con pnpm y estructura de carpetas
feat(config): validar variables de entorno con zod y abortar arranque si fallan
feat(config): configurar TypeORM sin migraciones y modulo global de Redis
feat(common): agregar BaseEntity con borrado logico y DecimalTransformer
feat(common): agregar interceptor y filtro global de formato de respuesta
chore: configurar ValidationPipe, helmet, prefijo global y health check
```

---
