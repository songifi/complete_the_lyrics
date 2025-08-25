import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ select: false, unique: true })
  @Index({ unique: true })
  tokenHash: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column({ nullable: true })
  revokedBy?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt: Date;

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isActive(): boolean {
    return !this.isExpired() && !this.isRevoked;
  }

  revoke(revokedBy?: string): void {
    this.isRevoked = true;
    this.revokedAt = new Date();
    this.revokedBy = revokedBy;
  }
}
