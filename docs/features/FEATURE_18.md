# Feature 18 — Reportes (resúmenes mensuales y balance histórico)

Módulo `reports/`: endpoints de solo lectura sobre `incomes` / `expenses` / `accounts`.
No crea movimientos; no tiene entidades ni DTOs de escritura.

## Endpoints (todos GET, Bearer obligatorio, `userId` del JWT)

| Ruta | Descripción |
|---|---|
| `GET /reports/monthly-summary` | Sumatoria de ingresos y egresos del mes actual (por separado) + `net`. Query opcional: `accountId` |
| `GET /reports/monthly-history` | Sumatoria mensual de ingresos y egresos del mes actual + 4 meses anteriores (5 ítems, del más antiguo al más reciente) |
| `GET /reports/balance-history` | Balance general de la(s) cuenta(s) al cierre del mes actual + 4 meses anteriores |

### Contrato

- Respuesta estándar `{ data, message }`; el interceptor agrega `success`/`statusCode`.
- `period` es `YYYY-MM` calculado en **UTC** (`DateUtil.formatPeriod`).
- `monthly-summary` / `monthly-history` → `data: { period?, items? }` con
  `{ period, totalIncomes, totalExpenses, net }`. Los egresos suman **todos** los
  métodos de pago (CORRIENTE + DIFERIDO): es gasto, no afectación de saldo.
- `balance-history` → `data: { items: [{ period, balance }] }`. `balance` replica
  `AccountsService.calculateAccountBalance` por mes: Σ `initialBalance` (cuentas activas)
  + Σ ingresos − Σ egresos **CORRIENTE**, acumulados hasta el cierre de cada mes.
  Los egresos diferidos no descuentan hasta que se paga la tarjeta (F07).
- Meses sin movimientos se reportan con montos en 0 (nunca se omiten periodos).
- `accountId` opcional (UUID): si se envía, valida ownership con
  `AccountsService.assertOwnership` (404 si no es del usuario, nunca 403) y filtra;
  si se omite, agrega todas las cuentas activas del usuario.

## Implementación

- Consultas SQL crudas con `to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM')` y
  `COALESCE(SUM(amount), 0)`; todo filtro excluye `isDeleted = true`.
- Cálculos monetarios con `MoneyUtil` (decimal.js), nunca floats.
- Sin paginación (ventana fija de 5 meses).
- Registrado en `app.module.ts` como `ReportsModule`.

## Commits sugeridos

```
feat(reports): resumen mensual, historial de ingresos/egresos y balance histórico
docs(reports): spec F18 y pruebas de aceptación
```
