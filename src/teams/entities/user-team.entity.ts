import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Team } from './team.entity';

export enum UserTeamRole {
  MEMBER = 'member',
  CAPTAIN = 'captain',
  ADMIN = 'admin',
}

export enum UserTeamStatus {
  ACTIVE = 'active',
  LEFT = 'left',
  KICKED = 'kicked',
}

@Entity('user_teams')
export class UserTeam {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  teamId: number;

  @ManyToOne(() => Team, (team) => team.userTeams)
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({
    type: 'enum',
    enum: UserTeamRole,
    default: UserTeamRole.MEMBER,
  })
  role: UserTeamRole;

  @Column({
    type: 'enum',
    enum: UserTeamStatus,
    default: UserTeamStatus.ACTIVE,
  })
  status: UserTeamStatus;

  @Column({ default: 0 })
  contributedScore: number;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  leftAt?: Date;
}
