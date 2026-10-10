import { Decimal } from 'decimal.js';

/**
 * Utilidades para cálculo monetario con decimal.js (evita errores de precisión flotante)
 */
export class MoneyUtil {
  static add(a: Decimal.Value, b: Decimal.Value): number {
    return new Decimal(a).plus(b).toNumber();
  }

  static subtract(a: Decimal.Value, b: Decimal.Value): number {
    return new Decimal(a).minus(b).toNumber();
  }

  static multiply(a: Decimal.Value, b: Decimal.Value): number {
    return new Decimal(a).times(b).toNumber();
  }

  static divide(a: Decimal.Value, b: Decimal.Value): number {
    return new Decimal(a).dividedBy(b).toNumber();
  }

  static round(val: Decimal.Value, decimals = 2): number {
    return new Decimal(val).toDecimalPlaces(decimals).toNumber();
  }

  static format(val: Decimal.Value): string {
    return new Decimal(val).toFixed(2);
  }
}
