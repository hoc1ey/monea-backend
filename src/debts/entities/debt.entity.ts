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
import { DebtInstallment } from './debt-installment.entity.js';
import { DebtStatus } from '../debts.constants.js';

@Entity('debts')
@Index(['userId', 'isDeleted'])
@Index(['userId', 'status', 'isDeleted'])
export class Debt extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.debts, { onDelete: 'CASCADE' })
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

  @Column({ type: 'enum', enum: DebtStatus, default: DebtStatus.PENDING })
  status: DebtStatus;

  @OneToMany(() => DebtInstallment, (installment) => installment.debt)
  installments: Relation<DebtInstallment[]>;
}
