## Supuestos y decisiones a confirmar

Los documentos no definen algunos puntos; esto es lo que asumí en el plan (cámbialo si no aplica):

| # | Tema | Supuesto adoptado | Respuesta |
|---|---|---| --- |
| A | **Pago de cuota de Deuda** | Los requisitos no dicen si genera egreso. Se asume que **sí** crea un egreso corriente en la cuenta elegida (simétrico a Cobros). | Si, se genera un egreso |
| B | **6 intentos fallidos** | No está en la tabla; se aplica el bloqueo del escalón más cercano inferior (15 min). | 6 intentos fallidos o más van sumando el último tiempo de bloqueo más alto |
| C | **Anual solo con mes** | Si no hay día, se genera el **día 1** de ese mes. | El recordatorio si se crea con fecha 1, pero la configuración del recordatorio como tal se debe guardar sin dia, solo el mes |
| D | **Día 29–31 en meses cortos** | Se ajusta al último día del mes. | Si, se ajusta al último dia |
| E | **Recordatorio de tarjeta** | `reminderDaysBefore` (default 1) y `reminderHour` (default 9) son configurables; los requisitos solo dicen "antes de la fecha límite". | Si |
| F | **Egreso diferido y cuenta** | `accountId` es obligatorio, pero el saldo solo baja cuando se paga la tarjeta (F07). | El egreso se crea como pendiente, y pasa a pagado cuando se paga la tarjeta
| G | **Pago de tarjeta** | Solo se puede pagar el periodo actual o anteriores impagos; no periodos futuros. | Si
| H | **Corte de tarjeta** | Compras posteriores al día de corte pasan a facturarse en el siguiente periodo. | Si, justamente como funciona en la vida real
| I | **Saldo insuficiente** | No se bloquean egresos por saldo negativo (no está en los requisitos). | No se bloquean, todo funciona como una agenda o recordatorio
| J | **Zona horaria** | Cada usuario tiene `timezone` para recordatorios y recurrencias. | La columna usuario debe tener un lugar para guardar la configuración de la zona, en la BD TODO SE GUARDA EN UTC, y la transformación se hace en el servicio del BACKEND en base a la configuración del usuario.
