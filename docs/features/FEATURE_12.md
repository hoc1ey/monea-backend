## F12 — Listas de compras

**Objetivo:** gestionar listas de compra con ítems chequeables y cerrarlas generando un egreso, trasladando lo no comprado a una nueva lista.

- **Rama:** `feature/12-shopping-lists`

### Pasos

1. `nest g resource shopping-lists --no-spec`.
2. Entidades `ShoppingList` y `ShoppingListItem`.
3. DTO de cierre con validación **excluyente (XOR)** mediante validador personalizado:
   - Opción A: cada ítem comprado trae `price` y `total` es `null`/ausente → total calculado en backend.
   - Opción B: se envía `total` y **ningún** ítem trae `price`.
   - Ambas o ninguna → `BadRequestException`.
4. El cierre se ejecuta en **transacción**.

### Entidades y relaciones

**`ShoppingList`**

| Campo | Tipo |
|---|---|
| `userId` | FK → User |
| `name` | varchar(80) |
| `status` | enum `OPEN \| CLOSED` |
| `closedAt` | timestamptz, nullable |
| `total` | numeric(14,2), nullable |
| `accountId` | FK → Account, nullable (se llena al cerrar) |
| `expenseId` | FK → Expense, nullable |

**`ShoppingListItem`**

| Campo | Tipo |
|---|---|
| `listId` | FK → ShoppingList (`ManyToOne`) |
| `userId` | FK → User |
| `name` | varchar(120) |
| `isPurchased` | boolean, default false |
| `price` | numeric(14,2), nullable |

Relaciones: `ShoppingList 1 ─── N ShoppingListItem`; `ShoppingList 0..1 ─── 1 Expense`.

### Endpoints

`POST /shopping-lists` · `GET /shopping-lists` (filtro `status`) · `GET /shopping-lists/:id` · `PATCH /shopping-lists/:id` · `DELETE /shopping-lists/:id` · `POST /shopping-lists/:id/items` · `PATCH /shopping-lists/:id/items/:itemId` · `PATCH /shopping-lists/:id/items/:itemId/check` · `DELETE /shopping-lists/:id/items/:itemId` · `POST /shopping-lists/:id/close`

### Métodos del servicio

- `create(userId, dto)`: crea lista `OPEN` con ítems iniciales opcionales.
- `findAll(userId, query)` / `findOne(userId, id)`: con ítems activos.
- `update(userId, id, dto)`: renombrar; solo listas `OPEN`.
- `remove(userId, id)`: borrado lógico de la lista y sus ítems.
- `addItem(userId, listId, dto)` / `updateItem(...)` / `removeItem(...)`: solo en listas `OPEN`.
- `toggleItemCheck(userId, listId, itemId, isPurchased)`: marca/desmarca comprado.
- `close(userId, listId, dto)`: en transacción —
  1. Valida lista `OPEN` y que los ítems enviados (`purchased` y `notPurchased`) pertenezcan a ella y cubran todos sus ítems.
  2. Valida el XOR de precios/total y calcula `total` (suma de precios) si aplica; el total debe ser > 0.
  3. Valida ownership de `accountId`.
  4. Marca ítems comprados (con su `price` si aplica).
  5. **Elimina de la lista cerrada los ítems no comprados** (`isDeleted = true`) y los **crea como ítems nuevos** en una **nueva lista `OPEN`** (mismo nombre).
  6. Crea el egreso corriente por el total (`sourceType=SHOPPING_LIST`) y guarda `expenseId`, `total`, `closedAt`, `status = CLOSED`.
  7. Devuelve la lista cerrada y el `id` de la nueva lista.
- Una lista `CLOSED` es **inmutable**.

### Dependencias

No requiere nuevas.

### Commits

```
feat(shopping-lists): entidades ShoppingList y ShoppingListItem con CRUD de items
feat(shopping-lists): check de items y validacion de listas abiertas
feat(shopping-lists): cierre de lista con validacion XOR de precios/total y egreso asociado
feat(shopping-lists): crear nueva lista automatica con items no comprados
```

---
