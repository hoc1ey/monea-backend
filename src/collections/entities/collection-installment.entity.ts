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
import { Collection } from './collection.entity.js';

@Entity('collection_installments')
@Index(['userId', 'isDeleted'])
@Index(['collectionId', 'isDeleted'])
export class CollectionInstallment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.collectionInstallments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  collectionId: string;

  @ManyToOne(() => Collection, (collection) => collection.installments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'collectionId' })
  collection: Relation<Collection>;

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
