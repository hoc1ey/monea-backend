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
