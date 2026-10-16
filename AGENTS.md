# AGENTS.md

Monea backend: NestJS 12 + TypeORM + PostgreSQL, ESM, feature-by-feature build.
Feature specs live in `docs/features/FEATURE_N.md`; global rules in
`docs/general/CONVENCIONES_GLOBALES.md`; manual/Postman acceptance tests in
`docs/pruebas/PRUEBAS_FEATURES.md` (detailed and the de-facto response contract).

## Commands
- Install: `pnpm install`
- Build / typecheck: `pnpm run build` (there is no separate typecheck script)
- Lint: `pnpm run lint` (oxlint, type-aware; repo has pre-existing warnings)
- Unit tests: `pnpm run test` (vitest). Single file: `pnpm exec vitest run src/common/utils/money.util.spec.ts`
- E2E: `pnpm run test:e2e` (boots the full `AppModule`; needs a real Postgres + Redis and a valid `.env`)
- Dev server: `pnpm run start:dev`

## Non-obvious rules (enforced by the codebase/docs)
- ESM + `moduleResolution: nodenext`: every relative import in `src`/`test` MUST end in `.js`, even for `.ts` sources. A missing extension fails the build.
- No migrations. TypeORM uses `autoLoadEntities` + `synchronize` gated by `DB_SYNCHRONIZE` (Zod-validated). Never add a `migrations/` folder.
- Nothing is hard-deleted. Entities extend `common/entities/base.entity.ts` (`isDeleted`, `deletedAt`); every query filters `isDeleted: false`; "delete" only flips flags.
- Ownership/security: never accept `userId` in a request body. Read it from the JWT via `@CurrentUser('id')` and filter all queries by it; resources not owned by the user return `NotFoundException` (404, never 403).
- Auth is global (`JwtAuthGuard` via `APP_GUARD`); mark open routes with `@IsPublic()`.
- Responses: service methods return `{ data, message }`; the global interceptor/filter add `success`/`statusCode`/`errors`. Throw Nest exceptions instead of shaping error envelopes.
- Money: `numeric(14,2)` columns + `decimalTransformer`; compute with `decimal.js` through `common/utils/money.util.ts`, never floats.
- Dates: stored UTC in `timestamptz`; convert for reminders/recurrences with `User.timezone` and `common/utils/date.util.ts`.
- Env is Zod-validated at boot (`config/env.schema.ts`): a missing/invalid var prevents startup.
- New modules are direct children of `src/` and must be registered in `app.module.ts`. Module/entity/DTO layout mirrors `incomes/` and `credit-cards/`.
- Schedulers run only when `SCHEDULER_ENABLED=true` and take a Redis `SET ... NX EX` lock (keys `lock:reminders`, every minute; `lock:recurring-expenses`, every hour). Acceptance tests force work with SQL (e.g. `nextRunAt = now() - interval '1 minute'`) and wait for a cycle.
- Recurrences go through `common/utils/recurrence.util.ts`. `RecurringExpenseConfig.nextRunAt` stores the UTC instant of the occurrence's local midnight (`User.timezone`). `create` derives it from `startDate`; `update`/reactivate recompute from today (no backfill).
- Installment plans for Cobros/Préstamos/Deudas go through `common/utils/installment-schedule.builder.ts` (`InstallmentScheduleBuilder.build`), which returns `{ number, amount, dueDate }` (last installment absorbs the rounding residue; `dueDate` is the UTC instant at the reminder hour in `User.timezone`, or `null` when reminders are off). Collection reminders are one row per installment with `sourceId = installmentId` (`ReminderType.COLLECTION`), so cancel/reschedule them individually; the collection reminder fields live on `Collection`, not the installment.
- `loans/` mirrors `collections/` (`loans` + `loan_installments`, same DTO/reminder logic, `ReminderType.LOAN`), but `create` also emits a `CORRIENTE` expense (`ExpenseSourceType.LOAN_CREATION`, `sourceId = loan.id`) inside the same transaction; each paid installment creates an income (`IncomeSourceType.LOAN_INSTALLMENT`). `accountId`/`totalAmount` are immutable after create (the expense already exists); only `personName`/`description`/reminder always, and `installmentsCount` when nothing is paid.
- `debts/` mirrors `collections/` (`debts` + `debt_installments`, `ReminderType.DEBT`) but has no `description` and no `accountId`: `create` generates no movement. Only `payInstallment` creates a `CORRIENTE` expense (`ExpenseSourceType.DEBT_PAYMENT`, `sourceId = installment.id`) and stores it in `DebtInstallment.expenseId`; the pay response exposes `expenseId`, not `incomeId`. Like collections, `totalAmount`/`installmentsCount` are editable only while nothing is paid.
- `shopping-lists/` has no reminders: `ShoppingList` (`OPEN|CLOSED`) + `ShoppingListItem`. Items can only be created/edited/checked/deleted while `OPEN`; a `CLOSED` list is immutable. `close` runs in a transaction and: requires `purchasedItems` + `notPurchasedItems` to cover every active item, enforces the XOR rule (every purchased item brings `price` **or** a `total`, never both; total > 0), creates the `CORRIENTE` expense (`ExpenseSourceType.SHOPPING_LIST`, `sourceId = list.id`), soft-deletes the not-purchased items and recreates them in a new `OPEN` list with the same name; the response is `{ closedList, newList }`.

## Gotchas
- class-validator `@ValidateIf` conditions on the same property are combined with AND, so do not stack mutually exclusive conditions. Put the "required when X" rule in the DTO and enforce the "forbidden when not X" rule in the service.
- `AccountsService.calculateAccountBalance` (and its `findAll` subqueries) use raw SQL plus `to_regclass` checks to tolerate tables that do not exist yet. It sums `incomes` and subtracts `expenses WHERE "paymentMethod" = 'CORRIENTE'`. When you add a new movement source, update both places.
- TypeORM relations must stay inside `() => Entity` callbacks; entities reference each other in cycles and eager class references would break at module load.
- Recurring idempotency: `Expense.occurrenceDate` (nullable `date`) + unique index `(recurringConfigId, occurrenceDate)`. `RecurringExpensesService.generateDueExpenses` creates expenses via `ExpensesService.createInternal` (`sourceType=RECURRING`, `paymentMethod=CORRIENTE`; variables get `amount=0, amountPending=true`). Keep the `occurrenceDate` plumbing when touching expenses.
- `pnpm run test` includes only `**/*.spec.ts`; e2e files are `test/*.e2e-spec.ts` and are excluded from the unit run.
- PowerShell: do not rewrite `src` files with `Set-Content`/`Out-File`; they re-encode UTF-8 as ANSI and corrupt Spanish accents. Use the file-editing tools.

## Git / feature flow
- Conventional Commits, one commit per logical step; suggested messages are listed in each `docs/features/FEATURE_N.md`.
- Intended branch flow is `feature/NN-name` from `develop`, but this repo only has `main`; prior feature branches were created from `main`.
