# Monea Backend

API REST de finanzas personales construida con **NestJS 12**, **TypeORM** y
**PostgreSQL** (ESM). Incluye autenticación JWT, cuentas, ingresos, egresos,
tarjetas de crédito, egresos recurrentes, cobros, préstamos, deudas y listas de
compras.

## Requisitos

- Node.js 20+
- pnpm
- PostgreSQL
- Redis (rate limiting, sesiones y locks de schedulers)

## Instalación

```bash
pnpm install
```

## Configuración

Copia `.env.example` a `.env` y completa los valores. Las variables se validan
con **Zod** al arrancar (`src/config/env.schema.ts`): si falta una o tiene
formato inválido, la aplicación **no arranca**.

```bash
cp .env.example .env
```

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | No | `development` \| `production` \| `test` (default `development`) |
| `PORT` | No | Puerto HTTP (default `3000`) |
| `DATABASE_URL` | Sí | URL de PostgreSQL (`postgres://` o `postgresql://`) |
| `DB_SYNCHRONIZE` | Sí | `true` para que TypeORM sincronice el esquema (solo desarrollo) |
| `REDIS_URL` | Sí | URL de Redis (`redis://` o `rediss://`) |
| `JWT_ACCESS_SECRET` | Sí | Secreto del access token (mínimo 32 caracteres) |
| `JWT_REFRESH_SECRET` | Sí | Secreto del refresh token (mínimo 32 caracteres) |
| `JWT_ACCESS_EXPIRES_SECONDS` | Sí | Vida del access token en segundos (ej. `900`) |
| `JWT_REFRESH_EXPIRES_DAYS` | Sí | Vida del refresh token en días (ej. `30`) |
| `RATE_LIMIT_ENABLED` | Sí | Activa/desactiva el rate limiting |
| `RATE_LIMIT_STRICT_LIMIT` | Sí | Límite de peticiones en rutas públicas |
| `RATE_LIMIT_STRICT_TTL_SECONDS` | Sí | Ventana (segundos) del límite estricto |
| `RATE_LIMIT_STRICT_BLOCK_SECONDS` | Sí | Duración del bloqueo estricto |
| `RATE_LIMIT_RELAXED_LIMIT` | Sí | Límite de peticiones en rutas autenticadas |
| `RATE_LIMIT_RELAXED_TTL_SECONDS` | Sí | Ventana (segundos) del límite relajado |
| `RATE_LIMIT_RELAXED_BLOCK_SECONDS` | Sí | Duración del bloqueo relajado |
| `ACCOUNT_LOCK_5_MINUTES` | Sí | Bloqueo de cuenta a los 5–6 intentos fallidos |
| `ACCOUNT_LOCK_7_MINUTES` | Sí | Bloqueo de cuenta a los 7 intentos fallidos |
| `ACCOUNT_LOCK_8_MINUTES` | Sí | Bloqueo de cuenta a los 8 intentos fallidos |
| `ACCOUNT_LOCK_9_PLUS_MINUTES` | Sí | Bloqueo de cuenta a los 9+ intentos fallidos |
| `IP_LOCK_WINDOW_MINUTES` | Sí | Ventana para contar fallos por IP |
| `IP_LOCK_MINUTES` | Sí | Duración del bloqueo por IP |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Sí | Service account de FCM en Base64 (puede ser `e30=` en local) |
| `MAIL_HOST` | Sí | Host SMTP (ej. `smtp.gmail.com`) |
| `MAIL_PORT` | Sí | Puerto SMTP (ej. `587` o `465`) |
| `MAIL_SECURE` | Sí | `true` para SMTP sobre TLS directo (puerto 465) |
| `MAIL_USER` | Sí | Usuario SMTP |
| `MAIL_PASSWORD` | Sí | Contraseña o app password SMTP |
| `MAIL_FROM` | Sí | Remitente de los correos (correo válido) |
| `MAIL_FROM_NAME` | No | Nombre visible del remitente (default `Monea`) |
| `EMAIL_VERIFICATION_CODE_TTL_MINUTES` | No | Vigencia del código de verificación (default `15`) |
| `DEFAULT_TIMEZONE` | Sí | Zona horaria IANA por defecto (ej. `America/Bogota`) |
| `SCHEDULER_ENABLED` | Sí | Habilita los schedulers de recordatorios y recurrencias |

## Comandos

```bash
# desarrollo (watch)
pnpm run start:dev

# producción
pnpm run build && pnpm run start:prod

# pruebas unitarias (vitest)
pnpm run test

# pruebas e2e (requieren Postgres + Redis reales y .env válido)
pnpm run test:e2e

# cobertura
pnpm run test:cov

# lint (oxlint, type-aware)
pnpm run lint
```

## Documentación de la API

Con el servidor corriendo, Swagger está disponible en
`http://localhost:PORT/api/docs`. Todas las rutas están documentadas y las
públicas se marcan con `@IsPublic()`. El prefijo global es `api/v1`, salvo
`/health`.

## Notas de arquitectura

- Las respuestas usan un contrato uniforme
  `{ success, statusCode, data, message, errors }` (interceptor + filtro
  globales).
- No hay migraciones: TypeORM usa `autoLoadEntities` + `synchronize` con
  `DB_SYNCHRONIZE`.
- Nada se borra físicamente: todas las entidades extienden `BaseEntity`
  (`isDeleted`, `deletedAt`) y las consultas filtran `isDeleted: false`.
- Las fechas se almacenan en UTC (`timestamptz`) y se convierten con el
  `timezone` del usuario para recordatorios y recurrencias.
- Los montos usan `numeric(14,2)` y cálculos con `decimal.js`.
