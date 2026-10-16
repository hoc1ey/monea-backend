import { DateUtil } from './date.util.js';

/**
 * Frecuencias soportadas por los egresos recurrentes.
 */
export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

/**
 * Regla de recurrencia: sólo los campos relevantes para la frecuencia son no nulos.
 */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Cálculo de la próxima ocurrencia de una recurrencia (semanal/mensual/anual).
 * Trabaja sobre fechas locales (según la zona horaria del usuario) y devuelve el
 * instante UTC correspondiente a la medianoche local de la ocurrencia.
 * Ajusta los meses cortos: día 31 en febrero -> último día del mes; 29-feb en
 * años no bisiestos -> 28.
 */
export class RecurrenceUtil {
  /**
   * Primera ocurrencia cuya fecha local sea mayor o igual a la fecha local de `after`.
   */
  static computeNextOccurrence(
    rule: RecurrenceRule,
    after: Date,
    timezone: string,
  ): Date {
    const afterDate = RecurrenceUtil.toLocalDate(after, timezone);
    return RecurrenceUtil.firstOnOrAfter(rule, afterDate, timezone);
  }

  /**
   * Primera ocurrencia estrictamente posterior a la ocurrencia indicada.
   * Útil para avanzar `nextRunAt` tras generar un egreso.
   */
  static computeFollowingOccurrence(
    rule: RecurrenceRule,
    occurrence: Date,
    timezone: string,
  ): Date {
    const occurrenceDate = RecurrenceUtil.toLocalDate(occurrence, timezone);
    const nextDay = RecurrenceUtil.addDays(occurrenceDate, 1);
    return RecurrenceUtil.firstOnOrAfter(rule, nextDay, timezone);
  }

  /**
   * Fecha local (YYYY-MM-DD) de un instante UTC en la zona horaria dada.
   */
  static toLocalDateString(date: Date, timezone: string): string {
    const local = RecurrenceUtil.toLocalDate(date, timezone);
    return `${local.year}-${RecurrenceUtil.pad(local.month)}-${RecurrenceUtil.pad(local.day)}`;
  }

  /**
   * Instante UTC de la medianoche local de una fecha YYYY-MM-DD.
   */
  static localDateToUtc(date: string, timezone: string): Date {
    return DateUtil.computeScheduledAt(date, 0, timezone);
  }

  private static firstOnOrAfter(
    rule: RecurrenceRule,
    after: LocalDate,
    timezone: string,
  ): Date {
    let candidate: LocalDate;

    switch (rule.frequency) {
      case RecurrenceFrequency.WEEKLY:
        candidate = RecurrenceUtil.nextWeekly(rule.dayOfWeek ?? 1, after);
        break;
      case RecurrenceFrequency.MONTHLY:
        candidate = RecurrenceUtil.nextMonthly(rule.dayOfMonth ?? 1, after);
        break;
      case RecurrenceFrequency.YEARLY:
        candidate = RecurrenceUtil.nextYearly(
          rule.monthOfYear ?? 1,
          rule.dayOfMonth ?? 1,
          after,
        );
        break;
      default:
        candidate = after;
    }

    return RecurrenceUtil.localDateToUtc(
      `${candidate.year}-${RecurrenceUtil.pad(candidate.month)}-${RecurrenceUtil.pad(candidate.day)}`,
      timezone,
    );
  }

  private static nextWeekly(target: number, after: LocalDate): LocalDate {
    const current = RecurrenceUtil.isoWeekday(after);
    const delta = (((target - current) % 7) + 7) % 7;
    return RecurrenceUtil.addDays(after, delta);
  }

  private static nextMonthly(targetDay: number, after: LocalDate): LocalDate {
    let year = after.year;
    let month = after.month;

    for (let i = 0; i < 24; i++) {
      const day = Math.min(targetDay, RecurrenceUtil.daysInMonth(year, month));
      const candidate = { year, month, day };
      if (RecurrenceUtil.compare(candidate, after) >= 0) {
        return candidate;
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return after;
  }

  private static nextYearly(
    targetMonth: number,
    targetDay: number,
    after: LocalDate,
  ): LocalDate {
    let year = after.year;

    for (let i = 0; i < 8; i++) {
      const day = Math.min(
        targetDay,
        RecurrenceUtil.daysInMonth(year, targetMonth),
      );
      const candidate = { year, month: targetMonth, day };
      if (RecurrenceUtil.compare(candidate, after) >= 0) {
        return candidate;
      }
      year += 1;
    }

    return after;
  }

  private static toLocalDate(date: Date, timezone: string): LocalDate {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);

    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = Number(part.value);
      }
    }

    return { year: map.year, month: map.month, day: map.day };
  }

  private static addDays(date: LocalDate, days: number): LocalDate {
    const shifted = new Date(
      Date.UTC(date.year, date.month - 1, date.day + days),
    );
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  }

  private static isoWeekday(date: LocalDate): number {
    const dayOfWeek = new Date(
      Date.UTC(date.year, date.month - 1, date.day),
    ).getUTCDay();
    return dayOfWeek === 0 ? 7 : dayOfWeek;
  }

  private static daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  private static compare(a: LocalDate, b: LocalDate): number {
    if (a.year !== b.year) {
      return a.year - b.year;
    }
    if (a.month !== b.month) {
      return a.month - b.month;
    }
    return a.day - b.day;
  }

  private static pad(value: number): string {
    return String(value).padStart(2, '0');
  }
}
