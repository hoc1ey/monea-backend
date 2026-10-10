# MONEA — Plan de implementación del backend (por features)

> Monolito modular **NestJS** · API REST · **PostgreSQL** (TypeORM, sin migraciones) · **Redis** · **Firebase Cloud Messaging** · **Zod** para variables de entorno · gestor **pnpm**.

---

## 0. Convenciones globales (aplican a TODAS las features)

### 0.1 Reglas de arquitectura (extraídas de los documentos)

| Regla | Cómo se cumple |
|---|---|
| Módulos hijos directos de `src` | Eliminar `src/modules`. Generar con `nest g resource <nombre> --no-spec` (o `nest g mo/co/s`). |
| TypeORM **sin migraciones** | `TypeOrmModule.forRootAsync` con `autoLoadEntities: true`, `synchronize` controlado por `DB_SYNCHRONIZE` (zod). No crear carpeta `migrations`. |
| **Nada se borra** | Toda entidad extiende `BaseEntity` con `isDeleted: boolean` (default `false`) y `deletedAt`. Ningún `DELETE`/`remove()`; solo `isDeleted = true`. Toda consulta filtra `isDeleted: false`. |
| Formato único de respuesta | Interceptor global + filtro global de excepciones (ver 0.3). |
| Autenticación por defecto | `JwtAuthGuard` global (`APP_GUARD`). Rutas públicas con `@IsPublic()`. |
| **Nunca** enviar `userId` en requests | Se obtiene del JWT con `@CurrentUser('id')`. Todas las queries filtran por `userId`; si el recurso no es del usuario → `NotFoundException`. |
| Rate limit desde `.env` | `@nestjs/throttler` con 2 throttlers (`strict` / `relaxed`). |
| Tiempos de bloqueo desde `.env` | Solo los tiempos; el bloqueo siempre está activo. |
| Variables de entorno validadas con **Zod** | Si falta o tiene formato inválido, la app **no arranca**. |

### 0.2 Estructura de carpetas

```
src/
├── main.ts
├── app.module.ts
├── config/              # env.schema.ts (zod), typeorm.config.ts, redis.module.ts
├── common/
│   ├── entities/        # base.entity.ts
│   ├── decorators/      # is-public.decorator.ts, current-user.decorator.ts
│   ├── guards/          # jwt-auth.guard.ts, rate-limit.guard.ts
│   ├── interceptors/    # response.interceptor.ts
│   ├── filters/         # all-exceptions.filter.ts
│   ├── dto/             # pagination.dto.ts, period.dto.ts
│   ├── transformers/    # decimal.transformer.ts
│   └── utils/           # money.util.ts (decimal.js), date.util.ts (periodos, recurrencias)
├── auth/  users/  accounts/  notifications/  incomes/  credit-cards/
├── expenses/  recurring-expenses/  collections/  loans/  debts/  shopping-lists/
```

### 0.3 Contrato de respuesta

**Éxito** (el servicio devuelve `{ data, message }`; el interceptor completa el resto):

```json
{ "success": true, "statusCode": 200, "data": { }, "message": "Cuenta creada correctamente", "errors": null }
```

**Error** (el servicio solo lanza excepciones; el filtro/interceptor completa el resto):

```json
{ "success": false, "statusCode": 404, "data": null, "message": "Cuenta no encontrada", "errors": ["Cuenta no encontrada"] }
```

Reglas:
- **Toda respuesta exitosa tiene `message`**; **toda fallida tiene `errors`** (array).
- Errores de `class-validator` (400) → `errors` = lista de mensajes por campo.
- Los guards se ejecutan **antes** que los interceptors: por eso se necesita **además** un `ExceptionFilter` global (`catch()` de `HttpException` y errores desconocidos → 500 con mensaje genérico, sin filtrar stack).
- El `statusCode` de éxito se lee de `response.statusCode`.

### 0.4 Dinero y fechas

- Montos: columna `numeric(14,2)` con `DecimalTransformer` (string ⇄ number). Cálculos con **`decimal.js`**, nunca con `float`.
- Fechas en `timestamptz`, almacenadas en UTC. El `User` tiene `timezone` (IANA) para calcular recordatorios y recurrencias.
- Periodos mensuales (tarjetas): string `YYYY-MM`.

### 0.5 Convención de commits y ramas

- Commits: **Conventional Commits** (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`).
- Ramas: `feature/NN-nombre` creadas desde `develop`; PR hacia `develop`.
- Un commit por paso lógico (los mensajes sugeridos están en cada feature).

### 0.6 Orden de implementación

```
F00 Base ─► F01 Auth ─► F02 Cuentas ─► F03 Notificaciones ─► F04 Ingresos ─► F05 Tarjetas
        ─► F06 Egresos ─► F07 Pagos de tarjeta ─► F08 Egresos recurrentes
        ─► F09 Cobros ─► F10 Préstamos ─► F11 Deudas ─► F12 Listas de compras ─► F13 Hardening
```

---

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

## F01 — Autenticación y seguridad

**Objetivo:** autenticación JWT segura (access token corto en **Redis**, refresh token largo en **PostgreSQL**), rutas protegidas por defecto, rate limit estricto/relajado y bloqueo progresivo por intentos fallidos (por cuenta y por IP).

- **Rama:** `feature/01-auth-security`

### Pasos

1. `nest g resource users --no-spec` y `nest g resource auth --no-spec` (sin CRUD en auth; solo controller/service/module).
2. Crear decoradores `@IsPublic()` (metadata `isPublic`) y `@CurrentUser(field?)`.
3. Crear `JwtAuthGuard` (extiende `AuthGuard('jwt')`), registrado como `APP_GUARD`; usa `Reflector` para saltarse rutas `@IsPublic()`.
4. Crear `JwtStrategy`: valida firma/expiración y luego **verifica que la clave `auth:access:{jti}` exista en Redis** (si no, `401`).
5. Configurar `ThrottlerModule` con dos throttlers (`strict`, `relaxed`), storage Redis, y un `RateLimitGuard` que:
   - Si `RATE_LIMIT_ENABLED=false` → no hace nada.
   - Rutas con `@IsPublic()` → throttler `strict`; rutas autenticadas → `relaxed`.
   - Cada throttler usa `limit`, `ttl` y `blockDuration` desde env.
   - Rastrea por IP (público) o por `userId` (autenticado).
6. Implementar el flujo de login con bloqueos (ver servicio).
7. Registrar `AuthModule` y `UsersModule` en `AppModule`.

### Entidades y relaciones

**`User`** (extiende BaseEntity)

| Campo | Tipo | Notas |
|---|---|---|
| `email` | varchar, único (índice parcial `isDeleted=false`) | normalizado a minúsculas |
| `passwordHash` | varchar | `argon2id` |
| `name` | varchar | |
| `timezone` | varchar | default `DEFAULT_TIMEZONE` |
| `failedLoginAttempts` | int, default 0 | **por cuenta** |
| `lockedUntil` | timestamptz, nullable | |
| `lastLoginAt` | timestamptz, nullable | |

**`RefreshToken`** (extiende BaseEntity)

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | FK → User | `ManyToOne` |
| `familyId` | uuid | agrupa tokens rotados de una misma sesión |
| `tokenHash` | varchar | SHA-256 del token (nunca el token plano) |
| `expiresAt` | timestamptz | |
| `revokedAt` | timestamptz, nullable | revocar = setear fecha (no se borra) |
| `replacedByTokenId` | uuid, nullable | |
| `ip`, `userAgent` | varchar | auditoría |

Relación: `User 1 ─── N RefreshToken`.

**Claves en Redis (temporal):**

| Clave | Contenido | TTL |
|---|---|---|
| `auth:access:{jti}` | `userId` | = `JWT_ACCESS_EXPIRES_SECONDS` |
| `auth:ip-fails:{ip}` | sorted set de timestamps de fallos | = ventana |
| `auth:ip-block:{ip}` | marca de bloqueo | = `IP_LOCK_MINUTES` |
| `auth:ip-flagged:{ip}` | marca de IP reincidente | = `IP_LOCK_MINUTES + IP_LOCK_WINDOW_MINUTES` |

### Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/auth/register` | público (strict) |
| POST | `/auth/login` | público (strict) |
| POST | `/auth/refresh` | público (strict) |
| POST | `/auth/logout` | autenticado |
| POST | `/auth/logout-all` | autenticado |
| GET | `/users/me` | autenticado |
| PATCH | `/users/me` | autenticado (name, timezone) |
| PATCH | `/users/me/password` | autenticado |

### Métodos del servicio

**`UsersService`**
- `create(dto)`: valida email único (conflicto → `ConflictException`), hashea con argon2id, guarda. No devuelve `passwordHash`.
- `findByEmail(email)` / `findById(id)`: siempre con `isDeleted: false`.
- `updateProfile(userId, dto)`: actualiza `name` y `timezone` (validar IANA con `Intl.supportedValuesOf('timeZone')`).
- `changePassword(userId, dto)`: valida contraseña actual, hashea la nueva, **revoca todos los refresh tokens** y borra los access tokens activos en Redis.
- `registerFailedAttempt(user)` / `resetFailedAttempts(user)`: ver reglas de bloqueo.

**`AuthService`**
- `register(dto, ctx)`: crea usuario y emite tokens (o solo crea; decidir en el front). Contraseña mínima: 8 caracteres, mayúscula, minúscula, número.
- `login(dto, ctx{ip,userAgent})`:
  1. `assertIpNotBlocked(ip)` → si hay `auth:ip-block:{ip}` → `429` indicando minutos restantes.
  2. Buscar usuario por email. Si no existe: `registerIpFailure(ip)` y lanzar `401` genérico ("Credenciales inválidas"; no revelar si el email existe).
  3. Si `lockedUntil > now` → `423` con tiempo restante (no incrementa intentos mientras está bloqueada).
  4. Comparar contraseña. Si falla: `failedLoginAttempts++`, calcular `lockedUntil` (ver tabla), `registerIpFailure(ip)`, lanzar `401`.
  5. Si éxito: `failedLoginAttempts = 0`, `lockedUntil = null`, `lastLoginAt = now` (**reinicia solo la cuenta; los contadores de IP NO se reinician**), emitir tokens.
- `issueTokens(user, ctx, familyId?)`: genera `jti` (uuid), firma access token (`JWT_ACCESS_SECRET`), guarda `auth:access:{jti}` en Redis con TTL; genera refresh token aleatorio (≥ 64 bytes) firmado/opaco, guarda su **hash** en BD con `familyId` y `expiresAt`.
- `refresh(refreshToken, ctx)`: busca por hash; valida que no esté revocado ni expirado. **Rotación:** revoca el actual (`revokedAt`, `replacedByTokenId`) y emite uno nuevo en la misma familia. **Detección de reutilización:** si llega un token ya revocado → revocar **toda la familia** y borrar sus access tokens, lanzar `401`.
- `logout(userId, jti, refreshToken?)`: elimina `auth:access:{jti}` y revoca el refresh asociado.
- `logoutAll(userId)`: revoca todos los refresh del usuario y elimina todos sus `auth:access:*` (mantener además un set `auth:user-sessions:{userId}` con los `jti` activos para poder borrarlos).
- `computeAccountLock(attempts)`: devuelve minutos de bloqueo desde env:

  | Intentos fallidos | Bloqueo |
  |---|---|
  | < 5 | ninguno |
  | 5 y 6 | `ACCOUNT_LOCK_5_MINUTES` (15 min) |
  | 7 | `ACCOUNT_LOCK_7_MINUTES` (30 min) |
  | 8 | `ACCOUNT_LOCK_8_MINUTES` (2 h) |
  | ≥ 9 | `ACCOUNT_LOCK_9_PLUS_MINUTES` (5 h) |

- `registerIpFailure(ip)`: agrega timestamp al sorted set, elimina los anteriores a la ventana (`IP_LOCK_WINDOW_MINUTES`). Si hay **≥ 20 fallos en la ventana** → crea `auth:ip-block:{ip}` por `IP_LOCK_MINUTES` y marca `auth:ip-flagged:{ip}`. Si la IP ya está *flagged*, **cada fallo adicional renueva el bloqueo** otros `IP_LOCK_MINUTES`.
- `assertIpNotBlocked(ip)`: lee `auth:ip-block:{ip}` y calcula el TTL restante.

### Consideraciones

- IP real: `app.set('trust proxy', true)` si hay proxy/reverse proxy.
- No loguear contraseñas ni tokens.
- Mensajes de error genéricos en login para evitar enumeración de usuarios.

### Dependencias

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt argon2 @nestjs/throttler @nest-lab/throttler-storage-redis
pnpm add -D @types/passport-jwt
```

### Commits

```
feat(users): crear entidad User y UsersService con hash argon2id
feat(auth): agregar decoradores IsPublic y CurrentUser y guard JWT global
feat(auth): implementar login, registro y emision de tokens (access en redis, refresh en bd)
feat(auth): rotacion de refresh tokens con deteccion de reutilizacion y logout
feat(auth): bloqueo progresivo de cuenta por intentos fallidos configurable por env
feat(auth): bloqueo por IP (20 intentos en 5 min) con ventana y duracion por env
feat(security): rate limit estricto/relajado configurable por env con storage en redis
```

---

## F02 — Cuentas bancarias

**Objetivo:** permitir registrar y consultar cuentas bancarias con su saldo calculado a partir de movimientos.

- **Rama:** `feature/02-bank-accounts`

### Pasos

1. `nest g resource accounts --no-spec` (REST API, con CRUD).
2. Crear entidad y DTOs (`CreateAccountDto`, `UpdateAccountDto` con `PartialType`).
3. Validar `color` como hex (`#RRGGBB`), `initialBalance` con 2 decimales máx.
4. Exponer el método `getBalance(accountId, userId)` para que otros módulos lo reutilicen (se completa en F04/F06).
5. Controller usa `@CurrentUser('id')` en todos los endpoints.

### Entidades y relaciones

**`Account`**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `userId` | FK → User (`ManyToOne`) | sí |
| `name` (alias) | varchar(60) | sí |
| `financialInstitution` | varchar(80) | sí |
| `color` | varchar(7) | sí |
| `initialBalance` | numeric(14,2) | sí |
| `description` | varchar(255), nullable | no |

Relaciones: `User 1 ─── N Account`; `Account 1 ─── N Income`; `Account 1 ─── N Expense` (se agregan en sus features).

### Endpoints

`POST /accounts` · `GET /accounts` · `GET /accounts/:id` · `PATCH /accounts/:id` · `DELETE /accounts/:id` (borrado lógico)

### Métodos del servicio

- `create(userId, dto)`: crea la cuenta. Mensaje: "Cuenta creada correctamente".
- `findAll(userId)`: lista cuentas activas con `currentBalance` calculado (1 query agregada, no N+1).
- `findOne(userId, id)`: devuelve la cuenta + `currentBalance`; `NotFoundException` si no es del usuario o está borrada.
- `update(userId, id, dto)`: actualiza alias, entidad, color, descripción. `initialBalance` **sí editable**, pero registrar en el mensaje que modifica el saldo calculado.
- `remove(userId, id)`: marca `isDeleted = true`. Los ingresos/egresos históricos **se conservan** y no se traen en consultas de cuenta borrada.
- `getBalance(accountId, userId)`:
  `initialBalance + Σ ingresos (isDeleted=false) − Σ egresos con paymentMethod=CORRIENTE (isDeleted=false)`.
  Los egresos **diferidos no descuentan** de la cuenta hasta que se paga la tarjeta (F07, que genera un egreso corriente).
- `assertOwnership(userId, accountId)`: método reutilizable por Income/Expense/Loan/etc.

### Dependencias

No requiere nuevas (usa las de F00).

### Commits

```
feat(accounts): crear entidad Account y DTOs de validacion
feat(accounts): CRUD de cuentas con borrado logico y ownership por JWT
feat(accounts): calcular saldo actual a partir de movimientos
```

---

## F03 — Notificaciones y recordatorios (infraestructura)

**Objetivo:** crear la infraestructura central de recordatorios y notificaciones push (FCM) que usarán tarjetas, egresos recurrentes, cobros, préstamos y deudas.

- **Rama:** `feature/03-notifications-reminders`

### Pasos

1. `nest g module notifications`, `nest g service notifications`, `nest g controller notifications`.
2. Inicializar `firebase-admin` con el service account (decodificar `FIREBASE_SERVICE_ACCOUNT_BASE64`) en un provider `FIREBASE_APP`.
3. Crear entidades `DeviceToken` y `Reminder`.
4. Crear `ReminderScheduler` con `@Cron(CronExpression.EVERY_MINUTE)`, habilitado solo si `SCHEDULER_ENABLED=true`, protegido con **lock en Redis** (`SET lock:reminders NX EX 55`) para que no corra doble si hay varias instancias.
5. Exponer `NotificationsModule` con `ReminderService` exportado para el resto de módulos.
6. Los recordatorios usan **solo hora** (minutos y segundos = 0): validar y forzar `minute=0, second=0` al calcular `scheduledAt`.

### Entidades y relaciones

**`DeviceToken`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `token` | varchar, único |
| `platform` | enum `ANDROID` |
| `isActive` | boolean |
| `lastUsedAt` | timestamptz |

**`Reminder`**

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | FK → User | |
| `type` | enum `CREDIT_CARD_PAYMENT \| RECURRING_EXPENSE \| COLLECTION \| LOAN \| DEBT` | |
| `sourceId` | uuid | id de la entidad origen |
| `title`, `body` | varchar | |
| `scheduledAt` | timestamptz | índice |
| `status` | enum `PENDING \| SENT \| FAILED \| CANCELLED` | |
| `attempts` | int | máx. 3 |
| `sentAt` | timestamptz, nullable | |
| `lastError` | text, nullable | |

Relaciones: `User 1 ─── N DeviceToken`; `User 1 ─── N Reminder`. `Reminder` referencia su origen de forma polimórfica (`type` + `sourceId`, sin FK).

### Endpoints

`POST /notifications/devices` (registrar token) · `DELETE /notifications/devices/:token` (desactivar) · `GET /notifications/reminders` (próximos del usuario)

### Métodos del servicio

**`NotificationsService`**
- `registerDevice(userId, token)`: upsert; si el token existía en otro usuario, reasignarlo.
- `unregisterDevice(userId, token)`: `isActive = false`.
- `sendToUser(userId, { title, body, data })`: envía a todos los tokens activos con `sendEachForMulticast`; los tokens con error `registration-token-not-registered` se desactivan.

**`ReminderService`**
- `schedule({ userId, type, sourceId, title, body, scheduledAt })`: crea un `Reminder PENDING` (ignora si `scheduledAt` ya pasó).
- `cancelBySource(type, sourceId)`: marca `PENDING → CANCELLED` (sin borrar).
- `reschedule(type, sourceId, newInput)`: cancela los pendientes y crea el nuevo.
- `dispatchDue()`: toma los `PENDING` con `scheduledAt <= now` (`FOR UPDATE SKIP LOCKED`, lotes de 100), envía, marca `SENT`; si falla incrementa `attempts` y tras 3 → `FAILED`.
- `findUpcoming(userId)`: recordatorios pendientes futuros.
- `computeScheduledAt(date, hour, timezone, offsetDays)` (util): construye la fecha con la zona del usuario, minutos/segundos en 0.

### Dependencias

```bash
pnpm add firebase-admin @nestjs/schedule
```

### Commits

```
feat(notifications): integrar firebase-admin y registro de dispositivos
feat(notifications): crear entidad Reminder y ReminderService (schedule, cancel, reschedule)
feat(notifications): cron de despacho de recordatorios con lock distribuido en redis
```

---

## F04 — Ingresos

**Objetivo:** registrar ingresos ligados a una cuenta, con soporte para ingresos generados automáticamente por otros módulos.

- **Rama:** `feature/04-incomes`

### Pasos

1. `nest g resource incomes --no-spec`.
2. Entidad + DTOs. El `userId` nunca viene en el body.
3. Implementar `createFromSource` aceptando un `EntityManager` opcional para participar en **transacciones** de otros módulos.
4. Actualizar `AccountsService.getBalance` para sumar ingresos.

### Entidades y relaciones

**`Income`**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `userId` | FK → User | sí |
| `accountId` | FK → Account (`ManyToOne`) | sí |
| `name` | varchar(80) | sí |
| `amount` | numeric(14,2) > 0 | sí |
| `description` | varchar(255) | no |
| `date` | timestamptz (default now) | sí |
| `sourceType` | enum `MANUAL \| COLLECTION_INSTALLMENT \| LOAN_INSTALLMENT` | sí (default `MANUAL`) |
| `sourceId` | uuid, nullable | no |

Relaciones: `Account 1 ─── N Income`; `User 1 ─── N Income`.

### Endpoints

`POST /incomes` · `GET /incomes` (filtros: `accountId`, `from`, `to`, paginación) · `GET /incomes/:id` · `PATCH /incomes/:id` · `DELETE /incomes/:id`

### Métodos del servicio

- `create(userId, dto)`: valida ownership de la cuenta, crea con `sourceType=MANUAL`.
- `createFromSource(userId, { accountId, name, amount, description, sourceType, sourceId }, manager?)`: uso interno de Cobros/Préstamos.
- `findAll(userId, query)`: paginado, ordenado por `date DESC`.
- `findOne(userId, id)`.
- `update(userId, id, dto)`: permite cambiar nombre, cuenta, monto, descripción. Si `sourceType !== MANUAL` → solo `name` y `description` (el monto lo gobierna el módulo de origen).
- `remove(userId, id)`: borrado lógico; si es de origen automático → `BadRequestException` (se revierte desde su módulo de origen).

### Dependencias

No requiere nuevas.

### Commits

```
feat(incomes): entidad Income y DTOs con validacion de monto
feat(incomes): CRUD de ingresos con filtros y paginacion
feat(incomes): createFromSource transaccional para modulos de cobros y prestamos
```

---

## F05 — Tarjetas de crédito (registro)

**Objetivo:** registrar tarjetas de crédito con sus fechas de corte/pago y recordatorio de pago.

- **Rama:** `feature/05-credit-cards`

### Pasos

1. `nest g resource credit-cards --no-spec`.
2. Entidad + DTOs. Validar `lastFourDigits` con `^\d{4}$`.
3. Fechas de corte y pago como **día del mes** (1–31).
4. Al crear/actualizar con recordatorio activo, programar (`ReminderService.reschedule`) el recordatorio del próximo `paymentDay`.
5. El cálculo de reportes y el pago se hacen en **F07** (dependen de egresos).

### Entidades y relaciones

**`CreditCard`**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `userId` | FK → User | sí |
| `name` (alias) | varchar(60) | sí |
| `color` | varchar(7) | sí |
| `issuer` (entidad emisora) | varchar(80) | sí |
| `lastFourDigits` | char(4) | sí |
| `creditLimit` (cupo) | numeric(14,2), nullable | no |
| `cutoffDay` (fecha de corte) | smallint 1–31, nullable | no |
| `paymentDay` (fecha de pago) | smallint 1–31, nullable | no |
| `reminderEnabled` | boolean, default false | no |
| `reminderDaysBefore` | smallint, default 1 | no |
| `reminderHour` | smallint 0–23, default 9 | no |

Relaciones: `User 1 ─── N CreditCard`; `CreditCard 1 ─── N Expense` y `CreditCard 1 ─── N ExpenseInstallment` (F06).

### Endpoints

`POST /credit-cards` · `GET /credit-cards` · `GET /credit-cards/:id` · `PATCH /credit-cards/:id` · `DELETE /credit-cards/:id`

### Métodos del servicio

- `create(userId, dto)`: valida que si `reminderEnabled=true` exista `paymentDay`; programa recordatorio.
- `findAll(userId)` / `findOne(userId, id)`.
- `update(userId, id, dto)`: reprograma o cancela recordatorios según cambios.
- `remove(userId, id)`: borrado lógico + `ReminderService.cancelBySource(CREDIT_CARD_PAYMENT, id)`. Las compras diferidas históricas se conservan.
- `scheduleNextPaymentReminder(card)`: calcula el próximo `paymentDay` (ajustando a último día del mes si el mes tiene menos días), resta `reminderDaysBefore`, aplica `reminderHour` en la zona del usuario.
- `assertOwnership(userId, cardId)`.

### Dependencias

No requiere nuevas.

### Commits

```
feat(credit-cards): entidad CreditCard y DTOs con validacion de ultimos 4 digitos
feat(credit-cards): CRUD de tarjetas con borrado logico
feat(credit-cards): programar recordatorio de fecha de pago
```

---

## F06 — Egresos (instantáneos y diferidos)

**Objetivo:** registrar egresos con forma de pago **corriente** o **diferida** (tarjeta + cuotas + meses de gracia), generando el plan de cuotas.

- **Rama:** `feature/06-expenses`

### Pasos

1. `nest g resource expenses --no-spec`.
2. Entidades `Expense` y `ExpenseInstallment`.
3. DTO con validación condicional: si `paymentMethod = DIFERIDO` → `creditCardId` y `installments ≥ 1` obligatorios, `graceMonths ≥ 0` (default 0); si `CORRIENTE` (o no se envía) → esos campos deben ser `null`.
4. Crear util `buildInstallmentSchedule()` en `common/utils` (ver reglas).
5. Operaciones de creación y generación de cuotas dentro de **una transacción**.
6. Actualizar `AccountsService.getBalance` para restar egresos corrientes.

### Entidades y relaciones

**`Expense`**

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | FK → User | |
| `accountId` | FK → Account | obligatorio |
| `name` | varchar(80) | |
| `amount` | numeric(14,2) ≥ 0 | |
| `description` | varchar(255), nullable | |
| `date` | timestamptz | |
| `paymentMethod` | enum `CORRIENTE \| DIFERIDO` | default `CORRIENTE` |
| `creditCardId` | FK → CreditCard, nullable | solo diferido |
| `installments` | smallint, nullable | solo diferido |
| `graceMonths` | smallint, default 0 | solo diferido |
| `amountPending` | boolean, default false | `true` en recurrentes de monto variable aún sin fijar |
| `recurringConfigId` | FK → RecurringExpenseConfig, nullable | F08 |
| `sourceType` | enum `MANUAL \| RECURRING \| CARD_PAYMENT \| LOAN_CREATION \| DEBT_PAYMENT \| SHOPPING_LIST` | |
| `sourceId` | uuid, nullable | |

**`ExpenseInstallment`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `expenseId` | FK → Expense (`ManyToOne`) |
| `creditCardId` | FK → CreditCard |
| `number` | smallint (1..N) |
| `amount` | numeric(14,2) |
| `period` | char(7) `YYYY-MM` (periodo de facturación en que se cobra) |
| `isPaid` | boolean, default false |
| `cardPaymentId` | FK → CreditCardPayment, nullable (F07) |

Relaciones: `Account 1 ─── N Expense`; `CreditCard 1 ─── N Expense`; `Expense 1 ─── N ExpenseInstallment`.

### Endpoints

`POST /expenses` · `GET /expenses` (filtros: `accountId`, `creditCardId`, `paymentMethod`, rango de fechas, `amountPending`) · `GET /expenses/:id` · `PATCH /expenses/:id` · `PATCH /expenses/:id/amount` · `DELETE /expenses/:id`

### Métodos del servicio

- `create(userId, dto)`: valida ownership de cuenta (y tarjeta si aplica). Si es diferido, genera cuotas con `buildInstallmentSchedule` en la misma transacción.
- `createInternal(userId, input, manager?)`: usado por F07, F08, F10, F11, F12 (con `sourceType`/`sourceId`).
- `findAll(userId, query)` / `findOne(userId, id)` (incluye cuotas si es diferido).
- `update(userId, id, dto)`: no permite cambiar `paymentMethod`, tarjeta ni cuotas si alguna cuota ya fue pagada; si cambia monto/cuotas/gracia y ninguna está pagada → **regenera** el plan (las anteriores se marcan `isDeleted`, no se borran).
- `setAmount(userId, id, amount)`: para egresos con `amountPending = true` (variables recurrentes): fija el monto **solo para ese egreso** y pone `amountPending = false`. Si no estaba pendiente → `BadRequestException`.
- `remove(userId, id)`: borrado lógico del egreso y sus cuotas; si alguna cuota ya fue pagada con tarjeta → `BadRequestException`; si es de origen automático (`sourceType ≠ MANUAL/RECURRING`) → no permitido.
- `buildInstallmentSchedule({ date, amount, installments, graceMonths, cutoffDay })`:
  1. Periodo base = mes de la compra; si la tarjeta tiene `cutoffDay` y `día de compra > cutoffDay` → periodo base = mes siguiente.
  2. Primera cuota = periodo base + `graceMonths`.
  3. Cuota *i* = primera cuota + (i − 1) meses.
  4. Monto por cuota = `amount / installments` redondeado a 2 decimales; el **residuo de redondeo va a la última cuota**.

### Dependencias

No requiere nuevas.

### Commits

```
feat(expenses): entidades Expense y ExpenseInstallment con DTOs condicionales
feat(expenses): egresos corrientes (instantaneos) y descuento en saldo de cuenta
feat(expenses): egresos diferidos con calculo de plan de cuotas y meses de gracia
feat(expenses): endpoint para fijar monto en egresos de cantidad variable
```

---

## F07 — Reportes y pago de tarjetas de crédito

**Objetivo:** calcular cuánto se debe de una tarjeta (mes actual, anteriores o posteriores) y marcar el mes como pagado generando un egreso.

- **Rama:** `feature/07-credit-card-reports-payments`

### Pasos

1. Agregar al módulo `credit-cards` la entidad `CreditCardPayment` y los métodos de reporte/pago (dependen de `ExpensesService`).
2. Resolver la dependencia circular `CreditCardsModule ⇄ ExpensesModule` con `forwardRef` o, preferible, creando un servicio `CreditCardBillingService` dentro de `credit-cards` que solo lee `ExpenseInstallment` vía repositorio.
3. `markPeriodAsPaid` se ejecuta en **transacción**: crea el egreso, marca cuotas y registra el pago.

### Entidades y relaciones

**`CreditCardPayment`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `creditCardId` | FK → CreditCard |
| `accountId` | FK → Account (de dónde sale el dinero) |
| `expenseId` | FK → Expense (egreso generado) |
| `period` | char(7) `YYYY-MM` |
| `amount` | numeric(14,2) |
| `paidAt` | timestamptz |

Restricción única: `(creditCardId, period)` entre registros con `isDeleted=false`.
Relaciones: `CreditCard 1 ─── N CreditCardPayment`; `CreditCardPayment 1 ─── N ExpenseInstallment` (las cuotas pagadas apuntan al pago).

### Endpoints

`GET /credit-cards/:id/report?period=YYYY-MM` · `GET /credit-cards/:id/report/range?from=YYYY-MM&to=YYYY-MM` · `GET /credit-cards/:id/debt` · `POST /credit-cards/:id/pay`

### Métodos del servicio

- `getMonthlyReport(userId, cardId, period)`: devuelve `{ period, total, paid, paidAt, items[] }` donde cada item es una cuota (compra, nº de cuota `n/N`, monto), más `cutoffDate` y `paymentDate` del periodo. Usa solo información disponible hasta el momento.
- `getRangeReport(userId, cardId, from, to)`: resumen mes a mes (pasados y futuros); limitar el rango a 24 meses.
- `getCurrentDebt(userId, cardId)`: Σ cuotas **no pagadas** con `period ≤ periodo actual` (deuda exigible hoy), más `upcoming` = Σ cuotas futuras, y `availableCredit` si hay `creditLimit` (`cupo − deuda total pendiente`).
- `markPeriodAsPaid(userId, cardId, { accountId, period? })`:
  1. `period` por defecto = mes actual; **no se permiten periodos futuros**.
  2. Valida que no exista pago del periodo y que el total sea > 0.
  3. Crea un `Expense` `CORRIENTE` (`sourceType=CARD_PAYMENT`, `sourceId=paymentId`) en la cuenta indicada por el monto total del periodo.
  4. Crea `CreditCardPayment`, marca las cuotas del periodo `isPaid = true` y asigna `cardPaymentId`.
  5. Cancela el recordatorio del mes y programa el siguiente.
- `getPeriodInstallments(cardId, period)`: consulta interna reutilizable.

### Dependencias

No requiere nuevas.

### Commits

```
feat(credit-cards): reporte mensual y por rango de deuda de tarjeta
feat(credit-cards): calculo de deuda actual y cupo disponible
feat(credit-cards): marcar periodo como pagado generando egreso transaccional
```

---

## F08 — Egresos recurrentes

**Objetivo:** configurar egresos programados (semanal, mensual, anual; monto fijo o variable) y generarlos automáticamente con *schedule jobs* como egresos instantáneos de forma corriente.

- **Rama:** `feature/08-recurring-expenses`

### Pasos

1. `nest g resource recurring-expenses --no-spec`.
2. Entidad `RecurringExpenseConfig` + DTO con validación condicional según `frequency`:
   - `WEEKLY` → `dayOfWeek` (1=L … 7=D) obligatorio.
   - `MONTHLY` → `dayOfMonth` (1–31) obligatorio.
   - `YEARLY` → `monthOfYear` (1–12) obligatorio; `dayOfMonth` opcional (si falta, se genera el día 1 de ese mes).
   - Si `isVariableAmount = true` → `amount` no se solicita.
3. Crear util `computeNextOccurrence(config, after, timezone)` (maneja meses cortos: día 31 en febrero → último día del mes; 29-feb en años no bisiestos → 28).
4. Crear `RecurringExpensesScheduler` (`@Cron` cada hora, lock en Redis, solo si `SCHEDULER_ENABLED`).
5. Idempotencia: índice único `(recurringConfigId, occurrenceDate)` en `Expense`.
6. Los egresos generados **siempre** con forma de pago `CORRIENTE`.

### Entidades y relaciones

**`RecurringExpenseConfig`**

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | FK → User | |
| `accountId` | FK → Account | |
| `name` | varchar(80) | |
| `amount` | numeric(14,2), nullable | `null` si variable |
| `isVariableAmount` | boolean | |
| `description` | varchar(255), nullable | |
| `frequency` | enum `WEEKLY \| MONTHLY \| YEARLY` | |
| `dayOfWeek` / `dayOfMonth` / `monthOfYear` | smallint, nullable | según frecuencia |
| `startDate` | date | |
| `endDate` | date, nullable | |
| `isActive` | boolean, default true | |
| `nextRunAt` | timestamptz | |
| `lastGeneratedAt` | timestamptz, nullable | |
| `reminderEnabled` | boolean | |
| `reminderOffset` | enum `SAME_DAY \| ONE_DAY_BEFORE`, nullable | |
| `reminderHour` | smallint 0–23, nullable | |

Relaciones: `User 1 ─── N RecurringExpenseConfig`; `Account 1 ─── N RecurringExpenseConfig`; `RecurringExpenseConfig 1 ─── N Expense` (los egresos generados mantienen `recurringConfigId`).

### Endpoints

`POST /recurring-expenses` · `GET /recurring-expenses` · `GET /recurring-expenses/:id` · `PATCH /recurring-expenses/:id` · `PATCH /recurring-expenses/:id/active` · `DELETE /recurring-expenses/:id`

### Métodos del servicio

- `create(userId, dto)`: valida cuenta, calcula `nextRunAt` (primera ocurrencia ≥ `startDate`), programa recordatorio.
- `findAll(userId)` / `findOne(userId, id)`.
- `update(userId, id, dto)`: recalcula `nextRunAt` y reprograma recordatorios. No afecta egresos ya generados.
- `setActive(userId, id, isActive)`: activar/desactivar; al reactivar recalcula `nextRunAt` desde hoy (no genera atrasados); al desactivar cancela recordatorios.
- `remove(userId, id)`: borrado lógico **solo de la configuración**; cancela recordatorios; los egresos creados se conservan.
- `generateDueExpenses()` (llamado por el cron): para cada config `isActive`, `isDeleted=false`, `nextRunAt <= now` y (`endDate` nulo o ≥ ocurrencia), en transacción:
  1. Crea un `Expense` `CORRIENTE`, `sourceType=RECURRING`; si es variable → `amount = 0` y `amountPending = true`.
  2. Actualiza `lastGeneratedAt` y calcula la siguiente `nextRunAt`; si supera `endDate` → `isActive = false`.
  3. Programa el recordatorio de la siguiente ocurrencia.
  4. Procesa ocurrencias atrasadas en bucle (por si el servidor estuvo caído), con tope de 31 por ejecución.
- `scheduleReminder(config)`: según `reminderOffset` (mismo día / 1 día antes) y `reminderHour`; para variables, el texto del recordatorio indica "define el monto".

### Dependencias

No requiere nuevas (usa `@nestjs/schedule` de F03).

### Commits

```
feat(recurring-expenses): entidad RecurringExpenseConfig y validacion por frecuencia
feat(recurring-expenses): calculo de proxima ocurrencia con ajuste de fin de mes
feat(recurring-expenses): CRUD, activar/desactivar y borrado logico de configuracion
feat(recurring-expenses): cron idempotente que genera egresos y soporta monto variable
feat(recurring-expenses): recordatorios del mismo dia o un dia antes
```

---

## F09 — Cobros

**Objetivo:** registrar dinero que otras personas deben al usuario, dividido en cuotas con recordatorios; al pagar una cuota se crea un ingreso en la cuenta elegida.

- **Rama:** `feature/09-collections`

### Pasos

1. `nest g resource collections --no-spec`.
2. Crear en `common/` un **generador de plan de cuotas con recordatorio** reutilizable por Cobros, Préstamos y Deudas (`InstallmentScheduleBuilder`): recibe `totalAmount`, `installments`, configuración de recordatorio y fecha base; devuelve `[{ number, amount, dueDate }]`.
3. Entidades `Collection` y `CollectionInstallment`.
4. DTO con validación condicional:
   - `installments > 1` → recordatorio recurrente (`WEEKLY` con `dayOfWeek` / `MONTHLY` con `dayOfMonth` / `YEARLY` con `monthOfYear` y `dayOfMonth?`) + `reminderHour`.
   - `installments = 1` → `reminderAt` (fecha y hora; solo hora, minutos = 0).
5. Pago de cuota en transacción con `IncomesService.createFromSource`.

### Entidades y relaciones

**`Collection`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `personName` | varchar(80) |
| `totalAmount` | numeric(14,2) |
| `installmentsCount` | smallint ≥ 1 |
| `description` | varchar(255), nullable |
| `reminderEnabled` | boolean |
| `reminderFrequency` | enum `WEEKLY \| MONTHLY \| YEARLY`, nullable |
| `reminderDayOfWeek` / `reminderDayOfMonth` / `reminderMonth` | smallint, nullable |
| `reminderAt` | timestamptz, nullable (cuota única) |
| `reminderHour` | smallint, nullable |
| `status` | enum `PENDING \| PARTIAL \| PAID` |

**`CollectionInstallment`**

| Campo | Tipo |
|---|---|
| `collectionId` | FK → Collection (`ManyToOne`) |
| `userId` | FK → User |
| `number` | smallint |
| `amount` | numeric(14,2) |
| `dueDate` | timestamptz, nullable |
| `isPaid` | boolean |
| `paidAt` | timestamptz, nullable |
| `incomeId` | FK → Income, nullable |

Relaciones: `Collection 1 ─── N CollectionInstallment`; `CollectionInstallment 0..1 ─── 1 Income`.

### Endpoints

`POST /collections` · `GET /collections` (filtro `status`) · `GET /collections/:id` · `PATCH /collections/:id` · `DELETE /collections/:id` · `POST /collections/:id/installments/:installmentId/pay`

### Métodos del servicio

- `create(userId, dto)`: crea cobro, genera cuotas (último = residuo), programa un recordatorio por cuota pendiente.
- `findAll(userId, query)`: incluye `paidAmount` y `pendingAmount`.
- `findOne(userId, id)`: con cuotas.
- `update(userId, id, dto)`: si hay cuotas pagadas, solo se permite cambiar `personName`, `description` y recordatorio (regenera `dueDate` de las pendientes). Si no hay pagadas, permite cambiar monto y cuotas (regenera el plan).
- `remove(userId, id)`: borrado lógico + cancelar recordatorios; los ingresos ya creados se conservan.
- `payInstallment(userId, collectionId, installmentId, { accountId, name?, description? })`: en transacción — valida cuota no pagada, crea `Income` (`sourceType=COLLECTION_INSTALLMENT`, `sourceId=installmentId`) en la cuenta indicada, marca `isPaid/paidAt/incomeId`, cancela su recordatorio, recalcula `status` (`PARTIAL` / `PAID`).
- `recalculateStatus(collection)`: método interno.

### Dependencias

No requiere nuevas.

### Commits

```
feat(common): constructor reutilizable de plan de cuotas con recordatorios
feat(collections): entidades Collection y CollectionInstallment con DTO condicional
feat(collections): CRUD de cobros con generacion de cuotas y recordatorios
feat(collections): pago de cuota con creacion transaccional de ingreso
```

---

## F10 — Préstamos

**Objetivo:** igual que Cobros, pero al crear el préstamo se descuenta el dinero de una cuenta (se genera un egreso) y cada cuota pagada genera un ingreso.

- **Rama:** `feature/10-loans`

### Pasos

1. `nest g resource loans --no-spec`.
2. Entidades `Loan` y `LoanInstallment` (misma estructura que Cobros + `accountId`, `expenseId`).
3. Reutilizar `InstallmentScheduleBuilder` de F09.
4. En `create`, todo en **una transacción**: préstamo + cuotas + egreso (`ExpensesService.createInternal`, `sourceType=LOAN_CREATION`).

### Entidades y relaciones

**`Loan`**: mismos campos que `Collection`, más:

| Campo | Tipo |
|---|---|
| `accountId` | FK → Account (cuenta de la que sale el dinero) |
| `expenseId` | FK → Expense (egreso generado al crear) |

**`LoanInstallment`**: igual que `CollectionInstallment` (`loanId` en vez de `collectionId`; `incomeId` apunta al ingreso generado al pagar).

Relaciones: `Loan 1 ─── N LoanInstallment`; `Loan N ─── 1 Account`; `Loan 1 ─── 1 Expense`; `LoanInstallment 0..1 ─── 1 Income`.

### Endpoints

`POST /loans` · `GET /loans` · `GET /loans/:id` · `PATCH /loans/:id` · `DELETE /loans/:id` · `POST /loans/:id/installments/:installmentId/pay`

### Métodos del servicio

- `create(userId, dto)`: valida cuenta; crea préstamo, cuotas, egreso corriente por `totalAmount` y recordatorios.
- `findAll` / `findOne`: como Cobros (con montos pagados/pendientes).
- `update(userId, id, dto)`: no se puede cambiar `accountId` ni `totalAmount` (ya hay egreso); permite `personName`, `description` y recordatorio. Cambiar cuotas solo si no hay ninguna pagada.
- `remove(userId, id)`: borrado lógico, cancela recordatorios. El egreso y los ingresos históricos se conservan.
- `payInstallment(userId, loanId, installmentId, { accountId, name?, description? })`: crea `Income` (`sourceType=LOAN_INSTALLMENT`) en la cuenta indicada, marca la cuota, cancela recordatorio y recalcula estado.

### Dependencias

No requiere nuevas.

### Commits

```
feat(loans): entidades Loan y LoanInstallment reutilizando constructor de cuotas
feat(loans): crear prestamo generando egreso y cuotas en una transaccion
feat(loans): pago de cuota con creacion de ingreso en cuenta elegida
```

---

## F11 — Deudas

**Objetivo:** registrar deudas del usuario con otras personas, en cuotas y con recordatorios de pago.

- **Rama:** `feature/11-debts`

### Pasos

1. `nest g resource debts --no-spec`.
2. Entidades `Debt` y `DebtInstallment` (misma estructura que Cobros, sin `description`, que no está en los requisitos).
3. Reutilizar `InstallmentScheduleBuilder`.
4. Pago de cuota: ver **supuesto A** (genera egreso) al final del documento.

### Entidades y relaciones

**`Debt`**: `userId`, `personName`, `totalAmount`, `installmentsCount`, configuración de recordatorio (mismos campos que Cobros), `status` (`PENDING \| PARTIAL \| PAID`).

**`DebtInstallment`**: `debtId`, `userId`, `number`, `amount`, `dueDate`, `isPaid`, `paidAt`, `expenseId` (nullable).

Relaciones: `Debt 1 ─── N DebtInstallment`; `DebtInstallment 0..1 ─── 1 Expense`.

### Endpoints

`POST /debts` · `GET /debts` · `GET /debts/:id` · `PATCH /debts/:id` · `DELETE /debts/:id` · `POST /debts/:id/installments/:installmentId/pay`

### Métodos del servicio

- `create(userId, dto)`: crea deuda, cuotas y recordatorios.
- `findAll` / `findOne`: con `paidAmount` y `pendingAmount`.
- `update(userId, id, dto)`: misma lógica que Cobros (restricciones si hay cuotas pagadas).
- `remove(userId, id)`: borrado lógico + cancelar recordatorios.
- `payInstallment(userId, debtId, installmentId, { accountId })`: marca la cuota como pagada y, según supuesto A, crea un egreso corriente (`sourceType=DEBT_PAYMENT`) en la cuenta indicada; cancela recordatorio y recalcula estado.

### Dependencias

No requiere nuevas.

### Commits

```
feat(debts): entidades Debt y DebtInstallment con recordatorios configurables
feat(debts): CRUD de deudas con generacion de cuotas
feat(debts): pago de cuota con egreso asociado y recalculo de estado
```

---

## F12 — Listas de compras

**Objetivo:** gestionar listas de compra con ítems chequeables y cerrarlas generando un egreso, trasladando lo no comprado a una nueva lista.

- **Rama:** `feature/12-shopping-lists`

### Pasos

1. `nest g resource shopping-lists --no-spec`.
2. Entidades `ShoppingList` y `ShoppingListItem`.
3. DTO de cierre con validación **excluyente (XOR)** mediante validador personalizado:
   - Opción A: cada ítem comprado trae `price` y `total` es `null`/ausente → total calculado en backend.
   - Opción B: se envía `total` y **ningún** ítem trae `price`.
   - Ambas o ninguna → `BadRequestException`.
4. El cierre se ejecuta en **transacción**.

### Entidades y relaciones

**`ShoppingList`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `name` | varchar(80) |
| `status` | enum `OPEN \| CLOSED` |
| `closedAt` | timestamptz, nullable |
| `total` | numeric(14,2), nullable |
| `accountId` | FK → Account, nullable (se llena al cerrar) |
| `expenseId` | FK → Expense, nullable |

**`ShoppingListItem`**

| Campo | Tipo |
|---|---|
| `listId` | FK → ShoppingList (`ManyToOne`) |
| `userId` | FK → User |
| `name` | varchar(120) |
| `isPurchased` | boolean, default false |
| `price` | numeric(14,2), nullable |

Relaciones: `ShoppingList 1 ─── N ShoppingListItem`; `ShoppingList 0..1 ─── 1 Expense`.

### Endpoints

`POST /shopping-lists` · `GET /shopping-lists` (filtro `status`) · `GET /shopping-lists/:id` · `PATCH /shopping-lists/:id` · `DELETE /shopping-lists/:id` · `POST /shopping-lists/:id/items` · `PATCH /shopping-lists/:id/items/:itemId` · `PATCH /shopping-lists/:id/items/:itemId/check` · `DELETE /shopping-lists/:id/items/:itemId` · `POST /shopping-lists/:id/close`

### Métodos del servicio

- `create(userId, dto)`: crea lista `OPEN` con ítems iniciales opcionales.
- `findAll(userId, query)` / `findOne(userId, id)`: con ítems activos.
- `update(userId, id, dto)`: renombrar; solo listas `OPEN`.
- `remove(userId, id)`: borrado lógico de la lista y sus ítems.
- `addItem(userId, listId, dto)` / `updateItem(...)` / `removeItem(...)`: solo en listas `OPEN`.
- `toggleItemCheck(userId, listId, itemId, isPurchased)`: marca/desmarca comprado.
- `close(userId, listId, dto)`: en transacción —
  1. Valida lista `OPEN` y que los ítems enviados (`purchased` y `notPurchased`) pertenezcan a ella y cubran todos sus ítems.
  2. Valida el XOR de precios/total y calcula `total` (suma de precios) si aplica; el total debe ser > 0.
  3. Valida ownership de `accountId`.
  4. Marca ítems comprados (con su `price` si aplica).
  5. **Elimina de la lista cerrada los ítems no comprados** (`isDeleted = true`) y los **crea como ítems nuevos** en una **nueva lista `OPEN`** (mismo nombre).
  6. Crea el egreso corriente por el total (`sourceType=SHOPPING_LIST`) y guarda `expenseId`, `total`, `closedAt`, `status = CLOSED`.
  7. Devuelve la lista cerrada y el `id` de la nueva lista.
- Una lista `CLOSED` es **inmutable**.

### Dependencias

No requiere nuevas.

### Commits

```
feat(shopping-lists): entidades ShoppingList y ShoppingListItem con CRUD de items
feat(shopping-lists): check de items y validacion de listas abiertas
feat(shopping-lists): cierre de lista con validacion XOR de precios/total y egreso asociado
feat(shopping-lists): crear nueva lista automatica con items no comprados
```

---

## F13 — Hardening, pruebas y documentación

**Objetivo:** asegurar la calidad transversal antes de entregar.

- **Rama:** `feature/13-hardening-docs`

### Pasos

1. **Auditoría de soft delete:** buscar `.delete(` / `.remove(` en el código (no debe haber) y verificar `isDeleted: false` en todas las consultas.
2. **Auditoría de ownership:** ningún DTO tiene `userId`; todo servicio filtra por `userId`.
3. **Pruebas unitarias** de servicios críticos: bloqueos de login (5/7/8/9+ intentos y IP), `buildInstallmentSchedule`, `computeNextOccurrence`, `markPeriodAsPaid`, cierre de lista de compras.
4. **Pruebas e2e:** flujo auth completo (register → login → refresh → logout), formato de respuesta (`success/statusCode/data/message/errors`), rate limit y arranque fallido con `.env` incompleto.
5. Documentar con Swagger todas las rutas (marcando las públicas) y actualizar `README.md` con la guía de variables de entorno.
6. Revisar índices (`userId`, `isDeleted`, `scheduledAt`, `nextRunAt`, `period`).

### Dependencias

```bash
pnpm add -D jest @nestjs/testing supertest @types/supertest ts-jest
```
(ya vienen con el template de Nest; instalar solo si faltan)

### Commits

```
test: pruebas unitarias de bloqueos, cuotas, recurrencias y cierre de compras
test(e2e): flujo de autenticacion, formato de respuesta y rate limit
docs: documentacion swagger y README con guia de variables de entorno
chore: auditoria de borrado logico, ownership e indices
```

---

## Resumen de dependencias pnpm (acumulado)

```bash
# Runtime
pnpm add @nestjs/config zod @nestjs/typeorm typeorm pg ioredis class-validator class-transformer \
  helmet decimal.js @nestjs/swagger \
  @nestjs/jwt @nestjs/passport passport passport-jwt argon2 \
  @nestjs/throttler @nest-lab/throttler-storage-redis \
  firebase-admin @nestjs/schedule

# Desarrollo
pnpm add -D @types/passport-jwt
```

---

## Supuestos y decisiones a confirmar

Los documentos no definen algunos puntos; esto es lo que asumí en el plan (cámbialo si no aplica):

| # | Tema | Supuesto adoptado |
|---|---|---|
| A | **Pago de cuota de Deuda** | Los requisitos no dicen si genera egreso. Se asume que **sí** crea un egreso corriente en la cuenta elegida (simétrico a Cobros). |
| B | **6 intentos fallidos** | No está en la tabla; se aplica el bloqueo del escalón más cercano inferior (15 min). |
| C | **Anual solo con mes** | Si no hay día, se genera el **día 1** de ese mes. |
| D | **Día 29–31 en meses cortos** | Se ajusta al último día del mes. |
| E | **Recordatorio de tarjeta** | `reminderDaysBefore` (default 1) y `reminderHour` (default 9) son configurables; los requisitos solo dicen "antes de la fecha límite". |
| F | **Egreso diferido y cuenta** | `accountId` es obligatorio, pero el saldo solo baja cuando se paga la tarjeta (F07). |
| G | **Pago de tarjeta** | Solo se puede pagar el periodo actual o anteriores impagos; no periodos futuros. |
| H | **Corte de tarjeta** | Compras posteriores al día de corte pasan a facturarse en el siguiente periodo. |
| I | **Saldo insuficiente** | No se bloquean egresos por saldo negativo (no está en los requisitos). |
| J | **Zona horaria** | Cada usuario tiene `timezone` para recordatorios y recurrencias. |
