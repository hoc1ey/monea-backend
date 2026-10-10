/**
 * Utilidades para manejo de fechas, periodos mensuales (YYYY-MM) y tiempos
 */
export class DateUtil {
  /**
   * Formatea una fecha al periodo mensual YYYY-MM en UTC
   */
  static formatPeriod(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Valida si un string cumple el formato mensual YYYY-MM
   */
  static isValidPeriod(period: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  }
}
