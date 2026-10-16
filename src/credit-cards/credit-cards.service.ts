import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditCard } from './entities/credit-card.entity.js';
import { CreateCreditCardDto } from './dto/create-credit-card.dto.js';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto.js';
import { ReminderService } from '../notifications/reminder.service.js';
import { Reminder } from '../notifications/entities/reminder.entity.js';
import { ReminderType } from '../notifications/notifications.constants.js';
import { UsersService } from '../users/users.service.js';
import { DateUtil } from '../common/utils/date.util.js';

@Injectable()
export class CreditCardsService {
  constructor(
    @InjectRepository(CreditCard)
    protected readonly creditCardRepository: Repository<CreditCard>,
    private readonly reminderService: ReminderService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Crea una tarjeta de crédito asociada al usuario autenticado.
   * Si el recordatorio está activo, exige un día de pago y lo programa.
   */
  async create(userId: string, dto: CreateCreditCardDto) {
    const reminderEnabled = dto.reminderEnabled ?? false;

    if (reminderEnabled && dto.paymentDay == null) {
      throw new BadRequestException(
        'Se requiere el día de pago para activar el recordatorio',
      );
    }

    const card = this.creditCardRepository.create({
      userId,
      name: dto.name,
      color: dto.color,
      issuer: dto.issuer,
      lastFourDigits: dto.lastFourDigits,
      creditLimit: dto.creditLimit ?? null,
      cutoffDay: dto.cutoffDay ?? null,
      paymentDay: dto.paymentDay ?? null,
      reminderEnabled,
      reminderDaysBefore: dto.reminderDaysBefore ?? 1,
      reminderHour: dto.reminderHour ?? 9,
    });

    const saved = await this.creditCardRepository.save(card);

    if (saved.reminderEnabled) {
      await this.scheduleNextPaymentReminder(saved);
    }

    return {
      data: saved,
      message: 'Tarjeta creada correctamente',
    };
  }

  /**
   * Lista las tarjetas activas del usuario autenticado ordenadas por fecha de creación descendente.
   */
  async findAll(userId: string) {
    const cards = await this.creditCardRepository.find({
      where: { userId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return {
      data: cards,
      message: 'Tarjetas obtenidas correctamente',
    };
  }

  /**
   * Obtiene una tarjeta validando pertenencia al usuario y borrado lógico.
   */
  async findOne(userId: string, id: string) {
    const card = await this.assertOwnership(userId, id);

    return {
      data: card,
      message: 'Tarjeta obtenida correctamente',
    };
  }

  /**
   * Actualiza una tarjeta. Si cambian datos que afectan el recordatorio,
   * lo reprograma (si sigue activo) o lo cancela (si se desactivó).
   */
  async update(userId: string, id: string, dto: UpdateCreditCardDto) {
    const card = await this.assertOwnership(userId, id);

    const reminderFieldsChanged =
      dto.reminderEnabled !== undefined ||
      dto.paymentDay !== undefined ||
      dto.reminderDaysBefore !== undefined ||
      dto.reminderHour !== undefined ||
      dto.name !== undefined;

    if (dto.name !== undefined) {
      card.name = dto.name;
    }
    if (dto.color !== undefined) {
      card.color = dto.color;
    }
    if (dto.issuer !== undefined) {
      card.issuer = dto.issuer;
    }
    if (dto.lastFourDigits !== undefined) {
      card.lastFourDigits = dto.lastFourDigits;
    }
    if (dto.creditLimit !== undefined) {
      card.creditLimit = dto.creditLimit ?? null;
    }
    if (dto.cutoffDay !== undefined) {
      card.cutoffDay = dto.cutoffDay ?? null;
    }
    if (dto.paymentDay !== undefined) {
      card.paymentDay = dto.paymentDay ?? null;
    }
    if (dto.reminderEnabled !== undefined) {
      card.reminderEnabled = dto.reminderEnabled;
    }
    if (dto.reminderDaysBefore !== undefined) {
      card.reminderDaysBefore = dto.reminderDaysBefore;
    }
    if (dto.reminderHour !== undefined) {
      card.reminderHour = dto.reminderHour;
    }

    if (card.reminderEnabled && card.paymentDay == null) {
      throw new BadRequestException(
        'Se requiere el día de pago para activar el recordatorio',
      );
    }

    const updated = await this.creditCardRepository.save(card);

    if (reminderFieldsChanged) {
      if (updated.reminderEnabled) {
        await this.scheduleNextPaymentReminder(updated);
      } else {
        await this.reminderService.cancelBySource(
          ReminderType.CREDIT_CARD_PAYMENT,
          updated.id,
        );
      }
    }

    return {
      data: updated,
      message: 'Tarjeta actualizada correctamente',
    };
  }

  /**
   * Borrado lógico de la tarjeta y cancelación de sus recordatorios pendientes.
   * Las compras diferidas históricas y sus cuotas se conservan.
   */
  async remove(userId: string, id: string) {
    const card = await this.assertOwnership(userId, id);

    card.isDeleted = true;
    card.deletedAt = new Date();
    await this.creditCardRepository.save(card);

    await this.reminderService.cancelBySource(
      ReminderType.CREDIT_CARD_PAYMENT,
      card.id,
    );

    return {
      data: null,
      message: 'Tarjeta eliminada correctamente',
    };
  }

  /**
   * Valida que la tarjeta exista, no esté eliminada y pertenezca al usuario autenticado.
   * Reutilizable por otros módulos (Egresos, Pagos de tarjeta, etc.).
   */
  async assertOwnership(userId: string, cardId: string): Promise<CreditCard> {
    const card = await this.creditCardRepository.findOne({
      where: { id: cardId, userId, isDeleted: false },
    });

    if (!card) {
      throw new NotFoundException('Tarjeta no encontrada');
    }

    return card;
  }

  /**
   * Calcula el próximo día de pago (ajustado al último día del mes cuando el mes
   * tiene menos días), le resta `reminderDaysBefore` días y aplica `reminderHour`
   * en la zona horaria del usuario. Reprograma el recordatorio CREDIT_CARD_PAYMENT.
   */
  async scheduleNextPaymentReminder(
    card: CreditCard,
  ): Promise<Reminder | null> {
    if (!card.reminderEnabled || card.paymentDay == null) {
      return null;
    }

    const user = await this.usersService.findById(card.userId);
    const timezone = user.timezone || 'America/Bogota';

    const scheduledAt = this.computeNextPaymentReminderAt(
      card.paymentDay,
      card.reminderDaysBefore,
      card.reminderHour,
      timezone,
    );

    return this.reminderService.reschedule(
      ReminderType.CREDIT_CARD_PAYMENT,
      card.id,
      {
        userId: card.userId,
        type: ReminderType.CREDIT_CARD_PAYMENT,
        sourceId: card.id,
        title: `Pago de tarjeta ${card.name}`,
        body: `Se aproxima la fecha de pago de tu tarjeta ${card.name} (terminación ${card.lastFourDigits}).`,
        scheduledAt,
      },
    );
  }

  /**
   * Devuelve la próxima fecha/hora (UTC) del recordatorio de pago.
   * Recorre hasta 12 meses hacia adelante hasta encontrar una fecha futura.
   */
  private computeNextPaymentReminderAt(
    paymentDay: number,
    reminderDaysBefore: number,
    reminderHour: number,
    timezone: string,
  ): Date {
    const now = new Date();
    const { year, month } = this.getYearMonthInTimezone(now, timezone);

    for (let offset = 0; offset < 12; offset++) {
      const paymentDate = this.buildPaymentDate(year, month + offset, paymentDay);
      const scheduledAt = DateUtil.computeScheduledAt(
        paymentDate,
        reminderHour,
        timezone,
        -reminderDaysBefore,
      );

      if (scheduledAt.getTime() > now.getTime()) {
        return scheduledAt;
      }
    }

    return DateUtil.computeScheduledAt(
      this.buildPaymentDate(year, month + 12, paymentDay),
      reminderHour,
      timezone,
      -reminderDaysBefore,
    );
  }

  /**
   * Construye la fecha de pago (UTC, a medianoche) ajustando el día al último del mes
   * cuando el mes destino tiene menos días (p. ej. día 31 en febrero → 28/29).
   */
  private buildPaymentDate(
    year: number,
    monthIndex: number,
    paymentDay: number,
  ): Date {
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const day = Math.min(paymentDay, lastDay);
    return new Date(Date.UTC(year, monthIndex, day));
  }

  /**
   * Obtiene el año y mes (0-indexado) actuales en la zona horaria indicada.
   */
  private getYearMonthInTimezone(
    date: Date,
    timezone: string,
  ): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);

    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = Number(part.value);
      }
    }

    return { year: map.year, month: map.month - 1 };
  }
}
