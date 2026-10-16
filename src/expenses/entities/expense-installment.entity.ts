import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { CreditCard } from '../../credit-cards/entities/credit-card.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { Expense } from './expense.entity.js';

@Entity('expense_installments')
@Index(['userId', 'isDeleted'])
@Index(['expenseId', 'isDeleted'])
@Index(['creditCardId', 'period', 'isDeleted'])
export class ExpenseInstallment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.expenseInstallments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => Expense, (expense) => expense.expenseInstallments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'expenseId' })
  expense: Relation<Expense>;

  @Index()
  @Column({ type: 'uuid' })
  creditCardId: string;

  @ManyToOne(() => CreditCard, (card) => card.installments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'creditCardId' })
  creditCard: Relation<CreditCard>;

  @Column({ type: 'smallint' })
  number: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'char', length: 7 })
  period: string;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @Column({ type: 'uuid', nullable: true, default: null })
  cardPaymentId: string | null;
}
