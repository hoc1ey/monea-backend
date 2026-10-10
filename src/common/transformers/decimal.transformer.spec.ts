import { describe, it, expect } from 'vitest';
import { DecimalTransformer, decimalTransformer } from './decimal.transformer.js';
import Decimal from 'decimal.js';

describe('DecimalTransformer', () => {
  const transformer = new DecimalTransformer();

  it('to(): should convert number to string formatted to 2 decimals', () => {
    expect(transformer.to(123.456)).toBe('123.46');
    expect(transformer.to(100)).toBe('100.00');
    expect(transformer.to('50.5')).toBe('50.50');
    expect(transformer.to(new Decimal(75.25))).toBe('75.25');
  });

  it('to(): should return null when value is null or undefined', () => {
    expect(transformer.to(null)).toBeNull();
    expect(transformer.to(undefined)).toBeNull();
  });

  it('from(): should convert database string to number', () => {
    expect(transformer.from('123.45')).toBe(123.45);
    expect(transformer.from('100.00')).toBe(100);
    expect(transformer.from(50.5)).toBe(50.5);
  });

  it('from(): should return null when value is null or undefined', () => {
    expect(transformer.from(null)).toBeNull();
    expect(transformer.from(undefined)).toBeNull();
  });

  it('should export singleton instance', () => {
    expect(decimalTransformer).toBeInstanceOf(DecimalTransformer);
  });
});
