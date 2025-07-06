import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_stats')
@Index(['score'], { name: 'idx_user_stats_score' })
export class UserStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index('idx_user_stats_userId')
  userId: number;

  @Column({ default: 0 })
  totalAttempts: number;

  @Column({ default: 0 })
  correctAttempts: number;

  @Column({ default: 0 })
  score: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  accuracyRate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Calculate accuracy rate automatically
  calculateAccuracyRate(): number {
    if (this.totalAttempts === 0) return 0;
    return Math.round((this.correctAttempts / this.totalAttempts) * 100 * 100) / 100;
  }
}
