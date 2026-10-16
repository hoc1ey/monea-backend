import { MoneyUtil } from './money.util.js';

export interface BuildInstallmentScheduleInput {
  date: Date | string;
  amount: number;
  installments: number;
  graceMonths: number;
  cutoffDay?: number | null;
}

export interface InstallmentScheduleItem {
  number: number;
  amount: number;
  period: string;
}

/**
 * Utilidades para construir planes de cuotas de egresos diferidos (F06).
 * Todos los periodos son strings YYYY-MM calculados en UTC.
 */
export class InstallmentUtil {
  /**
   * Genera el cronograma de cuotas:
   * 1. Periodo base = mes de la compra; si `dayOfPurchase > cutoffDay` → mes siguiente.
   * 2. Primera cuota = periodo base + graceMonths.
   * 3. Cuota i = primera cuota + (i - 1) meses.
   * 4. Monto por cuota = amount / installments redondeado a 2 decimales;
   *    el residuo de redondeo se asigna a la última cuota.
   */
  static buildInstallmentSchedule(
    input: BuildInstallmentScheduleInput,
  ): InstallmentScheduleItem[] {
    const { amount, graceMonths, cutoffDay } = input;
    const installments = Math.max(1, Math.floor(input.installments));

    const purchaseDate =
      input.date instanceof Date ? input.date : new Date(input.date);

    let baseYear = purchaseDate.getUTCFullYear();
    let baseMonth = purchaseDate.getUTCMonth();

    if (
      cutoffDay != null &&
      purchaseDate.getUTCDate() > cutoffDay
    ) {
      baseMonth += 1;
    }

    const firstIndex = baseYear * 12 + baseMonth + graceMonths;
    const perInstallment = MoneyUtil.round(
      MoneyUtil.divide(amount, installments),
    );

    const baseTotal = MoneyUtil.round(
      MoneyUtil.multiply(perInstallment, installments - 1),
    );

    const schedule: InstallmentScheduleItem[] = [];

    for (let i = 1; i <= installments; i++) {
      const index = firstIndex + (i - 1);
      const periodYear = Math.floor(index / 12);
      const periodMonth = index % 12;

      schedule.push({
        number: i,
        amount:
          i === installments
            ? MoneyUtil.round(MoneyUtil.subtract(amount, baseTotal))
            : perInstallment,
        period: `${periodYear}-${String(periodMonth + 1).padStart(2, '0')}`,
      });
    }

    return schedule;
  }
}
