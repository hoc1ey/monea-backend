## F04 — Ingresos

**Objetivo:** registrar ingresos ligados a una cuenta, con soporte para ingresos generados automáticamente por otros módulos.

- **Rama:** `feature/04-incomes`

### Pasos

1. `nest g resource incomes --no-spec`.
2. Entidad + DTOs. El `userId` nunca viene en el body.
3. Implementar `createFromSource` aceptando un `EntityManager` opcional para participar en **transacciones** de otros módulos.
4. Actualizar `AccountsService.getBalance` para sumar ingresos.

### Entidades y relaciones

**`Income`**

| Campo | Tipo | Obligatorio |
|---|---|---|
| `userId` | FK → User | sí |
| `accountId` | FK → Account (`ManyToOne`) | sí |
| `name` | varchar(80) | sí |
| `amount` | numeric(14,2) > 0 | sí |
| `description` | varchar(255) | no |
| `date` | timestamptz (default now) | sí |
| `sourceType` | enum `MANUAL \| COLLECTION_INSTALLMENT \| LOAN_INSTALLMENT` | sí (default `MANUAL`) |
| `sourceId` | uuid, nullable | no |

Relaciones: `Account 1 ─── N Income`; `User 1 ─── N Income`.

### Endpoints

`POST /incomes` · `GET /incomes` (filtros: `accountId`, `from`, `to`, paginación) · `GET /incomes/:id` · `PATCH /incomes/:id` · `DELETE /incomes/:id`

### Métodos del servicio

- `create(userId, dto)`: valida ownership de la cuenta, crea con `sourceType=MANUAL`.
- `createFromSource(userId, { accountId, name, amount, description, sourceType, sourceId }, manager?)`: uso interno de Cobros/Préstamos.
- `findAll(userId, query)`: paginado, ordenado por `date DESC`.
- `findOne(userId, id)`.
- `update(userId, id, dto)`: permite cambiar nombre, cuenta, monto, descripción. Si `sourceType !== MANUAL` → solo `name` y `description` (el monto lo gobierna el módulo de origen).
- `remove(userId, id)`: borrado lógico; si es de origen automático → `BadRequestException` (se revierte desde su módulo de origen).

### Dependencias

No requiere nuevas.

### Commits

```
feat(incomes): entidad Income y DTOs con validacion de monto
feat(incomes): CRUD de ingresos con filtros y paginacion
feat(incomes): createFromSource transaccional para modulos de cobros y prestamos
```

---
