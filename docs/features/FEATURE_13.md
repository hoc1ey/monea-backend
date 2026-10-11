## F13 — Hardening, pruebas y documentación

**Objetivo:** asegurar la calidad transversal antes de entregar.

- **Rama:** `feature/13-hardening-docs`

### Pasos

1. **Auditoría de soft delete:** buscar `.delete(` / `.remove(` en el código (no debe haber) y verificar `isDeleted: false` en todas las consultas.
2. **Auditoría de ownership:** ningún DTO tiene `userId`; todo servicio filtra por `userId`.
3. **Pruebas unitarias** de servicios críticos: bloqueos de login (5/7/8/9+ intentos y IP), `buildInstallmentSchedule`, `computeNextOccurrence`, `markPeriodAsPaid`, cierre de lista de compras.
4. **Pruebas e2e:** flujo auth completo (register → login → refresh → logout), formato de respuesta (`success/statusCode/data/message/errors`), rate limit y arranque fallido con `.env` incompleto.
5. Documentar con Swagger todas las rutas (marcando las públicas) y actualizar `README.md` con la guía de variables de entorno.
6. Revisar índices (`userId`, `isDeleted`, `scheduledAt`, `nextRunAt`, `period`).

### Dependencias

```bash
pnpm add -D jest @nestjs/testing supertest @types/supertest ts-jest
```
(ya vienen con el template de Nest; instalar solo si faltan)

### Commits

```
test: pruebas unitarias de bloqueos, cuotas, recurrencias y cierre de compras
test(e2e): flujo de autenticacion, formato de respuesta y rate limit
docs: documentacion swagger y README con guia de variables de entorno
chore: auditoria de borrado logico, ownership e indices
```

---
