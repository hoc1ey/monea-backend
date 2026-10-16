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
import { Account } from '../../accounts/entities/account.entity.js';
import { Expense } from '../../expenses/entities/expense.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { RecurrenceFrequency } from '../../common/utils/recurrence.util.js';
import { LoanInstallment } from './loan-installment.entity.js';
import { LoanStatus } from '../loans.constants.js';

@Entity('loans')
@Index(['userId', 'isDeleted'])
@Index(['userId', 'status', 'isDeleted'])
export class Loan extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.loans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, (account) => account.loans, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account>;

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

  @Index()
  @Column({ type: 'uuid', nullable: true, default: null })
  expenseId: string | null;

  @ManyToOne(() => Expense, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'expenseId' })
  expense: Relation<Expense | null>;

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

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.PENDING })
  status: LoanStatus;

  @OneToMany(() => LoanInstallment, (installment) => installment.loan)
  installments: Relation<LoanInstallment[]>;
}
