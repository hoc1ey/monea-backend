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
import {
  ReminderType,
  ReminderStatus,
} from '../notifications.constants.js';

@Entity('reminders')
@Index(['scheduledAt', 'status'])
@Index(['type', 'sourceId'])
@Index(['userId', 'status'])
export class Reminder extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({
    type: 'enum',
    enum: ReminderType,
  })
  type: ReminderType;

  @Column({ type: 'uuid' })
  sourceId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Index()
  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    default: ReminderStatus.PENDING,
  })
  status: ReminderStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  sentAt: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  lastError: string | null;
}
