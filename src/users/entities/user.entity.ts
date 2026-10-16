import { Entity, Column, Index, OneToMany, type Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { RefreshToken } from '../../auth/entities/refresh-token.entity.js';
import { Account } from '../../accounts/entities/account.entity.js';
import { DeviceToken } from '../../notifications/entities/device-token.entity.js';
import { Reminder } from '../../notifications/entities/reminder.entity.js';
import { Income } from '../../incomes/entities/income.entity.js';
import { CreditCard } from '../../credit-cards/entities/credit-card.entity.js';
import { Expense } from '../../expenses/entities/expense.entity.js';
import { ExpenseInstallment } from '../../expenses/entities/expense-installment.entity.js';
import { RecurringExpenseConfig } from '../../recurring-expenses/entities/recurring-expense-config.entity.js';
import { Collection } from '../../collections/entities/collection.entity.js';
import { CollectionInstallment } from '../../collections/entities/collection-installment.entity.js';

@Entity('users')
@Index('UQ_users_email_isDeleted', ['email'], { unique: true, where: '"isDeleted" = false' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'America/Bogota' })
  timezone: string;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastLoginAt: Date | null;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: Relation<RefreshToken[]>;

  @OneToMany(() => Account, (account) => account.user)
  accounts: Relation<Account[]>;

  @OneToMany(() => DeviceToken, (deviceToken) => deviceToken.user)
  deviceTokens: Relation<DeviceToken[]>;

  @OneToMany(() => Reminder, (reminder) => reminder.user)
  reminders: Relation<Reminder[]>;

  @OneToMany(() => Income, (income) => income.user)
  incomes: Relation<Income[]>;

  @OneToMany(() => CreditCard, (card) => card.user)
  creditCards: Relation<CreditCard[]>;

  @OneToMany(() => Expense, (expense) => expense.user)
  expenses: Relation<Expense[]>;

  @OneToMany(() => ExpenseInstallment, (installment) => installment.user)
  expenseInstallments: Relation<ExpenseInstallment[]>;

  @OneToMany(
    () => RecurringExpenseConfig,
    (config) => config.user,
  )
  recurringExpenseConfigs: Relation<RecurringExpenseConfig[]>;

  @OneToMany(() => Collection, (collection) => collection.user)
  collections: Relation<Collection[]>;

  @OneToMany(
    () => CollectionInstallment,
    (installment) => installment.user,
  )
  collectionInstallments: Relation<CollectionInstallment[]>;
}
