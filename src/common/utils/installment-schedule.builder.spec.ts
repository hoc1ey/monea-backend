import { describe, it, expect } from 'vitest';
import { InstallmentScheduleBuilder } from './installment-schedule.builder.js';
import { RecurrenceFrequency } from './recurrence.util.js';

const TIMEZONE = 'America/Guayaquil';

describe('InstallmentScheduleBuilder', () => {
  it('splits the amount and assigns the rounding residue to the last installment', () => {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: 100,
      installments: 3,
      baseDate: new Date('2026-10-09T12:00:00.000Z'),
      timezone: TIMEZONE,
      reminder: {
        enabled: true,
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: 15,
        hour: 10,
      },
    });

    expect(plan.map((i) => i.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(plan.map((i) => i.dueDate?.toISOString())).toEqual([
      '2026-10-15T15:00:00.000Z',
      '2026-11-15T15:00:00.000Z',
      '2026-12-15T15:00:00.000Z',
    ]);
  });

  it('uses the explicit date for a single installment reminder', () => {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: 100,
      installments: 1,
      baseDate: new Date('2026-10-09T12:00:00.000Z'),
      timezone: TIMEZONE,
      reminder: {
        enabled: true,
        at: '2026-12-01T14:00:00.000Z',
      },
    });

    expect(plan).toEqual([
      {
        number: 1,
        amount: 100,
        dueDate: new Date('2026-12-01T14:00:00.000Z'),
      },
    ]);
  });

  it('returns null due dates when the reminder is disabled', () => {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: 50,
      installments: 2,
      baseDate: new Date('2026-10-09T12:00:00.000Z'),
      timezone: TIMEZONE,
      reminder: { enabled: false },
    });

    expect(plan).toEqual([
      { number: 1, amount: 25, dueDate: null },
      { number: 2, amount: 25, dueDate: null },
    ]);
  });

  it('defaults the yearly reminder to day 1 when no day is provided', () => {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: 30,
      installments: 2,
      baseDate: new Date('2026-10-09T12:00:00.000Z'),
      timezone: TIMEZONE,
      reminder: {
        enabled: true,
        frequency: RecurrenceFrequency.YEARLY,
        monthOfYear: 8,
        hour: 10,
      },
    });

    expect(plan.map((i) => i.dueDate?.toISOString())).toEqual([
      '2027-08-01T15:00:00.000Z',
      '2028-08-01T15:00:00.000Z',
    ]);
  });

  it('generates weekly occurrences from the configured weekday', () => {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: 30,
      installments: 3,
      baseDate: new Date('2026-10-09T12:00:00.000Z'),
      timezone: TIMEZONE,
      reminder: {
        enabled: true,
        frequency: RecurrenceFrequency.WEEKLY,
        dayOfWeek: 1,
        hour: 10,
      },
    });

    expect(plan.map((i) => i.dueDate?.toISOString())).toEqual([
      '2026-10-12T15:00:00.000Z',
      '2026-10-19T15:00:00.000Z',
      '2026-10-26T15:00:00.000Z',
    ]);
  });
});
