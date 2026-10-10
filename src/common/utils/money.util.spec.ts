import { describe, it, expect } from 'vitest';
import { MoneyUtil } from './money.util.js';

describe('MoneyUtil', () => {
  it('should accurately add amounts avoiding floating point precision errors', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // standard JS float problem
    expect(MoneyUtil.add(0.1, 0.2)).toBe(0.3);
  });

  it('should subtract amounts correctly', () => {
    expect(MoneyUtil.subtract(10.5, 3.25)).toBe(7.25);
  });

  it('should multiply and divide amounts correctly', () => {
    expect(MoneyUtil.multiply(10, 2.5)).toBe(25);
    expect(MoneyUtil.divide(100, 4)).toBe(25);
  });

  it('should format amounts with two decimal places', () => {
    expect(MoneyUtil.format(10)).toBe('10.00');
    expect(MoneyUtil.format(12.3456)).toBe('12.35');
  });

  it('should round amounts properly', () => {
    expect(MoneyUtil.round(12.345)).toBe(12.35);
  });
});
