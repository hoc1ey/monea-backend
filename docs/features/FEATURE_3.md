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
