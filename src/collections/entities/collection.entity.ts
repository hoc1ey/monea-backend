import {
  Entity,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { CollectionInstallment } from './collection-installment.entity.js';
import { CollectionStatus } from '../collections.constants.js';

@Entity('collections')
@Index(['userId', 'isDeleted'])
@Index(['userId', 'status', 'isDeleted'])
export class Collection extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.collections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 80 })
  personName: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @Column({ type: 'smallint' })
  installmentsCount: number;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  reminderEnabled: boolean;

  @Column({
    type: 'enum',
    enum: RecurrenceFrequency,
    nullable: true,
    default: null,
  })
  reminderFrequency: RecurrenceFrequency | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  reminderDayOfWeek: number | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  reminderDayOfMonth: number | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  reminderMonth: number | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  reminderAt: Date | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  reminderHour: number | null;

  @Column({
    type: 'enum',
    enum: CollectionStatus,
    default: CollectionStatus.PENDING,
  })
  status: CollectionStatus;

  @OneToMany(
    () => CollectionInstallment,
    (installment) => installment.collection,
  )
  installments: Relation<CollectionInstallment[]>;
}
