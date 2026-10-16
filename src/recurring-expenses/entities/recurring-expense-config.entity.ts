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
import { ReminderOffset } from '../recurring-expenses.constants.js';

@Entity('recurring_expense_configs')
@Index(['userId', 'isDeleted'])
@Index(['isActive', 'isDeleted', 'nextRunAt'])
export class RecurringExpenseConfig extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.recurringExpenseConfigs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, (account) => account.recurringExpenseConfigs, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account>;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    nullable: true,
    default: null,
  })
  amount: number | null;

  @Column({ type: 'boolean', default: false })
  isVariableAmount: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  description: string | null;

  @Column({ type: 'enum', enum: RecurrenceFrequency })
  frequency: RecurrenceFrequency;

  @Column({ type: 'smallint', nullable: true, default: null })
  dayOfWeek: number | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  dayOfMonth: number | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  monthOfYear: number | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true, default: null })
  endDate: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Index()
  @Column({ type: 'timestamptz' })
  nextRunAt: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastGeneratedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  reminderEnabled: boolean;

  @Column({
    type: 'enum',
    enum: ReminderOffset,
    nullable: true,
    default: null,
  })
  reminderOffset: ReminderOffset | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  reminderHour: number | null;

  @OneToMany(() => Expense, (expense) => expense.recurringConfig)
  expenses: Relation<Expense[]>;
}
