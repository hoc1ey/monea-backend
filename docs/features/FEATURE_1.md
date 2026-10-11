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
