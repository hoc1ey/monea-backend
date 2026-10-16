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
import { Income } from '../../incomes/entities/income.entity.js';
import { Expense } from '../../expenses/entities/expense.entity.js';
import { RecurringExpenseConfig } from '../../recurring-expenses/entities/recurring-expense-config.entity.js';
import { Loan } from '../../loans/entities/loan.entity.js';

@Entity('accounts')
@Index(['userId', 'isDeleted'])
export class Account extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  financialInstitution: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  initialBalance: number;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  description: string | null;

  @OneToMany(() => Income, (income) => income.account)
  incomes: Relation<Income[]>;

  @OneToMany(() => Expense, (expense) => expense.account)
  expenses: Relation<Expense[]>;

  @OneToMany(
    () => RecurringExpenseConfig,
    (config) => config.account,
  )
  recurringExpenseConfigs: Relation<RecurringExpenseConfig[]>;

  @OneToMany(() => Loan, (loan) => loan.account)
  loans: Relation<Loan[]>;
}
