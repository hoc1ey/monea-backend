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
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { ShoppingListItem } from './shopping-list-item.entity.js';
import { ShoppingListStatus } from '../shopping-lists.constants.js';

@Entity('shopping_lists')
@Index(['userId', 'isDeleted'])
@Index(['userId', 'status', 'isDeleted'])
export class ShoppingList extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.shoppingLists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({
    type: 'enum',
    enum: ShoppingListStatus,
    default: ShoppingListStatus.OPEN,
  })
  status: ShoppingListStatus;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  closedAt: Date | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    nullable: true,
    default: null,
  })
  total: number | null;

  @Index()
  @Column({ type: 'uuid', nullable: true, default: null })
  accountId: string | null;

  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accountId' })
  account: Relation<Account | null>;

  @Index()
  @Column({ type: 'uuid', nullable: true, default: null })
  expenseId: string | null;

  @ManyToOne(() => Expense, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'expenseId' })
  expense: Relation<Expense | null>;

  @OneToMany(() => ShoppingListItem, (item) => item.list)
  items: Relation<ShoppingListItem[]>;
}
