# MONEA — Guía de pruebas en Postman (por feature)

Esta guía te permite verificar que cada feature (F00–F13) del plan `MONEA_backend_features.md` quedó bien implementada. Los tests siguen el orden de implementación y **muchos dependen de los anteriores** (usan ids guardados en variables).

---

## 0. Preparación de Postman

### 0.1 Environment `MONEA local`

| Variable | Valor inicial |
|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` |
| `email` | `jose@test.com` |
| `password` | `Monea123*` |
| `accessToken`, `refreshToken` | (vacías, se llenan solas) |
| `accessToken2` | (vacía; token del segundo usuario) |
| `accountId`, `account3Id`, `cardId`, `card2Id`, `incomeId`, `expenseId`, `expenseDeferredId`, `collectionId`, `collection2Id`, `loanId`, `debtId`, `listId`, `recurringId` | (vacías) |

### 0.2 Autorización

- En la colección: **Authorization → Bearer Token → `{{accessToken}}`**.
- Requests públicos (`register`, `login`, `refresh`, `health`): **Authorization → No Auth**.
- Para el segundo usuario, en el request específico usar `Bearer {{accessToken2}}`.

### 0.3 Script de formato (pegar en *Tests* de la **colección**)

Valida automáticamente el contrato de respuesta en **todos** los requests:

```js
pm.test("Formato de respuesta estándar", () => {
  const j = pm.response.json();
  pm.expect(j).to.have.all.keys("success", "statusCode", "data", "message", "errors");
  pm.expect(j.statusCode).to.eql(pm.response.code);
  if (j.success) {
    pm.expect(j.message).to.be.a("string").and.not.empty;
    pm.expect(j.errors).to.be.null;
  } else {
    pm.expect(j.errors).to.be.an("array").and.not.empty;
  }
});
```

### 0.4 Convenciones de esta guía

- Para abreviar, en las respuestas se **omiten** `id`, `createdAt`, `updatedAt`, `isDeleted` salvo que importen. El texto exacto de `message` puede variar; lo importante es que **exista** en éxitos y que `errors` **exista** en fallos.
- `⟶ guardar` indica que debes copiar un valor a una variable del environment.
- Los tests con fechas asumen que **hoy es 9-oct-2026 (viernes)** y zona horaria **America/Guayaquil (UTC−5)**. Si pruebas otro día, recalcula las fechas con la misma lógica.
- Los saldos de F02–F07 asumen **base de datos limpia** y que ejecutas los tests en orden. Desde F08 los saldos se expresan **relativos** (`B0` = saldo antes del test).
- Recomendación para la mayoría de pruebas: `.env` con `RATE_LIMIT_ENABLED=false`. Solo se activa en F01-T11.
- Consola SQL (psql/DBeaver) y `redis-cli` te servirán para verificar borrado lógico, bloqueos y recordatorios.

---

## F00 — Base del proyecto

| # | Request | Esperado |
|---|---|---|
| F00-T1 | `GET {{baseUrl}}/health` (sin auth) | **200** |
| F00-T2 | `GET {{baseUrl}}/ruta-que-no-existe` | **404**, con formato estándar |
| F00-T3 | `POST {{baseUrl}}/auth/register` con body `{}` | **400**, `errors` con un mensaje por campo faltante |
| F00-T4 | `POST {{baseUrl}}/auth/register` con `{"email":"x@x.com","password":"Monea123*","name":"X","userId":"abc"}` | **400**, `errors` contiene que la propiedad `userId` no debe existir (`forbidNonWhitelisted`) |
| F00-T5 | `GET {{baseUrl}}/accounts` sin token | **401** |

**F00-T1 — respuesta esperada**
```json
{ "success": true, "statusCode": 200, "data": { "status": "ok" }, "message": "OK", "errors": null }
```

**F00-T2 / T5 — respuesta esperada (ejemplo T5)**
```json
{ "success": false, "statusCode": 401, "data": null, "message": "Unauthorized", "errors": ["Unauthorized"] }
```

**F00-T3 — respuesta esperada**
```json
{
  "success": false, "statusCode": 400, "data": null,
  "message": "Error de validación",
  "errors": ["email must be an email", "password must be longer than or equal to 8 characters", "name should not be empty"]
}
```

### F00-T6 — Validación de variables de entorno con Zod (por consola, no Postman)

Prueba cada caso, arranca con `pnpm start:dev` y verifica que **la app NO levanta** y el error nombra la variable:

| Cambio en `.env` | Resultado esperado |
|---|---|
| Borrar `JWT_ACCESS_SECRET` | Falla indicando `JWT_ACCESS_SECRET` requerida |
| `JWT_ACCESS_SECRET=corto` | Falla por longitud mínima (32) |
| `PORT=abc` | Falla por formato numérico |
| `RATE_LIMIT_ENABLED=quizas` | Falla (solo `true`/`false`) |
| `REDIS_URL=no-es-url` | Falla por formato |
| `DEFAULT_TIMEZONE=Marte/Olimpo` | Falla por zona inválida |
| Borrar `ACCOUNT_LOCK_9_PLUS_MINUTES` | Falla |

Restaura el `.env` al terminar.

---

## F01 — Autenticación y seguridad

Usuarios de prueba: **U1** `jose@test.com` (principal), **U2** `otro@test.com`, **lock** `lock@test.com`, **temp** `temp@test.com`.

### F01-T1 · Registro exitoso
- **POST** `{{baseUrl}}/auth/register` · Auth: **No Auth**
- **Body**
```json
{ "email": "jose@test.com", "password": "Monea123*", "name": "José", "timezone": "America/Guayaquil" }
```
- **Esperado 201**
```json
{
  "success": true, "statusCode": 201,
  "data": { "email": "jose@test.com", "name": "José", "timezone": "America/Guayaquil" },
  "message": "Usuario registrado correctamente", "errors": null
}
```
- ✅ `data` **no** contiene `passwordHash`. En BD el hash empieza con `$argon2id$`.
- Repite el registro con `otro@test.com`, `lock@test.com` y `temp@test.com` (misma contraseña).

### F01-T2 · Validaciones de registro

| Caso | Body (cambio) | Status | `errors` |
|---|---|---|---|
| Email duplicado | `jose@test.com` otra vez | **409** | indica que el email ya existe |
| Email inválido | `"email":"no-es-email"` | **400** | email inválido |
| Contraseña débil | `"password":"abc"` | **400** | longitud/mayúscula/número |
| Sin mayúscula | `"password":"monea123*"` | **400** | requiere mayúscula |
| Timezone inválida | `"timezone":"Mars/Base"` | **400** | timezone inválida |
| Email con mayúsculas | `"email":"JOSE@TEST.COM"` | **409** | (se normaliza a minúsculas) |

### F01-T3 · Login exitoso
- **POST** `{{baseUrl}}/auth/login` · **No Auth**
- **Body**: `{ "email": "{{email}}", "password": "{{password}}" }`
- **Tests (script)**:
```js
const d = pm.response.json().data;
pm.environment.set("accessToken", d.accessToken);
pm.environment.set("refreshToken", d.refreshToken);
```
- **Esperado 200**
```json
{
  "success": true, "statusCode": 200,
  "data": { "accessToken": "eyJ...", "refreshToken": "a1b2...", "expiresIn": 900 },
  "message": "Inicio de sesión exitoso", "errors": null
}
```
- ✅ **Redis:** `redis-cli KEYS "auth:access:*"` muestra una clave y `TTL` ≈ `JWT_ACCESS_EXPIRES_SECONDS`.
- ✅ **BD:** `SELECT "tokenHash","revokedAt" FROM refresh_tokens;` → el hash NO es igual al refresh token enviado.
- Repite el login para `otro@test.com` y guarda su token en `accessToken2`.

### F01-T4 · Login fallido (mensaje genérico)

| Caso | Body | Status | `message` |
|---|---|---|---|
| Contraseña incorrecta | `{"email":"jose@test.com","password":"Mala123*"}` | **401** | "Credenciales inválidas" |
| Email inexistente | `{"email":"nadie@test.com","password":"Monea123*"}` | **401** | **el mismo** "Credenciales inválidas" (no revela si el email existe) |
| Body vacío | `{}` | **400** | validación |

### F01-T5 · Rutas protegidas
- **GET** `{{baseUrl}}/users/me`
  - Con `Bearer {{accessToken}}` → **200**, `data: { "email":"jose@test.com", "name":"José", "timezone":"America/Guayaquil" }`.
  - Sin token → **401**.
  - Con token alterado (cambia un carácter) → **401**.
  - Con un access token **firmado con el refresh secret** → **401**.

### F01-T6 · Refresh con rotación
1. **POST** `{{baseUrl}}/auth/refresh` · **No Auth** · Body `{ "refreshToken": "{{refreshToken}}" }` → **200**, `data` con **nuevos** `accessToken` y `refreshToken`. Guarda el nuevo refresh en `refreshToken` y el anterior en una variable `oldRefreshToken` (copiándolo antes de ejecutar).
2. Repite el refresh usando **`oldRefreshToken`** → **401** (token reutilizado).
3. Ahora intenta refrescar con el **nuevo** `refreshToken` → **401** (la familia completa fue revocada por detección de reutilización).
4. ✅ **BD:** `SELECT "revokedAt","replacedByTokenId" FROM refresh_tokens ORDER BY "createdAt" DESC;` → los de la familia tienen `revokedAt` lleno. **Ninguna fila se borró.**
5. Haz login de nuevo para continuar con las demás pruebas.

### F01-T7 · Logout
1. Login (guarda tokens).
2. **POST** `{{baseUrl}}/auth/logout` · Bearer · Body `{ "refreshToken": "{{refreshToken}}" }` → **200**, `data: null`, `message` "Sesión cerrada".
3. **GET** `/users/me` con el **mismo** access token → **401** (la clave en Redis se eliminó aunque el JWT no haya expirado).
4. Refresh con ese refresh token → **401**.
5. Login de nuevo.

### F01-T8 · Logout global
1. Haz login 2 veces con `temp@test.com` (guarda `tokA`/`refA` y `tokB`/`refB`).
2. **POST** `/auth/logout-all` con `Bearer tokA` → **200**.
3. `GET /users/me` con `tokA` y con `tokB` → ambos **401**.
4. Refresh con `refA` y `refB` → ambos **401**.

### F01-T9 · Perfil y cambio de contraseña
Usa el usuario **temp** (para no afectar a U1).

| Request | Body | Esperado |
|---|---|---|
| `PATCH /users/me` | `{"name":"Temp Editado","timezone":"America/Bogota"}` | **200**, `data.name = "Temp Editado"` |
| `PATCH /users/me` | `{"timezone":"Invalid/Zone"}` | **400** |
| `PATCH /users/me` | `{"email":"otro@x.com"}` | **400** (campo no permitido) |
| `PATCH /users/me/password` | `{"currentPassword":"Mala123*","newPassword":"Nueva456*"}` | **400** o **401** (contraseña actual incorrecta) |
| `PATCH /users/me/password` | `{"currentPassword":"Monea123*","newPassword":"Nueva456*"}` | **200** |

Después del cambio exitoso:
- El access token anterior de `temp` → **401** en `/users/me`.
- Su refresh token anterior → **401**.
- Login con `Monea123*` → **401**; login con `Nueva456*` → **200**.

### F01-T10 · Bloqueo progresivo de cuenta

> **Preparación:** `RATE_LIMIT_ENABLED=false`. Para no esperar horas, usa en `.env` valores bajos (ej. `ACCOUNT_LOCK_5_MINUTES=1`) o simula con SQL (ver abajo).

Usa `lock@test.com`. Request: **POST** `/auth/login` con `{"email":"lock@test.com","password":"Mala123*"}`.

| Intento fallido nº | Esperado | Estado en BD (`users`) |
|---|---|---|
| 1 a 4 | **401** "Credenciales inválidas" | `failedLoginAttempts` = 1…4, `lockedUntil` = `NULL` |
| **5** | **401** | `failedLoginAttempts = 5`, `lockedUntil ≈ now + 15 min` |
| 6 (aun bloqueada) | **423** con mensaje que indica minutos restantes | `failedLoginAttempts` **no cambia** (sigue 5) |
| Login con la contraseña **correcta** mientras está bloqueada | **423** | sin cambios |

**Respuesta esperada del intento bloqueado**
```json
{ "success": false, "statusCode": 423, "data": null,
  "message": "Cuenta bloqueada temporalmente. Intenta de nuevo en 15 minutos",
  "errors": ["Cuenta bloqueada temporalmente. Intenta de nuevo en 15 minutos"] }
```

**Verificar los escalones.** Entre intentos, libera el bloqueo con SQL (sin tocar el contador) y verifica el `lockedUntil` generado:
```sql
UPDATE users SET "lockedUntil" = NULL WHERE email = 'lock@test.com';
SELECT "failedLoginAttempts", "lockedUntil" - now() AS restante FROM users WHERE email='lock@test.com';
```

| Intento fallido nº (tras liberar) | Bloqueo esperado |
|---|---|
| 6 | 15 min (`ACCOUNT_LOCK_5_MINUTES`) |
| 7 | 30 min |
| 8 | 2 horas |
| 9 | 5 horas |
| 10, 11… | 5 horas |

**Reinicio por login exitoso:**
1. `UPDATE users SET "lockedUntil" = NULL WHERE email='lock@test.com';`
2. Login con la contraseña **correcta** → **200**.
3. `SELECT "failedLoginAttempts","lockedUntil" FROM users WHERE email='lock@test.com';` → `0` y `NULL`.
4. Un nuevo fallo vuelve a contar desde 1.

**El bloqueo es por cuenta, no por IP:** mientras `lock@test.com` está bloqueada, `jose@test.com` debe poder iniciar sesión con normalidad desde la misma IP.

### F01-T11 · Bloqueo por IP (20 intentos en 5 min)

> **Preparación:** `RATE_LIMIT_ENABLED=false`, `IP_LOCK_WINDOW_MINUTES=5`, `IP_LOCK_MINUTES=15` (puedes bajar a 1 para acelerar). Usa **emails inexistentes** para que no se bloqueen cuentas.

1. Crea un request **POST** `/auth/login` con body `{"email":"fantasma{{$randomInt}}@test.com","password":"Mala123*"}`.
2. Ejecútalo con el **Collection Runner** **20 iteraciones** → los 20 devuelven **401**.
3. Ejecuta la iteración **21** → **429** con mensaje de IP bloqueada y minutos restantes.
```json
{ "success": false, "statusCode": 429, "data": null,
  "message": "Demasiados intentos fallidos. Tu IP está bloqueada por 15 minutos",
  "errors": ["Demasiados intentos fallidos. Tu IP está bloqueada por 15 minutos"] }
```
4. Con la IP bloqueada, **login válido** de `jose@test.com` → **429** (el bloqueo es por IP).
5. ✅ **Redis:** `GET auth:ip-block:<ip>` existe y `TTL` ≈ 900 s (o `IP_LOCK_MINUTES*60`).
6. Una vez expirado el bloqueo, haz **1 solo intento fallido** → debe volver a quedar **bloqueada otros 15 min** (cada fallo adicional renueva el bloqueo).
7. Un **login exitoso no reinicia** el contador de IP: verifica que `auth:ip-fails:<ip>` / `auth:ip-flagged:<ip>` siguen en Redis tras un login válido (cuando no esté bloqueada).
8. Limpieza: `redis-cli DEL auth:ip-block:<ip> auth:ip-flagged:<ip> auth:ip-fails:<ip>`.

### F01-T12 · Rate limit estricto y relajado

> **Preparación:** `.env`:
> `RATE_LIMIT_ENABLED=true`, `RATE_LIMIT_STRICT_LIMIT=5`, `RATE_LIMIT_STRICT_TTL_SECONDS=60`, `RATE_LIMIT_STRICT_BLOCK_SECONDS=30`, `RATE_LIMIT_RELAXED_LIMIT=15`, `RATE_LIMIT_RELAXED_TTL_SECONDS=60`, `RATE_LIMIT_RELAXED_BLOCK_SECONDS=30`. Reinicia la app.

| Test | Acción | Esperado |
|---|---|---|
| Estricto (público) | `POST /auth/login` (credenciales válidas) 6 veces seguidas | Intentos 1–5: **200**; el 6.º: **429** con formato estándar |
| Tiempo de baneo | Repite el request durante los 30 s siguientes | Sigue **429**; pasados 30 s vuelve a **200** |
| Relajado (autenticado) | `GET /users/me` 16 veces seguidas con token | 1–15: **200**; el 16.º: **429** |
| Independencia | Mientras `/auth/login` está limitado, `GET /users/me` sigue respondiendo **200** | ✅ |
| Desactivado | `RATE_LIMIT_ENABLED=false`, reiniciar, repetir 30 requests | Todos sin **429** |

Al terminar vuelve a `RATE_LIMIT_ENABLED=false` y haz login de U1 y U2 otra vez.

---

## F02 — Cuentas bancarias

### F02-T1 · Crear cuenta
- **POST** `{{baseUrl}}/accounts` · Bearer `{{accessToken}}`
- **Body**
```json
{
  "name": "Pichincha Ahorros",
  "financialInstitution": "Banco Pichincha",
  "color": "#1E88E5",
  "initialBalance": 1000.00,
  "description": "Cuenta principal"
}
```
- **Esperado 201**
```json
{
  "success": true, "statusCode": 201,
  "data": {
    "name": "Pichincha Ahorros", "financialInstitution": "Banco Pichincha",
    "color": "#1E88E5", "initialBalance": 1000, "description": "Cuenta principal",
    "currentBalance": 1000
  },
  "message": "Cuenta creada correctamente", "errors": null
}
```
- ⟶ guardar `data.id` en `accountId`.
- ✅ `data` **no** trae `userId` ajeno (si lo trae, debe ser el tuyo).

### F02-T2 · Crear cuenta sin descripción (opcional)
- **POST** `/accounts` · Body
```json
{ "name": "Efectivo", "financialInstitution": "Billetera", "color": "#43A047", "initialBalance": 50 }
```
- **Esperado 201**, `data.description = null`. ⟶ guardar id como `account2Id`.

### F02-T3 · Validaciones

| Caso | Cambio al body de F02-T1 | Status |
|---|---|---|
| Sin nombre | quitar `name` | **400** |
| Sin entidad financiera | quitar `financialInstitution` | **400** |
| Color inválido | `"color":"rojo"` | **400** |
| Balance no numérico | `"initialBalance":"abc"` | **400** |
| Balance con 3 decimales | `"initialBalance":10.123` | **400** |
| Sin token | — | **401** |
| Enviar `userId` | agregar `"userId":"..."` | **400** |

### F02-T4 · Listar
- **GET** `/accounts` → **200**, `data` es un array con **2** cuentas, cada una con `currentBalance` (`1000` y `50`).

### F02-T5 · Obtener una
- **GET** `/accounts/{{accountId}}` → **200**, mismos datos de T1.
- **GET** `/accounts/3f2b8c1a-0000-4000-8000-000000000000` → **404**, `message`: "Cuenta no encontrada".
- **GET** `/accounts/no-es-uuid` → **400**.

### F02-T6 · Ownership (otro usuario)
- Con `Bearer {{accessToken2}}`:
  - **GET** `/accounts` → **200**, `data: []`.
  - **GET** `/accounts/{{accountId}}` → **404** (no 403: no revela existencia).
  - **PATCH** y **DELETE** de esa cuenta → **404**.

### F02-T7 · Actualizar
- **PATCH** `/accounts/{{accountId}}` · Body `{ "name": "Pichincha Principal", "color": "#0D47A1" }`
- **Esperado 200**: `data.name = "Pichincha Principal"`, `data.color = "#0D47A1"`, `financialInstitution` sin cambios.

### F02-T8 · Borrado lógico
1. **DELETE** `/accounts/{{account2Id}}` → **200**, `data: null`.
2. **GET** `/accounts/{{account2Id}}` → **404**.
3. **GET** `/accounts` → solo **1** cuenta.
4. ✅ **BD:** `SELECT "isDeleted","deletedAt" FROM accounts WHERE id='<account2Id>';` → **la fila existe** con `isDeleted = true`.

---

## F03 — Notificaciones y recordatorios

### F03-T1 · Registrar dispositivo
- **POST** `{{baseUrl}}/notifications/devices` · Bearer
- **Body**: `{ "token": "fcm_token_de_prueba_123456" }` (o un token real de tu app Android)
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "token": "fcm_token_de_prueba_123456", "platform": "ANDROID", "isActive": true },
  "message": "Dispositivo registrado", "errors": null }
```
- Repite el mismo request → **201** y en BD **una sola fila** (upsert): `SELECT count(*) FROM device_tokens WHERE token='fcm_token_de_prueba_123456';` → `1`.
- Body `{}` o `{"token":""}` → **400**.
- Registrar el **mismo token con U2** → se reasigna a U2 (una sola fila, `userId` de U2).

### F03-T2 · Desactivar dispositivo
- **DELETE** `/notifications/devices/fcm_token_de_prueba_123456` → **200**.
- BD: fila existente con `isActive = false`.

### F03-T3 · Listar recordatorios
- **GET** `/notifications/reminders` → **200**, `data` array (vacío si aún no creaste tarjetas/cobros). Solo trae recordatorios **futuros y PENDING del usuario**.

### F03-T4 · Despacho (cron) de recordatorios vencidos
1. Registra un **token FCM real** de tu app con U1.
2. Inserta un recordatorio vencido:
```sql
INSERT INTO reminders (id, "userId", type, "sourceId", title, body, "scheduledAt", status, attempts, "isDeleted", "createdAt", "updatedAt")
SELECT gen_random_uuid(), id, 'DEBT', gen_random_uuid(), 'Prueba MONEA', 'Notificación de prueba',
       now() - interval '1 minute', 'PENDING', 0, false, now(), now()
FROM users WHERE email='jose@test.com';
```
3. Espera ≤ 60 s. Esperado: llega el push al dispositivo; en BD `status='SENT'` y `sentAt` lleno.
4. Con un token **inválido**: el recordatorio aumenta `attempts`; tras 3 intentos → `FAILED`, y el token queda `isActive=false`.
5. **Lock distribuido:** levanta 2 instancias de la app (puertos distintos) y repite 2–3: el recordatorio se envía **una sola vez**.
6. Con `SCHEDULER_ENABLED=false` y reinicio, repite 2: el recordatorio **permanece PENDING**.

---

## F04 — Ingresos

Saldo inicial de `accountId` tras F02: **1000.00**.

### F04-T1 · Crear ingreso
- **POST** `{{baseUrl}}/incomes` · Bearer
- **Body**
```json
{ "name": "Sueldo octubre", "accountId": "{{accountId}}", "amount": 500, "description": "Pago mensual" }
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "name": "Sueldo octubre", "accountId": "<accountId>", "amount": 500,
            "description": "Pago mensual", "sourceType": "MANUAL", "date": "2026-10-09T..." },
  "message": "Ingreso registrado correctamente", "errors": null }
```
- ⟶ guardar `incomeId`.
- **Verificar saldo:** `GET /accounts/{{accountId}}` → `currentBalance = 1500`.

### F04-T2 · Validaciones

| Caso | Cambio | Status |
|---|---|---|
| Monto 0 | `"amount":0` | **400** |
| Monto negativo | `"amount":-5` | **400** |
| Sin nombre | quitar `name` | **400** |
| Sin cuenta | quitar `accountId` | **400** |
| `accountId` no UUID | `"accountId":"123"` | **400** |
| Cuenta de otro usuario (usa `accessToken2`) | — | **404** |
| Cuenta borrada (`account2Id`) | — | **404** |
| Descripción omitida | quitar `description` | **201** (es opcional) |

### F04-T3 · Listar con filtros y paginación
- **GET** `/incomes?accountId={{accountId}}&page=1&limit=10` → **200**
```json
{ "success": true, "statusCode": 200,
  "data": { "items": [ { "name": "Sueldo octubre", "amount": 500 } ],
            "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 } },
  "message": "Ingresos obtenidos", "errors": null }
```
- **GET** `/incomes?from=2020-01-01&to=2020-01-02` → `items: []`, `total: 0`.
- **GET** `/incomes?limit=0` → **400**.

### F04-T4 · Obtener / actualizar
- **GET** `/incomes/{{incomeId}}` → **200**.
- **PATCH** `/incomes/{{incomeId}}` · Body `{ "amount": 600 }` → **200**, `data.amount = 600`. Saldo de la cuenta → **1600**.
- **PATCH** con `{ "name": "Sueldo (editado)" }` → **200**.
- Con `accessToken2` → **404**.

### F04-T5 · Borrado lógico y recreación
1. **DELETE** `/incomes/{{incomeId}}` → **200**. `GET /incomes/{{incomeId}}` → **404**. Saldo → **1000**.
2. BD: fila existente con `isDeleted = true`.
3. **Recrea** el ingreso (T1 con `"amount": 600`) y guarda el nuevo `incomeId`. Saldo final → **1600**.

---

## F05 — Tarjetas de crédito (registro)

### F05-T1 · Crear tarjeta completa
- **POST** `{{baseUrl}}/credit-cards` · Bearer
- **Body**
```json
{
  "name": "Visa Pichincha", "color": "#E53935", "issuer": "Banco Pichincha",
  "lastFourDigits": "4417", "creditLimit": 2000,
  "cutoffDay": 20, "paymentDay": 5,
  "reminderEnabled": true, "reminderDaysBefore": 1, "reminderHour": 9
}
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "name": "Visa Pichincha", "color": "#E53935", "issuer": "Banco Pichincha",
            "lastFourDigits": "4417", "creditLimit": 2000, "cutoffDay": 20, "paymentDay": 5,
            "reminderEnabled": true, "reminderDaysBefore": 1, "reminderHour": 9 },
  "message": "Tarjeta creada correctamente", "errors": null }
```
- ⟶ guardar `cardId`.
- **Verificar recordatorio:** `GET /notifications/reminders` → un recordatorio `type: "CREDIT_CARD_PAYMENT"` con `scheduledAt` = día anterior al próximo día 5 a las 09:00 hora Ecuador. Hoy (9-oct-2026) → `"2026-11-04T14:00:00.000Z"`.

### F05-T2 · Crear tarjeta mínima (campos opcionales nulos)
- **POST** `/credit-cards` · Body
```json
{ "name": "Mastercard", "color": "#FB8C00", "issuer": "Produbanco", "lastFourDigits": "9001" }
```
- **Esperado 201**: `creditLimit`, `cutoffDay`, `paymentDay` = `null`, `reminderEnabled = false`. ⟶ guardar como `card2Id`.

### F05-T3 · Validaciones

| Caso | Body | Status |
|---|---|---|
| Dígitos insuficientes | `"lastFourDigits":"12"` | **400** |
| Dígitos no numéricos | `"lastFourDigits":"12ab"` | **400** |
| Día de corte inválido | `"cutoffDay":32` | **400** |
| Día de pago 0 | `"paymentDay":0` | **400** |
| Recordatorio sin fecha de pago | `{...T2, "reminderEnabled":true}` | **400** (requiere `paymentDay`) |
| Hora inválida | `"reminderHour":25` | **400** |
| Cupo negativo | `"creditLimit":-1` | **400** |

### F05-T4 · Listar, obtener, ownership
- **GET** `/credit-cards` → **200**, 2 tarjetas.
- **GET** `/credit-cards/{{cardId}}` → **200**.
- Con `accessToken2` → lista `[]` y detalle **404**.

### F05-T5 · Actualizar y recordatorios
1. **PATCH** `/credit-cards/{{cardId}}` · `{ "reminderEnabled": false }` → **200**.
   - `GET /notifications/reminders` ya **no** muestra el recordatorio. BD: `status = 'CANCELLED'` (la fila no se borra).
2. **PATCH** `{ "reminderEnabled": true, "paymentDay": 10 }` → **200**; nuevo recordatorio para el **9-nov 09:00** → `"2026-11-09T14:00:00.000Z"`.
3. **PATCH** `{ "paymentDay": 5 }` para volver al estado original (recordatorio reprogramado al 4-nov).

### F05-T6 · Borrado lógico
- **DELETE** `/credit-cards/{{card2Id}}` → **200**; `GET` → **404**; BD `isDeleted = true`.

---

## F06 — Egresos (instantáneos y diferidos)

Saldo de `accountId` al iniciar: **1600.00**.

### F06-T1 · Egreso instantáneo (sin forma de pago → corriente)
- **POST** `{{baseUrl}}/expenses` · Bearer
- **Body**
```json
{ "name": "Golosina", "accountId": "{{accountId}}", "amount": 2.50, "description": "Chocolate" }
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "name": "Golosina", "amount": 2.5, "paymentMethod": "CORRIENTE",
            "creditCardId": null, "installments": null, "graceMonths": 0,
            "amountPending": false, "sourceType": "MANUAL" },
  "message": "Egreso registrado correctamente", "errors": null }
```
- ⟶ guardar `expenseId`. Saldo → **1597.50**.

### F06-T2 · Egreso corriente explícito
- **Body**: `{ "name": "Almuerzo", "accountId": "{{accountId}}", "amount": 7.5, "paymentMethod": "CORRIENTE" }` → **201**. Saldo → **1590.00**. ⟶ guardar `lunchExpenseId`.

### F06-T3 · Egreso diferido simple (3 cuotas, sin gracia)
- **Body**
```json
{ "name": "Laptop", "accountId": "{{accountId}}", "amount": 900,
  "paymentMethod": "DIFERIDO", "creditCardId": "{{cardId}}", "installments": 3, "graceMonths": 0 }
```
- **Esperado 201** (compra hoy, 9-oct ≤ día de corte 20 → primer periodo `2026-10`)
```json
{ "success": true, "statusCode": 201,
  "data": { "name": "Laptop", "amount": 900, "paymentMethod": "DIFERIDO", "installments": 3, "graceMonths": 0,
            "installmentPlan": [
              { "number": 1, "amount": 300, "period": "2026-10", "isPaid": false },
              { "number": 2, "amount": 300, "period": "2026-11", "isPaid": false },
              { "number": 3, "amount": 300, "period": "2026-12", "isPaid": false } ] },
  "message": "Egreso registrado correctamente", "errors": null }
```
- ⟶ guardar `expenseDeferredId`. **El saldo de la cuenta NO cambia** (sigue **1590.00**).

### F06-T4 · Diferido con meses de gracia y redondeo
- **Body**: `{ "name":"Celular","accountId":"{{accountId}}","amount":100,"paymentMethod":"DIFERIDO","creditCardId":"{{cardId}}","installments":3,"graceMonths":1 }`
- **Esperado 201**: cuotas `33.33` (`2026-11`), `33.33` (`2026-12`), `33.34` (`2027-01`) → el residuo va a la última. Suma = 100.00.

### F06-T5 · Diferido con compra posterior al corte
- **Body**: `{ "name":"Zapatos","accountId":"{{accountId}}","amount":60,"paymentMethod":"DIFERIDO","creditCardId":"{{cardId}}","installments":2,"date":"2026-10-25T15:00:00.000Z" }`
- **Esperado 201**: día 25 > corte 20 → cuotas `30` (`2026-11`) y `30` (`2026-12`). ⟶ guardar `shoesId`.

### F06-T6 · Validaciones

| Caso | Body | Status |
|---|---|---|
| Diferido sin tarjeta | `paymentMethod:"DIFERIDO"` sin `creditCardId` | **400** |
| Diferido sin cuotas | sin `installments` | **400** |
| Corriente con tarjeta | `CORRIENTE` + `creditCardId` | **400** |
| Cuotas 0 | `"installments":0` | **400** |
| Gracia negativa | `"graceMonths":-1` | **400** |
| Monto negativo | `"amount":-1` | **400** |
| Tarjeta de otro usuario (`accessToken2`) | — | **404** |
| Cuenta inexistente | `accountId` aleatorio | **404** |
| Fijar monto a un egreso no pendiente | `PATCH /expenses/{{expenseId}}/amount` `{"amount":5}` | **400** |

### F06-T7 · Consultas
- **GET** `/expenses?paymentMethod=DIFERIDO` → **200**, `items` con **3** egresos (Laptop, Celular, Zapatos).
- **GET** `/expenses?accountId={{accountId}}&creditCardId={{cardId}}` → los 3 diferidos.
- **GET** `/expenses/{{expenseDeferredId}}` → incluye `installmentPlan` con 3 cuotas.
- **GET** `/expenses?from=2020-01-01&to=2020-01-02` → vacío.

### F06-T8 · Actualizar
1. **PATCH** `/expenses/{{expenseId}}` · `{ "amount": 3 }` → **200**. Saldo → **1589.50** (1600 − 3 − 7.5, el almuerzo sigue vigente hasta F06-T9).
2. **Regeneración de cuotas:** **PATCH** `/expenses/{{shoesId}}` · `{ "installments": 3 }` → **200**, plan `20 / 20 / 20` en `2026-11`, `2026-12`, `2027-01`. BD: las 2 cuotas anteriores siguen en la tabla con `isDeleted = true` (3 nuevas activas).
3. **PATCH** `{ "installments": 2 }` → vuelve a `30 / 30`.
4. **PATCH** `/expenses/{{expenseDeferredId}}` · `{ "paymentMethod": "CORRIENTE" }` → **400** (no se puede cambiar el método).

### F06-T9 · Borrado lógico
- **DELETE** `/expenses/{{lunchExpenseId}}` → **200**. Saldo final → **1597.00** (1600 − 3).
- BD: `isDeleted = true` en el egreso.

> **Estado al terminar F06:** saldo de `accountId` = **1597.00**. Tarjeta `cardId` con cuotas pendientes: `2026-10` = 300 · `2026-11` = 363.33 · `2026-12` = 363.33 · `2027-01` = 33.34 (total **1060.00**).

---

## F07 — Reportes y pago de tarjetas

### F07-T1 · Reporte mensual
- **GET** `{{baseUrl}}/credit-cards/{{cardId}}/report?period=2026-10` · Bearer
- **Esperado 200**
```json
{ "success": true, "statusCode": 200,
  "data": { "period": "2026-10", "total": 300, "paid": false, "paidAt": null,
            "cutoffDate": "2026-10-20", "paymentDate": "2026-11-05",
            "items": [ { "name": "Laptop", "installmentNumber": 1, "installmentsTotal": 3, "amount": 300 } ] },
  "message": "Reporte generado", "errors": null }
```

| Periodo | `total` esperado | Items |
|---|---|---|
| `2026-11` | **363.33** | Laptop 2/3 (300) · Celular 1/3 (33.33) · Zapatos 1/2 (30) |
| `2026-12` | **363.33** | Laptop 3/3 · Celular 2/3 · Zapatos 2/2 |
| `2027-01` | **33.34** | Celular 3/3 |
| `2027-06` | **0** | `[]` |
| `2026-13` | **400** | — |
| (sin `period`) | **400** | — |

### F07-T2 · Reporte por rango
- **GET** `/credit-cards/{{cardId}}/report/range?from=2026-10&to=2027-01` → **200**
```json
{ "data": { "months": [
    { "period": "2026-10", "total": 300,    "paid": false },
    { "period": "2026-11", "total": 363.33, "paid": false },
    { "period": "2026-12", "total": 363.33, "paid": false },
    { "period": "2027-01", "total": 33.34,  "paid": false } ],
  "grandTotal": 1060 } }
```
- Rango > 24 meses (`from=2026-01&to=2029-01`) → **400**. `from` > `to` → **400**.

### F07-T3 · Deuda actual
- **GET** `/credit-cards/{{cardId}}/debt` → **200**
```json
{ "data": { "currentDebt": 300, "upcoming": 760, "totalPending": 1060,
            "creditLimit": 2000, "availableCredit": 940 } }
```
- Con `card2Id` (borrada) → **404**. Con la tarjeta sin cupo → `availableCredit: null`.

### F07-T4 · Marcar mes como pagado
- **POST** `/credit-cards/{{cardId}}/pay` · Bearer
- **Body**: `{ "accountId": "{{accountId}}" }` (sin `period` → mes actual)
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "creditCardId": "<cardId>", "accountId": "<accountId>", "expenseId": "<uuid>",
            "period": "2026-10", "amount": 300, "paidAt": "2026-10-09T..." },
  "message": "Tarjeta pagada correctamente", "errors": null }
```
Verificaciones:
1. `GET /expenses/<expenseId>` → `sourceType: "CARD_PAYMENT"`, `paymentMethod: "CORRIENTE"`, `amount: 300`.
2. Saldo de `accountId` → **1297.00** (1597 − 300).
3. `GET /credit-cards/{{cardId}}/report?period=2026-10` → `paid: true`, `paidAt` lleno.
4. `GET /credit-cards/{{cardId}}/debt` → `currentDebt: 0`, `upcoming: 760`, `availableCredit: 1240`.
5. BD: cuotas de `2026-10` con `isPaid = true` y `cardPaymentId` lleno.

### F07-T5 · Validaciones del pago

| Caso | Request | Status |
|---|---|---|
| Pagar de nuevo el mismo mes | repetir T4 | **409/400** ("ya fue pagado") |
| Periodo futuro | `{"accountId":"...","period":"2026-12"}` | **400** |
| Periodo sin deuda | `{"accountId":"...","period":"2026-09"}` | **400** |
| Sin `accountId` | `{}` | **400** |
| Cuenta de otro usuario | con `accessToken2` | **404** |
| Eliminar egreso con cuota pagada | `DELETE /expenses/{{expenseDeferredId}}` | **400** |
| Cambiar cuotas con cuota pagada | `PATCH /expenses/{{expenseDeferredId}}` `{"installments":2}` | **400** |

### F07-T6 · Atomicidad
Fuerza un fallo (ej. detén Postgres tras enviar el request o usa una cuenta inválida) y verifica que **no** queda un egreso `CARD_PAYMENT` huérfano ni cuotas marcadas como pagadas sin `cardPaymentId`.

> **Estado al terminar F07:** saldo `accountId` = **1297.00**.

---

## F08 — Egresos recurrentes

> **Preparación:** `SCHEDULER_ENABLED=true`. Anota el saldo actual como **B0** (esperado 1297.00). Para no esperar al cron, fuerza la ejecución con SQL (`nextRunAt = now() - interval '1 minute'`) y espera al siguiente ciclo del job (o baja temporalmente el cron a cada minuto).

### F08-T1 · Semanal con recordatorio
- **POST** `{{baseUrl}}/recurring-expenses` · Bearer
- **Body**
```json
{ "name": "Gimnasio semanal", "accountId": "{{accountId}}", "amount": 10,
  "frequency": "WEEKLY", "dayOfWeek": 1, "startDate": "2026-10-09",
  "reminderEnabled": true, "reminderOffset": "ONE_DAY_BEFORE", "reminderHour": 8 }
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "name": "Gimnasio semanal", "amount": 10, "isVariableAmount": false,
            "frequency": "WEEKLY", "dayOfWeek": 1, "isActive": true,
            "nextRunAt": "2026-10-12T05:00:00.000Z", "endDate": null },
  "message": "Configuración de egreso recurrente creada", "errors": null }
```
- `nextRunAt` = próximo **lunes 12-oct-2026**. ⟶ guardar `recurringId`.
- `GET /notifications/reminders` → recordatorio `RECURRING_EXPENSE` en `2026-10-11T13:00:00.000Z` (domingo 08:00 Ecuador).

### F08-T2 · Mensual de monto variable
- **Body**
```json
{ "name": "Luz", "accountId": "{{accountId}}", "isVariableAmount": true,
  "frequency": "MONTHLY", "dayOfMonth": 31, "startDate": "2026-10-09",
  "reminderEnabled": true, "reminderOffset": "SAME_DAY", "reminderHour": 9 }
```
- **Esperado 201**: `amount: null`, `isVariableAmount: true`, `nextRunAt` = **31-oct-2026**. ⟶ guardar `variableRecurringId`.

### F08-T3 · Mensual día 31 en mes corto
- **Body**: `{ "name":"Internet","accountId":"{{accountId}}","amount":25,"frequency":"MONTHLY","dayOfMonth":31,"startDate":"2026-11-01" }`
- **Esperado 201**: `nextRunAt` = **30-nov-2026** (último día del mes).

### F08-T4 · Anual (solo mes y mes+día)
| Body (`frequency: "YEARLY"`) | `nextRunAt` esperado |
|---|---|
| `"monthOfYear": 8` (solo mes) | **1-ago-2027** |
| `"monthOfYear": 8, "dayOfMonth": 15` | **15-ago-2027** |

(Ambos con `amount`, `accountId` y `startDate: "2026-10-09"`.)

### F08-T5 · Validaciones

| Caso | Status |
|---|---|
| `WEEKLY` sin `dayOfWeek` | **400** |
| `dayOfWeek: 8` | **400** |
| `MONTHLY` con `dayOfMonth: 0` o `32` | **400** |
| `YEARLY` sin `monthOfYear` | **400** |
| `isVariableAmount: true` **con** `amount` | **400** |
| `isVariableAmount: false` **sin** `amount` | **400** |
| `endDate` anterior a `startDate` | **400** |
| `reminderEnabled: true` sin `reminderOffset`/`reminderHour` | **400** |
| `reminderHour: 25` | **400** |
| Cuenta de otro usuario / `accessToken2` | **404** |

### F08-T6 · Generación automática (monto fijo)
1. Crea: `{ "name":"Prueba automática","accountId":"{{accountId}}","amount":5,"frequency":"MONTHLY","dayOfMonth":9,"startDate":"2026-10-09" }` ⟶ guarda `autoId`.
2. Fuerza ejecución:
```sql
UPDATE recurring_expense_configs SET "nextRunAt" = now() - interval '1 minute' WHERE id = '<autoId>';
```
3. Tras el cron, **GET** `/expenses?accountId={{accountId}}` → aparece un egreso `name: "Prueba automática"`, `amount: 5`, `paymentMethod: "CORRIENTE"`, `sourceType: "RECURRING"`, `amountPending: false`.
4. Saldo → **B0 − 5**.
5. BD: `nextRunAt` avanzó al mes siguiente (**9-nov-2026**) y `lastGeneratedAt` está lleno.
6. **Idempotencia:** vuelve a poner `nextRunAt` en la misma ocurrencia y espera otro ciclo → **no** se crea un segundo egreso para la misma fecha (índice único `(recurringConfigId, occurrenceDate)`).

### F08-T7 · Generación con monto variable
1. `UPDATE recurring_expense_configs SET "nextRunAt" = now() - interval '1 minute' WHERE id = '<variableRecurringId>';`
2. Tras el cron: **GET** `/expenses?amountPending=true` → egreso `name: "Luz"`, `amount: 0`, `amountPending: true`, `paymentMethod: "CORRIENTE"`. ⟶ guardar `pendingExpenseId`.
3. **PATCH** `/expenses/{{pendingExpenseId}}/amount` · Body `{ "amount": 42.75 }` → **200**, `amount: 42.75`, `amountPending: false`.
4. Repetir el PATCH → **400** (ya no está pendiente).
5. `GET /recurring-expenses/{{variableRecurringId}}` → `amount` sigue `null` (el monto fijado afecta **solo ese egreso**).
6. Saldo → **B0 − 42.75**.

### F08-T8 · Activar / desactivar
- **PATCH** `/recurring-expenses/{{recurringId}}/active` · Body `{ "isActive": false }` → **200**, `isActive: false`. Recordatorios en BD → `CANCELLED`.
- Fuerza `nextRunAt` al pasado con SQL → el cron **no** genera egreso.
- **PATCH** `{ "isActive": true }` → **200**; `nextRunAt` se recalcula desde hoy (**sin** generar egresos atrasados) y se reprograma el recordatorio.

### F08-T9 · Fecha de fin
```sql
UPDATE recurring_expense_configs
SET "endDate" = current_date - 1, "nextRunAt" = now() - interval '1 minute'
WHERE id = '<recurringId>';
```
Tras el cron: **no** se crea egreso y la config queda `isActive = false`.

### F08-T10 · Actualizar y eliminar
- **PATCH** `/recurring-expenses/{{recurringId}}` · `{ "amount": 12, "reminderHour": 10 }` → **200**; recordatorio reprogramado a las 10:00; egresos ya generados **no cambian**.
- **DELETE** `/recurring-expenses/{{recurringId}}` → **200**; `GET` → **404**; recordatorios `CANCELLED`; los **egresos generados siguen** en `GET /expenses`; BD config con `isDeleted = true`.
- Con `accessToken2` cualquier operación sobre estas configs → **404**.

---

## F09 — Cobros

Anota el saldo de `accountId` como **B0**.

### F09-T1 · Cobro de 1 cuota con recordatorio de fecha única
- **POST** `{{baseUrl}}/collections` · Bearer
- **Body**
```json
{ "personName": "Carlos Pérez", "totalAmount": 100, "installmentsCount": 1,
  "description": "Préstamo de almuerzo", "reminderEnabled": true,
  "reminderAt": "2026-12-01T14:00:00.000Z" }
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "personName": "Carlos Pérez", "totalAmount": 100, "installmentsCount": 1, "status": "PENDING",
            "installments": [ { "number": 1, "amount": 100, "dueDate": "2026-12-01T14:00:00.000Z", "isPaid": false } ] },
  "message": "Cobro registrado correctamente", "errors": null }
```
- ⟶ guardar `collectionId` y el id de su cuota como `singleInstallmentId`.

### F09-T2 · Cobro en 3 cuotas con recordatorio mensual
- **Body**
```json
{ "personName": "Ana Torres", "totalAmount": 100, "installmentsCount": 3,
  "reminderEnabled": true, "reminderFrequency": "MONTHLY", "reminderDayOfMonth": 15, "reminderHour": 10 }
```
- **Esperado 201**: cuotas `33.33 / 33.33 / 33.34` con `dueDate`:
  `2026-10-15T15:00:00.000Z`, `2026-11-15T15:00:00.000Z`, `2026-12-15T15:00:00.000Z` (10:00 Ecuador).
- ⟶ guardar `collection2Id`, `inst1Id`, `inst2Id`, `inst3Id`.
- `GET /notifications/reminders` → 3 recordatorios `COLLECTION` para esas fechas.

### F09-T3 · Cobro sin recordatorio
- **Body**: `{ "personName":"Luis","totalAmount":50,"installmentsCount":2 }` → **201**, cuotas `25 / 25` con `dueDate: null`, sin recordatorios. ⟶ guardar `collection3Id`.

### F09-T4 · Validaciones

| Caso | Status |
|---|---|
| `totalAmount: 0` | **400** |
| `installmentsCount: 0` | **400** |
| 3 cuotas con `reminderEnabled: true` y sin `reminderFrequency` | **400** |
| 1 cuota con `reminderFrequency` (debe usar `reminderAt`) | **400** |
| `reminderAt` con minutos (`...T14:30:00.000Z`) | **400** (solo hora) |
| `reminderDayOfMonth: 40` | **400** |
| Sin `personName` | **400** |

### F09-T5 · Listar y obtener
- **GET** `/collections?status=PENDING` → **200**, 3 cobros, cada uno con `paidAmount: 0` y `pendingAmount` = total.
- **GET** `/collections/{{collection2Id}}` → con las 3 cuotas.
- Con `accessToken2` → listas vacías y detalle **404**.

### F09-T6 · Pagar cuota → crea ingreso
- **POST** `/collections/{{collection2Id}}/installments/{{inst1Id}}/pay` · Body `{ "accountId": "{{accountId}}" }`
- **Esperado 200**
```json
{ "success": true, "statusCode": 200,
  "data": { "installment": { "number": 1, "amount": 33.33, "isPaid": true, "paidAt": "2026-10-09T...", "incomeId": "<uuid>" },
            "collectionStatus": "PARTIAL" },
  "message": "Cuota pagada correctamente", "errors": null }
```
Verificaciones:
1. `GET /incomes/<incomeId>` → `sourceType: "COLLECTION_INSTALLMENT"`, `amount: 33.33`, cuenta = `accountId`.
2. Saldo → **B0 + 33.33**.
3. Su recordatorio queda `CANCELLED`.
4. Repetir el pago de la misma cuota → **400**.
5. Pagar sin `accountId` → **400**; con cuenta de otro usuario → **404**.
6. Pagar `inst2Id` e `inst3Id` → `collectionStatus: "PAID"` tras la última; saldo total **B0 + 100.00**.
7. Pagar la cuota única de `collectionId` → `PAID`; saldo **B0 + 200.00**.

### F09-T7 · Protección de ingresos automáticos
- **PATCH** `/incomes/<incomeId>` · `{ "amount": 1 }` → **400** (el monto lo gobierna el cobro).
- **PATCH** `/incomes/<incomeId>` · `{ "name": "Cobro Ana (1/3)" }` → **200**.
- **DELETE** `/incomes/<incomeId>` → **400**.

### F09-T8 · Actualizar
- Cobro con cuotas pagadas (`collection2Id`):
  - `PATCH` `{ "totalAmount": 200 }` → **400**.
  - `PATCH` `{ "description": "Pago por el taller" }` → **200**.
- Cobro sin pagos (`collection3Id`): `PATCH` `{ "totalAmount": 200, "installmentsCount": 2 }` → **200**, cuotas regeneradas `100 / 100` (las anteriores quedan `isDeleted = true`).

### F09-T9 · Eliminar
- **DELETE** `/collections/{{collection3Id}}` → **200**; `GET` → **404**; recordatorios `CANCELLED`; los ingresos ya creados por otros cobros **se conservan**; BD `isDeleted = true`.

---

## F10 — Préstamos

Crea una tercera cuenta y anota el saldo de `accountId` como **B0**.

### F10-T0 · Cuenta destino
- **POST** `/accounts` · `{ "name":"Cooperativa","financialInstitution":"JEP","color":"#8E24AA","initialBalance":0 }` → ⟶ guardar `account3Id`.

### F10-T1 · Crear préstamo (genera egreso)
- **POST** `{{baseUrl}}/loans` · Bearer
- **Body**
```json
{ "accountId": "{{accountId}}", "personName": "María Gómez", "totalAmount": 200,
  "installmentsCount": 2, "description": "Préstamo personal",
  "reminderEnabled": true, "reminderFrequency": "MONTHLY", "reminderDayOfMonth": 20, "reminderHour": 9 }
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "personName": "María Gómez", "totalAmount": 200, "installmentsCount": 2, "status": "PENDING",
            "accountId": "<accountId>", "expenseId": "<uuid>",
            "installments": [
              { "number": 1, "amount": 100, "dueDate": "2026-10-20T14:00:00.000Z", "isPaid": false },
              { "number": 2, "amount": 100, "dueDate": "2026-11-20T14:00:00.000Z", "isPaid": false } ] },
  "message": "Préstamo registrado correctamente", "errors": null }
```
- ⟶ guardar `loanId`, `loanInst1Id`, `loanInst2Id`.
- **Verificar egreso:** `GET /expenses/<expenseId>` → `amount: 200`, `sourceType: "LOAN_CREATION"`, `paymentMethod: "CORRIENTE"`. Saldo → **B0 − 200**.

### F10-T2 · Validaciones y transaccionalidad

| Caso | Status | Verificación |
|---|---|---|
| Sin `accountId` | **400** | — |
| `accountId` de otro usuario | **404** | `GET /loans` **no** lista el préstamo y no existe egreso creado (rollback) |
| Cuotas 0 / monto 0 | **400** | — |
| Formato de recordatorio inválido | **400** | — |

### F10-T3 · Pagar cuota → ingreso en cuenta elegida
- **POST** `/loans/{{loanId}}/installments/{{loanInst1Id}}/pay` · Body `{ "accountId": "{{account3Id}}" }` → **200**, `loanStatus: "PARTIAL"`.
- `GET /accounts/{{account3Id}}` → `currentBalance: 100`. El ingreso tiene `sourceType: "LOAN_INSTALLMENT"`.
- Pagar la cuota 2 → `PAID`; `account3Id` → **200**.
- Pago repetido → **400**.

### F10-T4 · Actualizar
- `PATCH` `{ "accountId": "{{account3Id}}" }` → **400**.
- `PATCH` `{ "totalAmount": 300 }` → **400** (ya existe egreso).
- `PATCH` `{ "personName": "María G." }` → **200**.

### F10-T5 · Eliminar
- **DELETE** `/loans/{{loanId}}` → **200**; `GET` → **404**; el egreso `LOAN_CREATION` y los ingresos **se conservan**; BD `isDeleted = true`.

---

## F11 — Deudas

Anota el saldo de `accountId` como **B0**.

### F11-T1 · Crear deuda con recordatorio semanal
- **POST** `{{baseUrl}}/debts` · Bearer
- **Body**
```json
{ "personName": "Pedro Ruiz", "totalAmount": 90, "installmentsCount": 3,
  "reminderEnabled": true, "reminderFrequency": "WEEKLY", "reminderDayOfWeek": 3, "reminderHour": 18 }
```
- **Esperado 201**: cuotas `30 / 30 / 30` con `dueDate`:
  `2026-10-14T23:00:00.000Z`, `2026-10-21T23:00:00.000Z`, `2026-10-28T23:00:00.000Z` (miércoles 18:00 Ecuador).
- ⟶ guardar `debtId`, `debtInst1Id`, `debtInst2Id`, `debtInst3Id`.

### F11-T2 · Deuda con recordatorio anual
- **Body**: `{ "personName":"Banco informal","totalAmount":300,"installmentsCount":3,"reminderEnabled":true,"reminderFrequency":"YEARLY","reminderMonth":8,"reminderDayOfMonth":15,"reminderHour":9 }`
- **Esperado 201**: cuotas `100 / 100 / 100` con `dueDate` `2027-08-15T14:00:00.000Z`, `2028-08-15T14:00:00.000Z`, `2029-08-15T14:00:00.000Z`.

### F11-T3 · Validaciones

| Caso | Status |
|---|---|
| Enviar `description` (no existe en la deuda) | **400** |
| `totalAmount` ≤ 0 | **400** |
| Recordatorio con >1 cuota sin frecuencia | **400** |
| `reminderDayOfWeek: 0` | **400** |
| Cuota única con `reminderAt` con minutos | **400** |

### F11-T4 · Pagar cuota
> Según el supuesto A del plan, el pago genera un **egreso**.

- **POST** `/debts/{{debtId}}/installments/{{debtInst1Id}}/pay` · Body `{ "accountId": "{{accountId}}" }`
- **Esperado 200**
```json
{ "success": true, "statusCode": 200,
  "data": { "installment": { "number": 1, "amount": 30, "isPaid": true, "expenseId": "<uuid>" },
            "debtStatus": "PARTIAL" },
  "message": "Cuota pagada correctamente", "errors": null }
```
Verificaciones:
1. `GET /expenses/<expenseId>` → `sourceType: "DEBT_PAYMENT"`, `amount: 30`.
2. Saldo → **B0 − 30**.
3. Pagar cuotas 2 y 3 → `debtStatus: "PAID"`; saldo **B0 − 90**.
4. Pago repetido → **400**; sin `accountId` → **400**; cuenta ajena → **404**.
5. Recordatorios de cuotas pagadas → `CANCELLED`.

### F11-T5 · Listar / actualizar / eliminar
- **GET** `/debts` → `paidAmount` y `pendingAmount` correctos (`90` / `0` tras pagar todo).
- `PATCH` `{ "totalAmount": 200 }` en una deuda con pagos → **400**; `PATCH` `{ "personName": "Pedro R." }` → **200**.
- **DELETE** `/debts/{{debtId}}` → **200**; `GET` → **404**; BD `isDeleted = true`; egresos generados **se conservan**.
- Con `accessToken2` → **404**.

---

## F12 — Listas de compras

Anota el saldo de `accountId` como **B0**.

### F12-T1 · Crear lista con ítems
- **POST** `{{baseUrl}}/shopping-lists` · Bearer
- **Body**
```json
{ "name": "Compras semana",
  "items": [ { "name": "Leche" }, { "name": "Pan" }, { "name": "Huevos" }, { "name": "Arroz" } ] }
```
- **Esperado 201**
```json
{ "success": true, "statusCode": 201,
  "data": { "name": "Compras semana", "status": "OPEN", "total": null,
            "items": [ { "name": "Leche", "isPurchased": false, "price": null },
                       { "name": "Pan", "isPurchased": false, "price": null },
                       { "name": "Huevos", "isPurchased": false, "price": null },
                       { "name": "Arroz", "isPurchased": false, "price": null } ] },
  "message": "Lista creada correctamente", "errors": null }
```
- ⟶ guardar `listId`, `milkId`, `breadId`, `eggsId`, `riceId`.
- Sin `name` → **400**; ítem con nombre vacío → **400**.

### F12-T2 · Gestión de ítems
| Request | Esperado |
|---|---|
| `POST /shopping-lists/{{listId}}/items` `{"name":"Café"}` | **201**, ⟶ guardar `coffeeId` |
| `PATCH .../items/{{coffeeId}}` `{"name":"Café molido"}` | **200**, nombre actualizado |
| `PATCH .../items/{{coffeeId}}/check` `{"isPurchased":true}` | **200**, `isPurchased: true` |
| `PATCH .../items/{{coffeeId}}/check` `{"isPurchased":false}` | **200**, `isPurchased: false` |
| `DELETE .../items/{{coffeeId}}` | **200**; `GET /shopping-lists/{{listId}}` ya no lo muestra; BD `isDeleted = true` |
| Ítem de otra lista / otro usuario | **404** |

### F12-T3 · Marcar comprados
`PATCH .../items/{{milkId}}/check`, `{{breadId}}` y `{{eggsId}}` con `{ "isPurchased": true }` → **200** cada uno. `Arroz` queda sin marcar.

### F12-T4 · Validaciones del cierre (deben fallar y NO cambiar nada)
**POST** `/shopping-lists/{{listId}}/close`. Después de cada intento, verifica: la lista sigue `OPEN`, saldo = **B0** y no hay egreso nuevo.

| Caso | Body | Status |
|---|---|---|
| Precios **y** total a la vez | `purchasedItems` con `price` **+** `"total": 10` | **400** |
| Sin precios y sin total | `purchasedItems` solo con `id`, sin `total` | **400** |
| Total 0 | `"total": 0` sin precios | **400** |
| Sin `accountId` | — | **400** |
| Cuenta de otro usuario | `accessToken2` | **404** |
| Ítem que no pertenece a la lista | id aleatorio en `purchasedItems` | **400/404** |
| No se cubren todos los ítems | omitir `riceId` en ambas listas | **400** |

### F12-T5 · Cierre con opción A (precios por ítem, `total` calculado en backend)
- **POST** `/shopping-lists/{{listId}}/close`
- **Body** (ajusta los nombres de campo si tu DTO difiere)
```json
{
  "accountId": "{{accountId}}",
  "purchasedItems": [
    { "id": "{{milkId}}",  "price": 1.25 },
    { "id": "{{breadId}}", "price": 2.00 },
    { "id": "{{eggsId}}",  "price": 3.50 }
  ],
  "notPurchasedItems": [ { "id": "{{riceId}}" } ],
  "total": null
}
```
- **Esperado 200**
```json
{ "success": true, "statusCode": 200,
  "data": {
    "closedList": { "name": "Compras semana", "status": "CLOSED", "total": 6.75, "expenseId": "<uuid>",
                    "closedAt": "2026-10-09T...",
                    "items": [ { "name": "Leche", "price": 1.25 }, { "name": "Pan", "price": 2 }, { "name": "Huevos", "price": 3.5 } ] },
    "newList": { "name": "Compras semana", "status": "OPEN", "items": [ { "name": "Arroz", "isPurchased": false } ] } },
  "message": "Lista cerrada correctamente", "errors": null }
```
Verificaciones:
1. `GET /expenses/<expenseId>` → `amount: 6.75`, `sourceType: "SHOPPING_LIST"`, `paymentMethod: "CORRIENTE"`.
2. Saldo → **B0 − 6.75**.
3. `GET /shopping-lists/{{listId}}` → solo **3** ítems (Arroz ya no aparece en la lista cerrada). BD: ese ítem con `isDeleted = true`.
4. `GET /shopping-lists?status=OPEN` → aparece `newList` con **Arroz**. ⟶ guardar `newListId` y `newRiceId`.

### F12-T6 · Lista cerrada es inmutable
| Request sobre `{{listId}}` | Status |
|---|---|
| Cerrar de nuevo | **400** |
| `POST .../items` | **400** |
| `PATCH` (renombrar) | **400** |
| `PATCH .../check` | **400** |

### F12-T7 · Cierre con opción B (solo total)
1. Sobre `{{newListId}}` agrega `Fideos` (⟶ `pastaId`) y `Sal` (⟶ `saltId`); marca como comprados `Arroz` (`{{newRiceId}}`) y `Fideos`.
2. **POST** `/shopping-lists/{{newListId}}/close`
```json
{
  "accountId": "{{accountId}}",
  "purchasedItems": [ { "id": "{{newRiceId}}" }, { "id": "{{pastaId}}" } ],
  "notPurchasedItems": [ { "id": "{{saltId}}" } ],
  "total": 10.00
}
```
3. **Esperado 200**: `closedList.total = 10`, ítems sin `price` (`null`), `newList` con **Sal**.
4. Saldo → **B0 − 6.75 − 10.00**; egreso `SHOPPING_LIST` de **10.00**.

### F12-T8 · Listar, ownership y borrado
- **GET** `/shopping-lists?status=CLOSED` → 2 listas; `?status=OPEN` → 1 lista (la nueva con Sal).
- Con `accessToken2` → listas vacías y detalle **404**.
- **DELETE** `/shopping-lists/<openListId>` → **200**; `GET` → **404**; BD `isDeleted = true` en lista e ítems.

---

## F13 — Hardening transversal

### F13-T1 · Auditoría de borrado lógico (SQL)

Para cada tabla con datos de prueba, verifica que **las filas "borradas" siguen existiendo**:
```sql
SELECT 'accounts' t, count(*) FILTER (WHERE "isDeleted") borradas, count(*) total FROM accounts
UNION ALL SELECT 'incomes', count(*) FILTER (WHERE "isDeleted"), count(*) FROM incomes
UNION ALL SELECT 'credit_cards', count(*) FILTER (WHERE "isDeleted"), count(*) FROM credit_cards
UNION ALL SELECT 'expenses', count(*) FILTER (WHERE "isDeleted"), count(*) FROM expenses
UNION ALL SELECT 'recurring_expense_configs', count(*) FILTER (WHERE "isDeleted"), count(*) FROM recurring_expense_configs
UNION ALL SELECT 'collections', count(*) FILTER (WHERE "isDeleted"), count(*) FROM collections
UNION ALL SELECT 'loans', count(*) FILTER (WHERE "isDeleted"), count(*) FROM loans
UNION ALL SELECT 'debts', count(*) FILTER (WHERE "isDeleted"), count(*) FROM debts
UNION ALL SELECT 'shopping_lists', count(*) FILTER (WHERE "isDeleted"), count(*) FROM shopping_lists;
```
✅ `borradas > 0` en las tablas donde eliminaste algo, y **ninguna** de esas filas aparece en ningún `GET`.

Auditoría de código:
```bash
grep -rnE "\.delete\(|\.remove\(" src/ --include=*.ts   # no debe haber resultados en servicios
```

### F13-T2 · Auditoría de ownership (usuario 2 contra recursos del usuario 1)

Con `Bearer {{accessToken2}}`, **todas** estas operaciones deben responder **404** (o lista vacía en los `GET` de colección):

| Recurso | Requests |
|---|---|
| Cuentas | `GET/PATCH/DELETE /accounts/{{accountId}}` |
| Ingresos | `GET/PATCH/DELETE /incomes/{{incomeId}}` |
| Tarjetas | `GET/PATCH/DELETE /credit-cards/{{cardId}}`, `GET .../report`, `GET .../debt`, `POST .../pay` |
| Egresos | `GET/PATCH/DELETE /expenses/{{expenseId}}`, `PATCH .../amount` |
| Recurrentes | `GET/PATCH/DELETE /recurring-expenses/{{variableRecurringId}}`, `PATCH .../active` |
| Cobros | `GET/PATCH/DELETE /collections/{{collection2Id}}`, `POST .../installments/{{inst1Id}}/pay` |
| Préstamos | `GET/PATCH/DELETE /loans/{{loanId}}`, `POST .../pay` |
| Deudas | `GET/PATCH/DELETE /debts/{{debtId}}`, `POST .../pay` |
| Listas | `GET/PATCH/DELETE /shopping-lists/{{listId}}`, `POST .../items`, `POST .../close` |

### F13-T3 · Nunca se envía `userId`

Para **cada** `POST` y `PATCH` de la guía, agrega `"userId": "<cualquier uuid>"` al body → debe responder **400** (propiedad no permitida). El `userId` solo sale del JWT.

### F13-T4 · Todo requiere autenticación por defecto

Quita el Authorization de la colección y ejecuta **todos** los requests. Solo estos pueden responder distinto de **401**:

| Público (`@IsPublic`) | |
|---|---|
| `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` | |

### F13-T5 · Formato de respuesta en toda la API

Con el script de la sección 0.3 en la colección, ejecuta el **Collection Runner** completo. ✅ Ningún test de "Formato de respuesta estándar" debe fallar (incluyendo 400, 401, 404, 409, 423, 429).
Prueba adicional de error interno: apaga Redis y llama `GET /users/me` → debe devolver **500** (o 503) con `success:false`, `errors` no vacío y **sin stack trace** en el body.

### F13-T6 · Precisión de dinero
- Crea un egreso con `amount: 0.10` y otro con `0.20` y verifica que el saldo baje exactamente `0.30` (sin `0.30000000000000004`).
- Diferido de `100` en `3` cuotas suma exactamente `100.00` (33.33 + 33.33 + 33.34).

### F13-T7 · Zona horaria por usuario
- `PATCH /users/me` `{ "timezone": "America/Bogota" }` (UTC−5, igual que Ecuador) y luego `{ "timezone": "America/Mexico_City" }` (UTC−6).
- Crea una tarjeta con recordatorio con cada zona y verifica que `scheduledAt` cambie en 1 hora (las 09:00 locales equivalen a `14:00Z` y `15:00Z` respectivamente).

---

## Checklist final de aceptación

| Feature | Criterio principal | ✔ |
|---|---|---|
| F00 | Respuestas con formato único; app no arranca con `.env` inválido | ☐ |
| F01 | Login/refresh/logout correctos; bloqueos de cuenta (5/7/8/9+) e IP (20 en 5 min); rate limit configurable | ☐ |
| F02 | CRUD de cuentas; saldo calculado; borrado lógico; ownership | ☐ |
| F03 | Dispositivos FCM; recordatorios enviados por cron una sola vez | ☐ |
| F04 | Ingresos suman al saldo; ingresos automáticos protegidos | ☐ |
| F05 | Tarjetas con campos opcionales; recordatorio programado/cancelado | ☐ |
| F06 | Corriente descuenta; diferido genera cuotas (gracia, corte, redondeo) | ☐ |
| F07 | Reportes correctos; pago genera egreso y marca cuotas | ☐ |
| F08 | Recurrentes generan egresos idempotentes; monto variable; activar/desactivar | ☐ |
| F09 | Cobros con cuotas; pago crea ingreso | ☐ |
| F10 | Préstamo crea egreso; pago de cuota crea ingreso | ☐ |
| F11 | Deudas con cuotas; pago crea egreso (supuesto A) | ☐ |
| F12 | Cierre con XOR precios/total; lista nueva con no comprados; egreso | ☐ |
| F13 | Soft delete, ownership, sin `userId` en body, formato global | ☐ |