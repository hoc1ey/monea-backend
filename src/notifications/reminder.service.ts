import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Reminder } from './entities/reminder.entity.js';
import {
  ReminderType,
  ReminderStatus,
} from './notifications.constants.js';
import { ScheduleReminderInput } from './dto/schedule-reminder.dto.js';
import { DateUtil } from '../common/utils/date.util.js';

@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(Reminder)
    protected readonly reminderRepository: Repository<Reminder>,
  ) {}

  /**
   * Construye una fecha UTC correspondiente a la hora indicada en la zona del usuario,
   * forzando minutos y segundos en 0.
   */
  computeScheduledAt(
    date: Date | string,
    hour: number,
    timezone: string,
    offsetDays = 0,
  ): Date {
    return DateUtil.computeScheduledAt(date, hour, timezone, offsetDays);
  }

  /**
   * Programa un nuevo recordatorio en estado PENDING.
   * Si la fecha/hora scheduledAt ya pasó respecto al momento actual, se ignora y devuelve null.
   * Fuerza minute=0 y second=0.
   */
  async schedule(input: ScheduleReminderInput): Promise<Reminder | null> {
    const scheduledAt = new Date(input.scheduledAt);
    scheduledAt.setUTCMinutes(0, 0, 0);

    // Ignora si scheduledAt ya pasó
    if (scheduledAt.getTime() <= Date.now()) {
      return null;
    }

    const reminder = this.reminderRepository.create({
      userId: input.userId,
      type: input.type,
      sourceId: input.sourceId,
      title: input.title,
      body: input.body,
      scheduledAt,
      status: ReminderStatus.PENDING,
      attempts: 0,
    });

    return this.reminderRepository.save(reminder);
  }

  /**
   * Cancela los recordatorios pendientes asociados a una entidad origen polimórfica (type + sourceId).
   * Marca status = CANCELLED sin borrar el registro de la base de datos.
   */
  async cancelBySource(
    type: ReminderType,
    sourceId: string,
  ): Promise<void> {
    await this.reminderRepository.update(
      {
        type,
        sourceId,
        status: ReminderStatus.PENDING,
        isDeleted: false,
      },
      {
        status: ReminderStatus.CANCELLED,
      },
    );
  }

  /**
   * Reprograma un recordatorio: cancela los PENDING previos y crea el nuevo.
   */
  async reschedule(
    type: ReminderType,
    sourceId: string,
    newInput: ScheduleReminderInput,
  ): Promise<Reminder | null> {
    await this.cancelBySource(type, sourceId);
    return this.schedule(newInput);
  }

  /**
   * Obtiene los recordatorios pendientes futuros del usuario autenticado.
   */
  async findUpcoming(userId: string): Promise<Reminder[]> {
    return this.reminderRepository.find({
      where: {
        userId,
        status: ReminderStatus.PENDING,
        scheduledAt: MoreThan(new Date()),
        isDeleted: false,
      },
      order: {
        scheduledAt: 'ASC',
      },
    });
  }
}
