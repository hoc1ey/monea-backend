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
import { decimalTransformer } from '../../common/transformers/decimal.transformer.js';
import { ShoppingList } from './shopping-list.entity.js';

@Entity('shopping_list_items')
@Index(['userId', 'isDeleted'])
@Index(['listId', 'isDeleted'])
export class ShoppingListItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.shoppingListItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  listId: string;

  @ManyToOne(() => ShoppingList, (list) => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: Relation<ShoppingList>;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'boolean', default: false })
  isPurchased: boolean;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    nullable: true,
    default: null,
  })
  price: number | null;
}
