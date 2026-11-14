## F14 — Transferencias

**Objetivo:** mover dinero entre dos cuentas del usuario generando automáticamente el egreso en la cuenta origen y el ingreso en la cuenta destino.

- **Rama:** `feature/14-transfers`

### Pasos

1. Añadir `TRANSFER` a `ExpenseSourceType` (`src/expenses/expenses.constants.ts`) y a `IncomeSourceType` (`src/incomes/incomes.constants.ts`).
2. Entidad `Transfer` (`src/transfers/entities/transfer.entity.ts`): `userId`, `sourceAccountId`, `destinationAccountId`, `amount` (`numeric(14,2)` + `decimalTransformer`), `description` (motivo, nullable), `date`, `expenseId` (nullable), `incomeId` (nullable).
3. Servicio: `create` valida cuentas distintas y `assertOwnership` de ambas; en una transacción guarda la `Transfer`, crea el egreso vía `ExpensesService.createInternal` y el ingreso vía `IncomesService.createFromSource` (ambos con `sourceId = transfer.id` y `manager` compartido).
4. `remove`: borrado lógico de la transferencia + de su egreso e ingreso asociados (misma transacción), para que ambas cuentas recuperen el saldo.
5. Los movimientos generados no se pueden editar ni eliminar desde `incomes`/`expenses` (protección por `sourceType !== MANUAL` ya existente).

### Nombres de los movimientos

- **Egreso** (cuenta origen): `Transferencia a {nombre_cuenta_destino}`, `paymentMethod = CORRIENTE`, `sourceType = TRANSFER`, `sourceId = transfer.id`.
- **Ingreso** (cuenta destino): `Transferencia desde {nombre_cuenta_origen}`, `sourceType = TRANSFER`, `sourceId = transfer.id`.
- El `description` (motivo) se replica en la `Transfer` y en ambos movimientos.

### Endpoints

`POST /transfers` · `GET /transfers` (filtros: `accountId` —matchea origen **o** destino—, `from`, `to`, paginación) · `GET /transfers/:id` · `DELETE /transfers/:id`

### Notas

- `Account` no tiene moneda; no se valida divisa entre cuentas.
- Los balances (`AccountsService.calculateAccountBalance` y `findAll`) no requieren cambios: la transferencia usa las tablas `incomes`/`expenses` existentes (el egreso es `CORRIENTE`, el ingreso suma).
- Al añadir los enums de TypeORM (`type: 'enum'`), `DB_SYNCHRONIZE=true` ejecuta `ALTER TYPE ... ADD VALUE` en el arranque.

### Dependencias

No requiere nuevas.

### Commits

```
feat(transfers): entidad Transfer con egreso e ingreso automaticos
feat(transfers): endpoints de transferencias con nombres de movimientos segun convencion
feat(transfers): borrado logico de transferencia con reversion de movimientos
```

---
