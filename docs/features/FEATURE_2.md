## F02 — Cuentas bancarias

**Objetivo:** permitir registrar y consultar cuentas bancarias con su saldo calculado a partir de movimientos.

- **Rama:** `feature/02-bank-accounts`

### Pasos

1. `nest g resource accounts --no-spec` (REST API, con CRUD).
2. Crear entidad y DTOs (`CreateAccountDto`, `UpdateAccountDto` con `PartialType`).
3. Validar `color` como hex (`#RRGGBB`), `initialBalance` con 2 decimales máx.
4. Exponer el método `getBalance(accountId, userId)` para que otros módulos lo reutilicen (se completa en F04/F06).
5. Controller usa `@CurrentUser('id')` en todos los endpoints.

### Entidades y relaciones

**`Account`**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `userId` | FK → User (`ManyToOne`) | sí |
| `name` (alias) | varchar(60) | sí |
| `financialInstitution` | varchar(80) | sí |
| `color` | varchar(7) | sí |
| `initialBalance` | numeric(14,2) | sí |
| `description` | varchar(255), nullable | no |

Relaciones: `User 1 ─── N Account`; `Account 1 ─── N Income`; `Account 1 ─── N Expense` (se agregan en sus features).

### Endpoints

`POST /accounts` · `GET /accounts` · `GET /accounts/:id` · `PATCH /accounts/:id` · `DELETE /accounts/:id` (borrado lógico)

### Métodos del servicio

- `create(userId, dto)`: crea la cuenta. Mensaje: "Cuenta creada correctamente".
- `findAll(userId)`: lista cuentas activas con `currentBalance` calculado (1 query agregada, no N+1).
- `findOne(userId, id)`: devuelve la cuenta + `currentBalance`; `NotFoundException` si no es del usuario o está borrada.
- `update(userId, id, dto)`: actualiza alias, entidad, color, descripción. `initialBalance` **sí editable**, pero registrar en el mensaje que modifica el saldo calculado.
- `remove(userId, id)`: marca `isDeleted = true`. Los ingresos/egresos históricos **se conservan** y no se traen en consultas de cuenta borrada.
- `getBalance(accountId, userId)`:
  `initialBalance + Σ ingresos (isDeleted=false) − Σ egresos con paymentMethod=CORRIENTE (isDeleted=false)`.
  Los egresos **diferidos no descuentan** de la cuenta hasta que se paga la tarjeta (F07, que genera un egreso corriente).
- `assertOwnership(userId, accountId)`: método reutilizable por Income/Expense/Loan/etc.

### Dependencias

No requiere nuevas (usa las de F00).

### Commits

```
feat(accounts): crear entidad Account y DTOs de validacion
feat(accounts): CRUD de cuentas con borrado logico y ownership por JWT
feat(accounts): calcular saldo actual a partir de movimientos
```

---
