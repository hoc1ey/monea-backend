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
import { Expense } from '../../expenses/entities/expense.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { Debt } from './debt.entity.js';

@Entity('debt_installments')
@Index(['userId', 'isDeleted'])
@Index(['debtId', 'isDeleted'])
export class DebtInstallment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.debtInstallments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  debtId: string;

  @ManyToOne(() => Debt, (debt) => debt.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debtId' })
  debt: Relation<Debt>;

  @Column({ type: 'smallint' })
  number: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  dueDate: Date | null;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  paidAt: Date | null;

  @Index()
  @Column({ type: 'uuid', nullable: true, default: null })
  expenseId: string | null;

  @ManyToOne(() => Expense, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'expenseId' })
  expense: Relation<Expense | null>;
}
