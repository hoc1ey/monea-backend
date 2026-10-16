/**
 * Utilidades para manejo de fechas, periodos mensuales (YYYY-MM), tiempos y zonas horarias
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
   * Formatea una fecha al periodo mensual YYYY-MM según la zona horaria del usuario
   */
  static formatPeriodInTimezone(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);

    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    }

    return `${map.year}-${String(Number(map.month)).padStart(2, '0')}`;
  }

  /**
   * Valida si un string cumple el formato mensual YYYY-MM
   */
  static isValidPeriod(period: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  }

  /**
   * Convierte un periodo YYYY-MM a su índice absoluto de mes (año * 12 + mes0).
   */
  static periodToIndex(period: string): number {
    const [year, month] = period.split('-').map(Number);
    return year * 12 + (month - 1);
  }

  /**
   * Convierte un índice absoluto de mes a un periodo YYYY-MM.
   */
  static indexToPeriod(index: number): string {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  /**
   * Construye una fecha UTC correspondiente a una fecha base, hora objetivo en la zona horaria del usuario
   * con minutos y segundos forzados en 0, y un desfase opcional de días (offsetDays).
   * Todo se almacena en UTC en la base de datos según los lineamientos globales.
   */
  static computeScheduledAt(
    date: Date | string,
    hour: number,
    timezone: string,
    offsetDays = 0,
  ): Date {
    const normalizedHour = Math.min(23, Math.max(0, Math.floor(hour)));

    let baseDate: Date;
    if (typeof date === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
        const [y, m, d] = date.slice(0, 10).split('-').map(Number);
        baseDate = new Date(Date.UTC(y, m - 1, d));
      } else {
        baseDate = new Date(date);
      }
    } else {
      baseDate = new Date(date.getTime());
    }

    // Aplicar desplazamiento en días
    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);

    const targetYear = baseDate.getUTCFullYear();
    const targetMonth = baseDate.getUTCMonth();
    const targetDay = baseDate.getUTCDate();

    // Tiempo objetivo expresado en ms relativos como si fuera UTC
    const targetLocalMs = Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      normalizedHour,
      0,
      0,
      0,
    );

    let guessMs = targetLocalMs;

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    // Convergencia de desfase horario (resuelve diferencias horarias y DST)
    for (let i = 0; i < 2; i++) {
      const parts = formatter.formatToParts(new Date(guessMs));
      const partMap: Record<string, number> = {};
      for (const part of parts) {
        if (part.type !== 'literal') {
          partMap[part.type] = Number(part.value);
        }
      }

      const localHour = partMap.hour === 24 ? 0 : (partMap.hour ?? 0);
      const localUtcMs = Date.UTC(
        partMap.year,
        partMap.month - 1,
        partMap.day,
        localHour,
        partMap.minute ?? 0,
        partMap.second ?? 0,
      );

      const diff = targetLocalMs - localUtcMs;
      guessMs += diff;
    }

    const finalDate = new Date(guessMs);
    finalDate.setUTCMinutes(0, 0, 0);
    return finalDate;
  }
}
