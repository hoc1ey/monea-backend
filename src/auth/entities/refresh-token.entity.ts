import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  familyId: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  replacedByTokenId: string | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  ip: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  userAgent: string;
}
