import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('player_reports')
export class PlayerReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporterId: string;

  @Column()
  reportedPlayerId: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  evidenceUrl: string;

  @Column({ type: 'enum', enum: ['cheating', 'abuse', 'spam', 'other'], default: 'other' })
  category: string;

  @Column({ type: 'enum', enum: ['low', 'medium', 'high'], default: 'medium' })
  priority: string;

  @Column({ type: 'enum', enum: ['pending', 'investigating', 'resolved', 'appealed'], default: 'pending' })
  status: string;

  @Column({ nullable: true })
  resolution: string;

  @Column({ nullable: true })
  appealReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  // Investigation workflow state tracking
  @Column({ type: 'json', nullable: true })
  investigationHistory: any;

  // Automated actions (warnings, suspensions)
  @Column({ type: 'json', nullable: true })
  automatedActions: any;

  // Analytics and pattern detection results
  @Column({ type: 'json', nullable: true })
  analytics: any;

  // Audit log for this report
  @Column({ type: 'json', nullable: true })
  auditLog: any;
}
