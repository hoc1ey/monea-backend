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
import { CreditCard } from '../../credit-cards/entities/credit-card.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { ExpenseInstallment } from './expense-installment.entity.js';
import {
  ExpensePaymentMethod,
  ExpenseSourceType,
} from '../expenses.constants.js';

@Entity('expenses')
@Index(['userId', 'isDeleted', 'date'])
@Index(['accountId', 'isDeleted'])
@Index(['creditCardId', 'isDeleted'])
@Index(['sourceType', 'sourceId'])
export class Expense extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, (account) => account.expenses, {
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
  })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  description: string | null;

  @Index()
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({
    type: 'enum',
    enum: ExpensePaymentMethod,
    default: ExpensePaymentMethod.CORRIENTE,
  })
  paymentMethod: ExpensePaymentMethod;

  @Column({ type: 'uuid', nullable: true, default: null })
  creditCardId: string | null;

  @ManyToOne(() => CreditCard, (card) => card.expenses, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'creditCardId' })
  creditCard: Relation<CreditCard | null>;

  @Column({ type: 'smallint', nullable: true, default: null })
  installments: number | null;

  @Column({ type: 'smallint', default: 0 })
  graceMonths: number;

  @Column({ type: 'boolean', default: false })
  amountPending: boolean;

  @Column({ type: 'uuid', nullable: true, default: null })
  recurringConfigId: string | null;

  @Column({
    type: 'enum',
    enum: ExpenseSourceType,
    default: ExpenseSourceType.MANUAL,
  })
  sourceType: ExpenseSourceType;

  @Column({ type: 'uuid', nullable: true, default: null })
  sourceId: string | null;

  @OneToMany(() => ExpenseInstallment, (installment) => installment.expense)
  expenseInstallments: Relation<ExpenseInstallment[]>;
}
