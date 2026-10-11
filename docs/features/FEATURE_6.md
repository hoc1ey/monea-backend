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
