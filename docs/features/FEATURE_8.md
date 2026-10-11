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
