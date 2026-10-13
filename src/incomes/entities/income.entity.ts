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
import { IncomeSourceType } from '../incomes.constants.js';

@Entity('incomes')
@Index(['userId', 'isDeleted', 'date'])
@Index(['accountId', 'isDeleted'])
@Index(['sourceType', 'sourceId'])
export class Income extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.incomes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, (account) => account.incomes, { onDelete: 'RESTRICT' })
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
    enum: IncomeSourceType,
    default: IncomeSourceType.MANUAL,
  })
  sourceType: IncomeSourceType;

  @Column({ type: 'uuid', nullable: true, default: null })
  sourceId: string | null;
}
