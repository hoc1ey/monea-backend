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
import { DevicePlatform } from '../notifications.constants.js';

@Entity('device_tokens')
export class DeviceToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.deviceTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 500, unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: DevicePlatform,
    default: DevicePlatform.ANDROID,
  })
  platform: DevicePlatform;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastUsedAt: Date;
}
