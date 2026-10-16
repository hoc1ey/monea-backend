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
import { ExpenseInstallment } from '../../expenses/entities/expense-installment.entity.js';
import { CreditCard } from './credit-card.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity('credit_card_payments')
@Index(['userId', 'isDeleted'])
@Index(['creditCardId', 'isDeleted'])
@Index('UQ_credit_card_payments_card_period_active', ['creditCardId', 'period'], {
  unique: true,
  where: '"isDeleted" = false',
})
export class CreditCardPayment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  creditCardId: string;

  @ManyToOne(() => CreditCard, (card) => card.payments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'creditCardId' })
  creditCard: Relation<CreditCard>;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account>;

  @Column({ type: 'uuid' })
  expenseId: string;

  @ManyToOne(() => Expense, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expenseId' })
  expense: Relation<Expense>;

  @Column({ type: 'char', length: 7 })
  period: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'timestamptz' })
  paidAt: Date;

  @OneToMany(() => ExpenseInstallment, (installment) => installment.cardPayment)
  installments: Relation<ExpenseInstallment[]>;
}
