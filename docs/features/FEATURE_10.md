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
