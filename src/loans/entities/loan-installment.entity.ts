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
import { Income } from '../../incomes/entities/income.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { Loan } from './loan.entity.js';

@Entity('loan_installments')
@Index(['userId', 'isDeleted'])
@Index(['loanId', 'isDeleted'])
export class LoanInstallment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.loanInstallments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  loanId: string;

  @ManyToOne(() => Loan, (loan) => loan.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: Relation<Loan>;

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
  incomeId: string | null;

  @ManyToOne(() => Income, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'incomeId' })
  income: Relation<Income | null>;
}
