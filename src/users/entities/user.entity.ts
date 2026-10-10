import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { RefreshToken } from '../../auth/entities/refresh-token.entity.js';

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
  refreshTokens: RefreshToken[];
}
