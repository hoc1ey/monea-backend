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
import { Account } from '../../accounts/entities/account.entity.js';
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';

@Entity('transfers')
@Index(['userId', 'isDeleted', 'date'])
@Index(['sourceAccountId', 'isDeleted'])
@Index(['destinationAccountId', 'isDeleted'])
export class Transfer extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  sourceAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sourceAccountId' })
  sourceAccount: Relation<Account>;

  @Index()
  @Column({ type: 'uuid' })
  destinationAccountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destinationAccountId' })
  destinationAccount: Relation<Account>;

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

  @Column({ type: 'uuid', nullable: true, default: null })
  expenseId: string | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  incomeId: string | null;
}
