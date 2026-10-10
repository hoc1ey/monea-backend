import { describe, it, expect } from 'vitest';
import { DateUtil } from './date.util.js';

describe('DateUtil', () => {
  it('should format date to YYYY-MM period format', () => {
    const testDate = new Date(Date.UTC(2026, 4, 15));
    expect(DateUtil.formatPeriod(testDate)).toBe('2026-05');
  });

  it('should validate valid period strings', () => {
    expect(DateUtil.isValidPeriod('2026-01')).toBe(true);
    expect(DateUtil.isValidPeriod('2026-12')).toBe(true);
    expect(DateUtil.isValidPeriod('2026-00')).toBe(false);
    expect(DateUtil.isValidPeriod('2026-13')).toBe(false);
    expect(DateUtil.isValidPeriod('2026/05')).toBe(false);
    expect(DateUtil.isValidPeriod('invalid')).toBe(false);
  });
});
