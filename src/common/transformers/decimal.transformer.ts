import { ValueTransformer } from 'typeorm';
import { Decimal } from 'decimal.js';

export class DecimalTransformer implements ValueTransformer {
  /**
   * Se ejecuta antes de guardar en la base de datos (number / Decimal / string -> string)
   */
  to(value?: Decimal.Value | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return new Decimal(value).toFixed(2);
  }

  /**
   * Se ejecuta al leer de la base de datos (string -> number)
   */
  from(value?: string | number | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return Number(new Decimal(value).toFixed(2));
  }
}

export const decimalTransformer = new DecimalTransformer();
