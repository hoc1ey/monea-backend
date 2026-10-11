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
