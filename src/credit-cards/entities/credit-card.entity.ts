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

@Entity('credit_cards')
@Index(['userId', 'isDeleted'])
export class CreditCard extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.creditCards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'varchar', length: 80 })
  issuer: string;

  @Column({ type: 'char', length: 4 })
  lastFourDigits: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    nullable: true,
    default: null,
  })
  creditLimit: number | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  cutoffDay: number | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  paymentDay: number | null;

  @Column({ type: 'boolean', default: false })
  reminderEnabled: boolean;

  @Column({ type: 'smallint', default: 1 })
  reminderDaysBefore: number;

  @Column({ type: 'smallint', default: 9 })
  reminderHour: number;
}
