
## F09 — Cobros

**Objetivo:** registrar dinero que otras personas deben al usuario, dividido en cuotas con recordatorios; al pagar una cuota se crea un ingreso en la cuenta elegida.

- **Rama:** `feature/09-collections`

### Pasos

1. `nest g resource collections --no-spec`.
2. Crear en `common/` un **generador de plan de cuotas con recordatorio** reutilizable por Cobros, Préstamos y Deudas (`InstallmentScheduleBuilder`): recibe `totalAmount`, `installments`, configuración de recordatorio y fecha base; devuelve `[{ number, amount, dueDate }]`.
3. Entidades `Collection` y `CollectionInstallment`.
4. DTO con validación condicional:
   - `installments > 1` → recordatorio recurrente (`WEEKLY` con `dayOfWeek` / `MONTHLY` con `dayOfMonth` / `YEARLY` con `monthOfYear` y `dayOfMonth?`) + `reminderHour`.
   - `installments = 1` → `reminderAt` (fecha y hora; solo hora, minutos = 0).
5. Pago de cuota en transacción con `IncomesService.createFromSource`.

### Entidades y relaciones

**`Collection`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `personName` | varchar(80) |
| `totalAmount` | numeric(14,2) |
| `installmentsCount` | smallint ≥ 1 |
| `description` | varchar(255), nullable |
| `reminderEnabled` | boolean |
| `reminderFrequency` | enum `WEEKLY \| MONTHLY \| YEARLY`, nullable |
| `reminderDayOfWeek` / `reminderDayOfMonth` / `reminderMonth` | smallint, nullable |
| `reminderAt` | timestamptz, nullable (cuota única) |
| `reminderHour` | smallint, nullable |
| `status` | enum `PENDING \| PARTIAL \| PAID` |

**`CollectionInstallment`**

| Campo | Tipo |
|---|---|
| `collectionId` | FK → Collection (`ManyToOne`) |
| `userId` | FK → User |
| `number` | smallint |
| `amount` | numeric(14,2) |
| `dueDate` | timestamptz, nullable |
| `isPaid` | boolean |
| `paidAt` | timestamptz, nullable |
| `incomeId` | FK → Income, nullable |

Relaciones: `Collection 1 ─── N CollectionInstallment`; `CollectionInstallment 0..1 ─── 1 Income`.

### Endpoints

`POST /collections` · `GET /collections` (filtro `status`) · `GET /collections/:id` · `PATCH /collections/:id` · `DELETE /collections/:id` · `POST /collections/:id/installments/:installmentId/pay`

### Métodos del servicio

- `create(userId, dto)`: crea cobro, genera cuotas (último = residuo), programa un recordatorio por cuota pendiente.
- `findAll(userId, query)`: incluye `paidAmount` y `pendingAmount`.
- `findOne(userId, id)`: con cuotas.
- `update(userId, id, dto)`: si hay cuotas pagadas, solo se permite cambiar `personName`, `description` y recordatorio (regenera `dueDate` de las pendientes). Si no hay pagadas, permite cambiar monto y cuotas (regenera el plan).
- `remove(userId, id)`: borrado lógico + cancelar recordatorios; los ingresos ya creados se conservan.
- `payInstallment(userId, collectionId, installmentId, { accountId, name?, description? })`: en transacción — valida cuota no pagada, crea `Income` (`sourceType=COLLECTION_INSTALLMENT`, `sourceId=installmentId`) en la cuenta indicada, marca `isPaid/paidAt/incomeId`, cancela su recordatorio, recalcula `status` (`PARTIAL` / `PAID`).
- `recalculateStatus(collection)`: método interno.

### Dependencias

No requiere nuevas.

### Commits

```
feat(common): constructor reutilizable de plan de cuotas con recordatorios
feat(collections): entidades Collection y CollectionInstallment con DTO condicional
feat(collections): CRUD de cobros con generacion de cuotas y recordatorios
feat(collections): pago de cuota con creacion transaccional de ingreso
```

---
