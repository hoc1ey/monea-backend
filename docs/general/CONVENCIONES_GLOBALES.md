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