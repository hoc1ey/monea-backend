## F07 — Reportes y pago de tarjetas de crédito

**Objetivo:** calcular cuánto se debe de una tarjeta (mes actual, anteriores o posteriores) y marcar el mes como pagado generando un egreso.

- **Rama:** `feature/07-credit-card-reports-payments`

### Pasos

1. Agregar al módulo `credit-cards` la entidad `CreditCardPayment` y los métodos de reporte/pago (dependen de `ExpensesService`).
2. Resolver la dependencia circular `CreditCardsModule ⇄ ExpensesModule` con `forwardRef` o, preferible, creando un servicio `CreditCardBillingService` dentro de `credit-cards` que solo lee `ExpenseInstallment` vía repositorio.
3. `markPeriodAsPaid` se ejecuta en **transacción**: crea el egreso, marca cuotas y registra el pago.

### Entidades y relaciones

**`CreditCardPayment`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `creditCardId` | FK → CreditCard |
| `accountId` | FK → Account (de dónde sale el dinero) |
| `expenseId` | FK → Expense (egreso generado) |
| `period` | char(7) `YYYY-MM` |
| `amount` | numeric(14,2) |
| `paidAt` | timestamptz |

Restricción única: `(creditCardId, period)` entre registros con `isDeleted=false`.
Relaciones: `CreditCard 1 ─── N CreditCardPayment`; `CreditCardPayment 1 ─── N ExpenseInstallment` (las cuotas pagadas apuntan al pago).

### Endpoints

`GET /credit-cards/:id/report?period=YYYY-MM` · `GET /credit-cards/:id/report/range?from=YYYY-MM&to=YYYY-MM` · `GET /credit-cards/:id/debt` · `POST /credit-cards/:id/pay`

### Métodos del servicio

- `getMonthlyReport(userId, cardId, period)`: devuelve `{ period, total, paid, paidAt, items[] }` donde cada item es una cuota (compra, nº de cuota `n/N`, monto), más `cutoffDate` y `paymentDate` del periodo. Usa solo información disponible hasta el momento.
- `getRangeReport(userId, cardId, from, to)`: resumen mes a mes (pasados y futuros); limitar el rango a 24 meses.
- `getCurrentDebt(userId, cardId)`: Σ cuotas **no pagadas** con `period ≤ periodo actual` (deuda exigible hoy), más `upcoming` = Σ cuotas futuras, y `availableCredit` si hay `creditLimit` (`cupo − deuda total pendiente`).
- `markPeriodAsPaid(userId, cardId, { accountId, period? })`:
  1. `period` por defecto = mes actual; **no se permiten periodos futuros**.
  2. Valida que no exista pago del periodo y que el total sea > 0.
  3. Crea un `Expense` `CORRIENTE` (`sourceType=CARD_PAYMENT`, `sourceId=paymentId`) en la cuenta indicada por el monto total del periodo.
  4. Crea `CreditCardPayment`, marca las cuotas del periodo `isPaid = true` y asigna `cardPaymentId`.
  5. Cancela el recordatorio del mes y programa el siguiente.
- `getPeriodInstallments(cardId, period)`: consulta interna reutilizable.

### Dependencias

No requiere nuevas.

### Commits

```
feat(credit-cards): reporte mensual y por rango de deuda de tarjeta
feat(credit-cards): calculo de deuda actual y cupo disponible
feat(credit-cards): marcar periodo como pagado generando egreso transaccional
```

---
