import { MoneyUtil } from './money.util.js';
import { DateUtil } from './date.util.js';
import {
  RecurrenceFrequency,
  RecurrenceRule,
  RecurrenceUtil,
} from './recurrence.util.js';

/**
 * Configuración de recordatorio asociada a un plan de cuotas.
 * Para un plan de una sola cuota se usa `at`; para más de una se usa la
 * recurrencia (`frequency` + campos según la frecuencia) y `hour`.
 */
export interface InstallmentReminderConfig {
  enabled: boolean;
  frequency?: RecurrenceFrequency | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  at?: Date | string | null;
  hour?: number | null;
}

export interface BuildInstallmentPlanInput {
  totalAmount: number;
  installments: number;
  baseDate: Date;
  timezone: string;
  reminder: InstallmentReminderConfig;
}

export interface InstallmentPlanItem {
  number: number;
  amount: number;
  dueDate: Date | null;
}

/**
 * Generador reutilizable de planes de cuotas con recordatorio (F09 Cobros,
 * F10 Préstamos, F11 Deudas). Devuelve `[{ number, amount, dueDate }]`:
 * - El monto por cuota se redondea a 2 decimales y el residuo va a la última.
 * - `dueDate` es el instante UTC (minutos/segundos en 0) de la ocurrencia local
 *   según la zona horaria del usuario; `null` si el recordatorio está desactivado.
 */
export class InstallmentScheduleBuilder {
  static build(input: BuildInstallmentPlanInput): InstallmentPlanItem[] {
    const installments = Math.max(1, Math.floor(input.installments));
    const amounts = this.buildAmounts(input.totalAmount, installments);
    const dueDates = this.buildDueDates(installments, input);

    return amounts.map((amount, index) => ({
      number: index + 1,
      amount,
      dueDate: dueDates[index],
    }));
  }

  private static buildAmounts(
    totalAmount: number,
    installments: number,
  ): number[] {
    const perInstallment = MoneyUtil.round(
      MoneyUtil.divide(totalAmount, installments),
    );

    const amounts: number[] = [];
    let assigned = 0;
    for (let i = 1; i <= installments; i++) {
      if (i === installments) {
        amounts.push(MoneyUtil.round(MoneyUtil.subtract(totalAmount, assigned)));
      } else {
        amounts.push(perInstallment);
        assigned = MoneyUtil.add(assigned, perInstallment);
      }
    }

    return amounts;
  }

  private static buildDueDates(
    installments: number,
    input: BuildInstallmentPlanInput,
  ): (Date | null)[] {
    const { reminder } = input;

    if (!reminder.enabled) {
      return Array.from({ length: installments }, () => null);
    }

    if (installments === 1) {
      return [reminder.at ? new Date(reminder.at) : null];
    }

    if (reminder.frequency == null) {
      return Array.from({ length: installments }, () => null);
    }

    const rule: RecurrenceRule = {
      frequency: reminder.frequency,
      dayOfWeek: reminder.dayOfWeek ?? null,
      dayOfMonth: reminder.dayOfMonth ?? null,
      monthOfYear: reminder.monthOfYear ?? null,
    };
    const hour = reminder.hour ?? 0;

    const dueDates: (Date | null)[] = [];
    let occurrence = RecurrenceUtil.computeNextOccurrence(
      rule,
      input.baseDate,
      input.timezone,
    );

    for (let i = 0; i < installments; i++) {
      const localDate = RecurrenceUtil.toLocalDateString(
        occurrence,
        input.timezone,
      );
      dueDates.push(
        DateUtil.computeScheduledAt(localDate, hour, input.timezone),
      );
      occurrence = RecurrenceUtil.computeFollowingOccurrence(
        rule,
        occurrence,
        input.timezone,
      );
    }

    return dueDates;
  }
}
