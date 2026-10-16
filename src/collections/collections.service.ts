import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  In,
} from 'typeorm';
import { Collection } from './entities/collection.entity.js';
import { CollectionInstallment } from './entities/collection-installment.entity.js';
import { CreateCollectionDto } from './dto/create-collection.dto.js';
import { UpdateCollectionDto } from './dto/update-collection.dto.js';
import { QueryCollectionDto } from './dto/query-collection.dto.js';
import { PayCollectionInstallmentDto } from './dto/pay-installment.dto.js';
import { CollectionStatus } from './collections.constants.js';
import {
  InstallmentReminderConfig,
  InstallmentScheduleBuilder,
} from '../common/utils/installment-schedule.builder.js';
import { RecurrenceFrequency } from '../common/utils/recurrence.util.js';
import { MoneyUtil } from '../common/utils/money.util.js';
import { ReminderService } from '../notifications/reminder.service.js';
import { ReminderType } from '../notifications/notifications.constants.js';
import { UsersService } from '../users/users.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { IncomesService } from '../incomes/incomes.service.js';
import { IncomeSourceType } from '../incomes/incomes.constants.js';

interface ReminderFields {
  reminderFrequency: RecurrenceFrequency | null;
  reminderDayOfWeek: number | null;
  reminderDayOfMonth: number | null;
  reminderMonth: number | null;
  reminderAt: string | null;
  reminderHour: number | null;
}

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    protected readonly collectionRepository: Repository<Collection>,
    @InjectRepository(CollectionInstallment)
    protected readonly installmentRepository: Repository<CollectionInstallment>,
    private readonly dataSource: DataSource,
    private readonly reminderService: ReminderService,
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly incomesService: IncomesService,
  ) {}

  /**
   * Crea un cobro, genera su plan de cuotas (último = residuo) y programa un
   * recordatorio por cada cuota pendiente.
   */
  async create(userId: string, dto: CreateCollectionDto) {
    const timezone = await this.getTimezone(userId);
    const reminderEnabled = dto.reminderEnabled ?? false;

    const fields = this.fieldsFromCreateDto(dto);
    this.validateCreateReminder(dto, fields, reminderEnabled);

    const collection = this.collectionRepository.create({
      userId,
      personName: dto.personName,
      totalAmount: dto.totalAmount,
      installmentsCount: dto.installmentsCount,
      description: dto.description ?? null,
      reminderEnabled: false,
      reminderFrequency: null,
      reminderDayOfWeek: null,
      reminderDayOfMonth: null,
      reminderMonth: null,
      reminderAt: null,
      reminderHour: null,
      status: CollectionStatus.PENDING,
    });
    this.assignReminderFields(
      collection,
      dto.installmentsCount,
      fields,
      reminderEnabled,
    );

    const savedCollection = await this.collectionRepository.save(collection);
    const savedInstallments = await this.createInstallments(
      savedCollection,
      timezone,
    );

    await this.scheduleReminders(
      savedCollection,
      savedInstallments,
      timezone,
    );

    return {
      data: { ...savedCollection, installments: savedInstallments },
      message: 'Cobro registrado correctamente',
    };
  }

  /**
   * Lista los cobros del usuario con `paidAmount` y `pendingAmount`, con filtro
   * opcional por estado.
   */
  async findAll(userId: string, query: QueryCollectionDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .where('collection.userId = :userId', { userId })
      .andWhere('collection.isDeleted = false')
      .orderBy('collection.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('collection.status = :status', { status: query.status });
    }

    const collections = await qb.getMany();

    if (collections.length === 0) {
      return {
        data: [],
        message: 'Cobros obtenidos correctamente',
      };
    }

    const installments = await this.installmentRepository.find({
      where: {
        collectionId: In(collections.map((collection) => collection.id)),
        isDeleted: false,
      },
    });

    const paidMap = new Map<string, number>();
    const pendingMap = new Map<string, number>();
    for (const installment of installments) {
      const target = installment.isPaid ? paidMap : pendingMap;
      target.set(
        installment.collectionId,
        MoneyUtil.round(
          MoneyUtil.add(target.get(installment.collectionId) ?? 0, installment.amount),
        ),
      );
    }

    const data = collections.map((collection) => ({
      ...collection,
      paidAmount: paidMap.get(collection.id) ?? 0,
      pendingAmount: pendingMap.get(collection.id) ?? 0,
    }));

    return {
      data,
      message: 'Cobros obtenidos correctamente',
    };
  }

  /**
   * Obtiene un cobro con sus cuotas activas.
   */
  async findOne(userId: string, id: string) {
    const collection = await this.assertOwnership(userId, id);
    const installments = await this.getInstallments(collection.id);

    return {
      data: { ...collection, installments },
      message: 'Cobro obtenido correctamente',
    };
  }

  /**
   * Actualiza un cobro.
   * - Con cuotas pagadas: solo `personName`, `description` y recordatorio.
   * - Sin cuotas pagadas: permite cambiar monto/cuotas (regenera el plan).
   */
  async update(userId: string, id: string, dto: UpdateCollectionDto) {
    const collection = await this.assertOwnership(userId, id);
    const existingInstallments = await this.getInstallments(collection.id);
    const hasPaid = existingInstallments.some((installment) => installment.isPaid);
    const timezone = await this.getTimezone(userId);

    if (
      hasPaid &&
      (dto.totalAmount !== undefined || dto.installmentsCount !== undefined)
    ) {
      throw new BadRequestException(
        'No se puede modificar el monto ni las cuotas de un cobro con cuotas pagadas',
      );
    }

    const oldTotal = collection.totalAmount;
    const oldCount = collection.installmentsCount;
    const newTotal = dto.totalAmount ?? oldTotal;
    const newCount = dto.installmentsCount ?? oldCount;
    const reminderEnabled = dto.reminderEnabled ?? collection.reminderEnabled;
    const reminderChanged =
      dto.reminderEnabled !== undefined ||
      dto.reminderFrequency !== undefined ||
      dto.reminderDayOfWeek !== undefined ||
      dto.reminderDayOfMonth !== undefined ||
      dto.reminderMonth !== undefined ||
      dto.reminderAt !== undefined ||
      dto.reminderHour !== undefined;

    const fields: ReminderFields = {
      reminderFrequency:
        dto.reminderFrequency !== undefined
          ? (dto.reminderFrequency ?? null)
          : collection.reminderFrequency,
      reminderDayOfWeek:
        dto.reminderDayOfWeek !== undefined
          ? (dto.reminderDayOfWeek ?? null)
          : collection.reminderDayOfWeek,
      reminderDayOfMonth:
        dto.reminderDayOfMonth !== undefined
          ? (dto.reminderDayOfMonth ?? null)
          : collection.reminderDayOfMonth,
      reminderMonth:
        dto.reminderMonth !== undefined
          ? (dto.reminderMonth ?? null)
          : collection.reminderMonth,
      reminderAt:
        dto.reminderAt !== undefined
          ? (dto.reminderAt ?? null)
          : (collection.reminderAt ? collection.reminderAt.toISOString() : null),
      reminderHour:
        dto.reminderHour !== undefined
          ? (dto.reminderHour ?? null)
          : collection.reminderHour,
    };

    this.validateUpdateReminder(newCount, dto, fields, reminderEnabled);

    if (dto.personName !== undefined) {
      collection.personName = dto.personName;
    }
    if (dto.description !== undefined) {
      collection.description = dto.description ?? null;
    }
    collection.totalAmount = newTotal;
    collection.installmentsCount = newCount;
    this.assignReminderFields(collection, newCount, fields, reminderEnabled);

    const rebuild =
      !hasPaid && (newTotal !== oldTotal || newCount !== oldCount);

    if (rebuild) {
      for (const installment of existingInstallments) {
        installment.isDeleted = true;
        installment.deletedAt = new Date();
      }
      if (existingInstallments.length > 0) {
        await this.installmentRepository.save(existingInstallments);
        await this.cancelReminders(existingInstallments);
      }

      collection.status = CollectionStatus.PENDING;
      const savedCollection = await this.collectionRepository.save(collection);
      const savedInstallments = await this.createInstallments(
        savedCollection,
        timezone,
      );
      await this.scheduleReminders(savedCollection, savedInstallments, timezone);

      return {
        data: { ...savedCollection, installments: savedInstallments },
        message: 'Cobro actualizado correctamente',
      };
    }

    const savedCollection = await this.collectionRepository.save(collection);

    if (reminderChanged) {
      const pending = existingInstallments.filter(
        (installment) => !installment.isPaid,
      );

      if (pending.length > 0) {
        const plan = InstallmentScheduleBuilder.build({
          totalAmount: savedCollection.totalAmount,
          installments: savedCollection.installmentsCount,
          baseDate: new Date(),
          timezone,
          reminder: this.toReminderConfig(savedCollection),
        });
        const dueByNumber = new Map(plan.map((item) => [item.number, item.dueDate]));

        for (const installment of pending) {
          installment.dueDate = dueByNumber.get(installment.number) ?? null;
        }

        await this.installmentRepository.save(pending);
        await this.cancelReminders(pending);
        await this.scheduleReminders(savedCollection, pending, timezone);
      }
    }

    return {
      data: {
        ...savedCollection,
        installments: await this.getInstallments(savedCollection.id),
      },
      message: 'Cobro actualizado correctamente',
    };
  }

  /**
   * Borrado lógico del cobro y cancelación de sus recordatorios.
   * Los ingresos ya generados se conservan.
   */
  async remove(userId: string, id: string) {
    const collection = await this.assertOwnership(userId, id);
    const installments = await this.getInstallments(collection.id);

    collection.isDeleted = true;
    collection.deletedAt = new Date();
    await this.collectionRepository.save(collection);
    await this.cancelReminders(installments);

    return {
      data: null,
      message: 'Cobro eliminado correctamente',
    };
  }

  /**
   * Paga una cuota: crea el ingreso (`COLLECTION_INSTALLMENT`) en la cuenta
   * indicada, marca la cuota, cancela su recordatorio y recalcula el estado.
   * Todo el movimiento monetario ocurre en una transacción.
   */
  async payInstallment(
    userId: string,
    collectionId: string,
    installmentId: string,
    dto: PayCollectionInstallmentDto,
  ) {
    const collection = await this.assertOwnership(userId, collectionId);

    const installment = await this.installmentRepository.findOne({
      where: { id: installmentId, collectionId, userId, isDeleted: false },
    });

    if (!installment) {
      throw new NotFoundException('Cuota no encontrada');
    }

    if (installment.isPaid) {
      throw new BadRequestException('La cuota ya fue pagada');
    }

    await this.accountsService.assertOwnership(userId, dto.accountId);

    const paidAt = new Date();

    const status = await this.dataSource.transaction(async (manager) => {
      const income = await this.incomesService.createFromSource(
        userId,
        {
          accountId: dto.accountId,
          name:
            dto.name ??
            `Cobro ${collection.personName} (${installment.number}/${collection.installmentsCount})`,
          amount: installment.amount,
          description: dto.description ?? collection.description,
          date: paidAt,
          sourceType: IncomeSourceType.COLLECTION_INSTALLMENT,
          sourceId: installment.id,
        },
        manager,
      );

      installment.isPaid = true;
      installment.paidAt = paidAt;
      installment.incomeId = income.id;
      await manager.getRepository(CollectionInstallment).save(installment);

      const collectionStatus = await this.recalculateStatus(
        collection.id,
        manager,
      );
      collection.status = collectionStatus;
      await manager.getRepository(Collection).save(collection);

      return collectionStatus;
    });

    await this.reminderService.cancelBySource(
      ReminderType.COLLECTION,
      installment.id,
    );

    return {
      data: {
        installment: {
          number: installment.number,
          amount: installment.amount,
          isPaid: installment.isPaid,
          paidAt: installment.paidAt,
          incomeId: installment.incomeId,
        },
        collectionStatus: status,
      },
      message: 'Cuota pagada correctamente',
    };
  }

  /**
   * Valida que el cobro exista, no esté eliminado y pertenezca al usuario.
   */
  async assertOwnership(userId: string, id: string): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id, userId, isDeleted: false },
    });

    if (!collection) {
      throw new NotFoundException('Cobro no encontrado');
    }

    return collection;
  }

  /**
   * Recalcula el estado del cobro según sus cuotas activas.
   */
  private async recalculateStatus(
    collectionId: string,
    manager?: EntityManager,
  ): Promise<CollectionStatus> {
    const repo = manager
      ? manager.getRepository(CollectionInstallment)
      : this.installmentRepository;

    const installments = await repo.find({
      where: { collectionId, isDeleted: false },
    });

    if (installments.length === 0) {
      return CollectionStatus.PENDING;
    }

    const paidCount = installments.filter(
      (installment) => installment.isPaid,
    ).length;

    if (paidCount === 0) {
      return CollectionStatus.PENDING;
    }
    if (paidCount === installments.length) {
      return CollectionStatus.PAID;
    }
    return CollectionStatus.PARTIAL;
  }

  private async createInstallments(
    collection: Collection,
    timezone: string,
  ): Promise<CollectionInstallment[]> {
    const plan = InstallmentScheduleBuilder.build({
      totalAmount: collection.totalAmount,
      installments: collection.installmentsCount,
      baseDate: new Date(),
      timezone,
      reminder: this.toReminderConfig(collection),
    });

    const installments = plan.map((item) =>
      this.installmentRepository.create({
        userId: collection.userId,
        collectionId: collection.id,
        number: item.number,
        amount: item.amount,
        dueDate: item.dueDate,
        isPaid: false,
        paidAt: null,
        incomeId: null,
      }),
    );

    return this.installmentRepository.save(installments);
  }

  private async getInstallments(
    collectionId: string,
  ): Promise<CollectionInstallment[]> {
    return this.installmentRepository.find({
      where: { collectionId, isDeleted: false },
      order: { number: 'ASC' },
    });
  }

  private async scheduleReminders(
    collection: Collection,
    installments: CollectionInstallment[],
    _timezone: string,
  ): Promise<void> {
    if (!collection.reminderEnabled) {
      return;
    }

    for (const installment of installments) {
      if (installment.isPaid || !installment.dueDate) {
        continue;
      }

      await this.reminderService.reschedule(
        ReminderType.COLLECTION,
        installment.id,
        {
          userId: collection.userId,
          type: ReminderType.COLLECTION,
          sourceId: installment.id,
          title: `Cobro a ${collection.personName}`,
          body: `Se aproxima la cuota ${installment.number}/${collection.installmentsCount} del cobro a ${collection.personName} por ${installment.amount}.`,
          scheduledAt: installment.dueDate,
        },
      );
    }
  }

  private async cancelReminders(
    installments: CollectionInstallment[],
  ): Promise<void> {
    for (const installment of installments) {
      await this.reminderService.cancelBySource(
        ReminderType.COLLECTION,
        installment.id,
      );
    }
  }

  private toReminderConfig(collection: Collection): InstallmentReminderConfig {
    return {
      enabled: collection.reminderEnabled,
      frequency: collection.reminderFrequency,
      dayOfWeek: collection.reminderDayOfWeek,
      dayOfMonth: collection.reminderDayOfMonth,
      monthOfYear: collection.reminderMonth,
      at: collection.reminderAt,
      hour: collection.reminderHour,
    };
  }

  private fieldsFromCreateDto(dto: CreateCollectionDto): ReminderFields {
    return {
      reminderFrequency: dto.reminderFrequency ?? null,
      reminderDayOfWeek: dto.reminderDayOfWeek ?? null,
      reminderDayOfMonth: dto.reminderDayOfMonth ?? null,
      reminderMonth: dto.reminderMonth ?? null,
      reminderAt: dto.reminderAt ?? null,
      reminderHour: dto.reminderHour ?? null,
    };
  }

  private assignReminderFields(
    collection: Collection,
    installmentsCount: number,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    if (!reminderEnabled) {
      collection.reminderEnabled = false;
      collection.reminderFrequency = null;
      collection.reminderDayOfWeek = null;
      collection.reminderDayOfMonth = null;
      collection.reminderMonth = null;
      collection.reminderAt = null;
      collection.reminderHour = null;
      return;
    }

    collection.reminderEnabled = true;

    if (installmentsCount === 1) {
      collection.reminderFrequency = null;
      collection.reminderDayOfWeek = null;
      collection.reminderDayOfMonth = null;
      collection.reminderMonth = null;
      collection.reminderHour = null;
      collection.reminderAt = fields.reminderAt
        ? new Date(fields.reminderAt)
        : null;
      return;
    }

    collection.reminderAt = null;
    collection.reminderFrequency = fields.reminderFrequency;
    collection.reminderDayOfWeek = fields.reminderDayOfWeek;
    collection.reminderDayOfMonth = fields.reminderDayOfMonth;
    collection.reminderMonth = fields.reminderMonth;
    collection.reminderHour = fields.reminderHour;
  }

  /**
   * Reglas de recordatorio en la creación: campos prohibidos según el número de
   * cuotas (aunque `reminderEnabled` no se envíe) y campos obligatorios cuando
   * el recordatorio está activo.
   */
  private validateCreateReminder(
    dto: CreateCollectionDto,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    const hasRecurrenceFields =
      dto.reminderFrequency != null ||
      dto.reminderDayOfWeek != null ||
      dto.reminderDayOfMonth != null ||
      dto.reminderMonth != null ||
      dto.reminderHour != null;

    if (dto.installmentsCount === 1 && hasRecurrenceFields) {
      throw new BadRequestException(
        'Una cuota única con recordatorio debe usar reminderAt',
      );
    }

    if (dto.installmentsCount > 1 && dto.reminderAt != null) {
      throw new BadRequestException(
        'reminderAt solo aplica a un cobro de una cuota única',
      );
    }

    if (dto.reminderAt != null) {
      this.assertWholeHour(dto.reminderAt);
    }

    if (reminderEnabled) {
      this.validateReminderRequired(dto.installmentsCount, fields);
    }
  }

  /**
   * Reglas de recordatorio en la actualización: campos prohibidos según el nuevo
   * número de cuotas y campos obligatorios combinando los valores vigentes.
   */
  private validateUpdateReminder(
    installmentsCount: number,
    dto: UpdateCollectionDto,
    fields: ReminderFields,
    reminderEnabled: boolean,
  ): void {
    const recurrenceProvided =
      dto.reminderFrequency !== undefined ||
      dto.reminderDayOfWeek !== undefined ||
      dto.reminderDayOfMonth !== undefined ||
      dto.reminderMonth !== undefined ||
      dto.reminderHour !== undefined;

    if (installmentsCount === 1 && recurrenceProvided) {
      throw new BadRequestException(
        'Una cuota única con recordatorio debe usar reminderAt',
      );
    }

    if (installmentsCount > 1 && dto.reminderAt !== undefined) {
      throw new BadRequestException(
        'reminderAt solo aplica a un cobro de una cuota única',
      );
    }

    if (dto.reminderAt) {
      this.assertWholeHour(dto.reminderAt);
    }

    if (reminderEnabled) {
      this.validateReminderRequired(installmentsCount, fields);
    }
  }

  private validateReminderRequired(
    installmentsCount: number,
    fields: ReminderFields,
  ): void {
    if (installmentsCount === 1) {
      if (!fields.reminderAt) {
        throw new BadRequestException(
          'reminderAt es obligatorio para una cuota única con recordatorio',
        );
      }
      return;
    }

    if (fields.reminderFrequency == null) {
      throw new BadRequestException(
        'La frecuencia del recordatorio es obligatoria para varias cuotas',
      );
    }

    if (
      fields.reminderFrequency === RecurrenceFrequency.WEEKLY &&
      fields.reminderDayOfWeek == null
    ) {
      throw new BadRequestException(
        'reminderDayOfWeek es obligatorio para la frecuencia WEEKLY',
      );
    }

    if (
      fields.reminderFrequency === RecurrenceFrequency.MONTHLY &&
      fields.reminderDayOfMonth == null
    ) {
      throw new BadRequestException(
        'reminderDayOfMonth es obligatorio para la frecuencia MONTHLY',
      );
    }

    if (
      fields.reminderFrequency === RecurrenceFrequency.YEARLY &&
      fields.reminderMonth == null
    ) {
      throw new BadRequestException(
        'reminderMonth es obligatorio para la frecuencia YEARLY',
      );
    }

    if (fields.reminderHour == null) {
      throw new BadRequestException(
        'La hora del recordatorio es obligatoria para varias cuotas',
      );
    }
  }

  private assertWholeHour(value: string): void {
    const at = new Date(value);
    if (
      at.getUTCMinutes() !== 0 ||
      at.getUTCSeconds() !== 0 ||
      at.getUTCMilliseconds() !== 0
    ) {
      throw new BadRequestException(
        'reminderAt solo admite hora exacta (minutos y segundos en 0)',
      );
    }
  }

  private async getTimezone(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);
    return user.timezone || 'America/Bogota';
  }
}
