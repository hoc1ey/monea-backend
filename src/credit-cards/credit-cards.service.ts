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

@Injectable()
export class CreditCardsService {
  constructor(
    @InjectRepository(CreditCard)
    protected readonly creditCardRepository: Repository<CreditCard>,
  ) {}

  /**
   * Crea una tarjeta de crédito asociada al usuario autenticado.
   * Si el recordatorio está activo, exige un día de pago.
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
   * Actualiza una tarjeta de crédito del usuario autenticado.
   */
  async update(userId: string, id: string, dto: UpdateCreditCardDto) {
    const card = await this.assertOwnership(userId, id);

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

    return {
      data: updated,
      message: 'Tarjeta actualizada correctamente',
    };
  }

  /**
   * Borrado lógico de la tarjeta. Las compras diferidas históricas y sus cuotas se conservan.
   */
  async remove(userId: string, id: string) {
    const card = await this.assertOwnership(userId, id);

    card.isDeleted = true;
    card.deletedAt = new Date();
    await this.creditCardRepository.save(card);

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
}
