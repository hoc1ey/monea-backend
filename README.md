<div align="center">

<img src="public/logo.png" alt="Monea" width="140" />

# Monea — Backend

**API REST de finanzas personales construida con NestJS 12, TypeORM y PostgreSQL.**

[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

</div>

## ¿Qué es Monea?

Monea es una API de **gestión de finanzas personales** que permite llevar el control completo del dinero: cuentas bancarias con saldo calculado en tiempo real, ingresos y egresos (instantáneos o en cuotas), tarjetas de crédito, préstamos, cobros, deudas, transferencias entre cuentas, egresos recurrentes automáticos y listas de compras.

Todo el sistema está diseñado alrededor de tres ideas:

- **Movimientos trazables**: cada operación (cuota pagada, pago de tarjeta, cierre de lista de compras, transferencia) genera automáticamente el ingreso o egreso correspondiente, de modo que el saldo de las cuentas siempre refleja la realidad.
- **Recordatorios proactivos**: un scheduler central genera recordatorios (push vía FCM) para cuotas, pagos de tarjeta y egresos recurrentes, respetando la **zona horaria** de cada usuario.
- **Seguridad por diseño**: autenticación JWT con access tokens en Redis y refresh tokens persistentes, rate limiting escalonado, bloqueo progresivo de cuentas por intentos fallidos y borrado lógico en todas las entidades.

## Funcionalidades

| Módulo | Descripción |
|---|---|
| **Autenticación** | Registro con verificación por correo, login, access/refresh tokens, logout y bloqueo progresivo de cuentas |
| **Usuarios** | Perfil y zona horaria por usuario (IANA) |
| **Cuentas** | Cuentas bancarias con saldo calculado a partir de los movimientos |
| **Ingresos / Egresos** | Registro manual o automático; egresos corrientes o diferidos con plan de cuotas y meses de gracia |
| **Tarjetas de crédito** | Fechas de corte/pago, cálculo de deuda por mes y pago de tarjeta con recordatorios |
| **Egresos recurrentes** | Programación semanal/mensual/anual con monto fijo o variable; generación automática con idempotencia |
| **Cobros y préstamos** | Cuotas con recordatorio individual; los préstamos generan el egreso al crearlos y un ingreso por cuota pagada |
| **Deudas** | Seguimiento de deudas en cuotas; el pago genera el egreso correspondiente |
| **Transferencias** | Movimiento de dinero entre cuentas propias con egreso e ingreso automáticos |
| **Listas de compras** | Ítems chequeables; al cerrar generan un egreso y trasladan lo no comprado a una nueva lista |
| **Notificaciones** | Push (FCM) + recordatorios por cuota, con correos transaccionales vía SMTP |

## Stack técnico

- **NestJS 12** con arquitectura modular por feature
- **TypeORM** + **PostgreSQL** (esquema sincronizado, sin migraciones manuales)
- **Redis** — sesiones de refresh token, rate limiting y locks de schedulers
- **TypeScript** en modo **ESM** estricto
- **Zod** — validación de variables de entorno al arranque
- **decimal.js** — aritmética monetaria exacta (nunca floats)
- **Vitest** — pruebas unitarias y e2e
- **Swagger** — documentación automática de la API
- **Passport + JWT, Argon2, Nodemailer, Firebase Admin, Handlebars, Helmet**

## Decisiones de arquitectura destacadas

- **Contrato de respuesta uniforme**: toda respuesta respeta la forma `{ success, statusCode, data, message, errors }` mediante un interceptor y un filtro de excepciones globales.
- **Borrado lógico en todo el sistema**: ninguna entidad se elimina físicamente; todas extienden una base con `isDeleted` / `deletedAt` y las consultas filtran automáticamente.
- **Seguridad por defecto**: el guard JWT es global; las rutas públicas se declaran explícitamente. El `userId` nunca se acepta del cliente: siempre se lee del token y se filtran las consultas por propietario.
- **Dinero exacto**: columnas `numeric(14,2)` con transformador decimal y cálculos con `decimal.js`.
- **Fechas en UTC**: todo se almacena en `timestamptz` y se convierte a la zona horaria del usuario para recordatorios y recurrencias.
- **Schedulers distribuidos**: los jobs de recordatorios y recurrencias usan locks en Redis (`SET ... NX EX`) para no duplicar trabajo entre instancias.
- **Idempotencia de recurrencias**: índice único `(recurringConfigId, occurrenceDate)` evita generar dos veces el mismo egreso programado.
- **Env estricto**: si falta una variable de entorno o tiene formato inválido, la aplicación no arranca.

## Primeros pasos

### Requisitos

- Node.js 20+
- pnpm
- PostgreSQL
- Redis

### Instalación

```bash
git clone https://github.com/hoc1ey/monea-backend.git
cd monea-backend
pnpm install
```

### Configuración

Copia `.env.example` a `.env` y completa los valores. Las variables se validan con **Zod** al arrancar: si falta una o tiene formato inválido, la aplicación no arranca.

```bash
cp .env.example .env
```

<details>
<summary><strong>Variables de entorno</strong></summary>

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

</details>

### Ejecución

```bash
# desarrollo (watch)
pnpm run start:dev

# producción
pnpm run build && pnpm run start:prod
```

## Documentación de la API

Con el servidor corriendo, Swagger está disponible en `http://localhost:PORT/api/docs`. Todas las rutas están documentadas y las públicas se marcan con `@IsPublic()`. El prefijo global es `api/v1`, salvo `/health`.

## Pruebas

```bash
# pruebas unitarias (vitest)
pnpm run test

# pruebas e2e (requieren Postgres + Redis reales y .env válido)
pnpm run test:e2e

# cobertura
pnpm run test:cov

# lint (oxlint, type-aware)
pnpm run lint
```

## Estructura del proyecto

```
src/
├── accounts/          # Cuentas bancarias y saldo calculado
├── auth/              # Registro, login, tokens y bloqueo de cuentas
├── collections/       # Cobros en cuotas con recordatorios
├── common/            # Entidad base, guards, interceptores y utilidades (dinero, fechas, recurrencias)
├── config/            # Carga y validación Zod de variables de entorno
├── credit-cards/      # Tarjetas de crédito y pagos de corte
├── debts/             # Deudas en cuotas
├── expenses/          # Egresos instantáneos y diferidos
├── health/            # Health check
├── incomes/           # Ingresos
├── loans/             # Préstamos
├── mail/              # Correos transaccionales (SMTP + Handlebars)
├── notifications/     # Push FCM y dispositivos
├── recurring-expenses/# Egresos programados con scheduler e idempotencia
├── shopping-lists/    # Listas de compras
├── transfers/         # Transferencias entre cuentas
└── users/             # Perfil de usuario
```

Los detalles de diseño de cada feature viven en `docs/features/`, las convenciones globales en `docs/general/` y las pruebas de aceptación en `docs/pruebas/`.

## Licencia

Este proyecto está bajo la [Licencia MIT](./LICENSE).
