import { describe, it, expect } from 'vitest';
import { InstallmentUtil } from './installment.util.js';

describe('InstallmentUtil.buildInstallmentSchedule', () => {
  it('generates equal installments from the purchase month when there is no cutoff', () => {
    const schedule = InstallmentUtil.buildInstallmentSchedule({
      date: '2026-10-09T12:00:00.000Z',
      amount: 900,
      installments: 3,
      graceMonths: 0,
      cutoffDay: null,
    });

    expect(schedule).toEqual([
      { number: 1, amount: 300, period: '2026-10' },
      { number: 2, amount: 300, period: '2026-11' },
      { number: 3, amount: 300, period: '2026-12' },
    ]);
  });

  it('applies grace months and assigns the rounding residue to the last installment', () => {
    const schedule = InstallmentUtil.buildInstallmentSchedule({
      date: '2026-10-09T12:00:00.000Z',
      amount: 100,
      installments: 3,
      graceMonths: 1,
      cutoffDay: null,
    });

    expect(schedule).toEqual([
      { number: 1, amount: 33.33, period: '2026-11' },
      { number: 2, amount: 33.33, period: '2026-12' },
      { number: 3, amount: 33.34, period: '2027-01' },
    ]);
    expect(schedule.reduce((acc, i) => acc + i.amount, 0)).toBeCloseTo(100, 2);
  });

  it('moves the base period to the next month when the purchase is after the cutoff day', () => {
    const schedule = InstallmentUtil.buildInstallmentSchedule({
      date: '2026-10-25T15:00:00.000Z',
      amount: 60,
      installments: 2,
      graceMonths: 0,
      cutoffDay: 20,
    });

    expect(schedule).toEqual([
      { number: 1, amount: 30, period: '2026-11' },
      { number: 2, amount: 30, period: '2026-12' },
    ]);
  });

  it('keeps the purchase month when the purchase is on or before the cutoff day', () => {
    const schedule = InstallmentUtil.buildInstallmentSchedule({
      date: '2026-10-20T15:00:00.000Z',
      amount: 60,
      installments: 2,
      graceMonths: 0,
      cutoffDay: 20,
    });

    expect(schedule.map((i) => i.period)).toEqual(['2026-10', '2026-11']);
  });

  it('rolls over the year when installments cross December', () => {
    const schedule = InstallmentUtil.buildInstallmentSchedule({
      date: '2026-12-25T12:00:00.000Z',
      amount: 30,
      installments: 2,
      graceMonths: 0,
      cutoffDay: 20,
    });

    expect(schedule.map((i) => i.period)).toEqual(['2027-01', '2027-02']);
  });
});
