import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column()
  createdByUserId: string;

  @Column({ default: 0 })
  totalScore: number;

  @Column({ default: 0 })
  memberCount: number;

  @OneToMany('UserTeam', 'team')
  userTeams: any[];

  @OneToMany('TeamScore', 'team')
  teamScores: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
