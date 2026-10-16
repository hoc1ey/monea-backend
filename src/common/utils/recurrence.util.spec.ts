import { describe, it, expect } from 'vitest';
import {
  RecurrenceFrequency,
  RecurrenceUtil,
} from './recurrence.util.js';

const TZ = 'America/Bogota';

describe('RecurrenceUtil', () => {
  it('computa la próxima ocurrencia semanal en la zona del usuario', () => {
    const after = RecurrenceUtil.localDateToUtc('2026-10-09', TZ);

    const next = RecurrenceUtil.computeNextOccurrence(
      {
        frequency: RecurrenceFrequency.WEEKLY,
        dayOfWeek: 1,
        dayOfMonth: null,
        monthOfYear: null,
      },
      after,
      TZ,
    );

    expect(next.toISOString()).toBe('2026-10-12T05:00:00.000Z');
  });

  it('ajusta el día 31 a meses cortos (noviembre -> 30)', () => {
    const after = RecurrenceUtil.localDateToUtc('2026-11-01', TZ);

    const next = RecurrenceUtil.computeNextOccurrence(
      {
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfWeek: null,
        dayOfMonth: 31,
        monthOfYear: null,
      },
      after,
      TZ,
    );

    expect(RecurrenceUtil.toLocalDateString(next, TZ)).toBe('2026-11-30');
  });

  it('respeta días válidos del mes mensual', () => {
    const after = RecurrenceUtil.localDateToUtc('2026-10-09', TZ);

    const next = RecurrenceUtil.computeNextOccurrence(
      {
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfWeek: null,
        dayOfMonth: 31,
        monthOfYear: null,
      },
      after,
      TZ,
    );

    expect(RecurrenceUtil.toLocalDateString(next, TZ)).toBe('2026-10-31');
  });

  it('computa la ocurrencia anual con mes y día', () => {
    const after = RecurrenceUtil.localDateToUtc('2026-10-09', TZ);

    const next = RecurrenceUtil.computeNextOccurrence(
      {
        frequency: RecurrenceFrequency.YEARLY,
        dayOfWeek: null,
        dayOfMonth: 15,
        monthOfYear: 8,
      },
      after,
      TZ,
    );

    expect(RecurrenceUtil.toLocalDateString(next, TZ)).toBe('2027-08-15');
  });

  it('computa la ocurrencia anual solo con mes (día 1)', () => {
    const after = RecurrenceUtil.localDateToUtc('2026-10-09', TZ);

    const next = RecurrenceUtil.computeNextOccurrence(
      {
        frequency: RecurrenceFrequency.YEARLY,
        dayOfWeek: null,
        dayOfMonth: null,
        monthOfYear: 8,
      },
      after,
      TZ,
    );

    expect(RecurrenceUtil.toLocalDateString(next, TZ)).toBe('2027-08-01');
  });

  it('computa la ocurrencia siguiente a una ya generada', () => {
    const occurrence = RecurrenceUtil.localDateToUtc('2026-10-12', TZ);

    const next = RecurrenceUtil.computeFollowingOccurrence(
      {
        frequency: RecurrenceFrequency.WEEKLY,
        dayOfWeek: 1,
        dayOfMonth: null,
        monthOfYear: null,
      },
      occurrence,
      TZ,
    );

    expect(RecurrenceUtil.toLocalDateString(next, TZ)).toBe('2026-10-19');
  });
});
