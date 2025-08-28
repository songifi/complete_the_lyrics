import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { UserProfile } from './user-profile.entity';

@Entity('user_preferences')
@Unique(['userProfileId', 'key'])
@Index(['userProfileId', 'key'])
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userProfileId' })
  userProfile: UserProfile;

  @Column()
  @Index()
  userProfileId: string;

  @Column()
  @IsString()
  key: string;

  @Column({ type: 'text' })
  @IsString()
  value: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Column({ default: 'string' })
  @IsString()
  type: 'string' | 'number' | 'boolean' | 'json';

  @Column({ default: false })
  isSystem: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Helper methods
  getTypedValue(): any {
    switch (this.type) {
      case 'number':
        return Number(this.value);
      case 'boolean':
        return this.value === 'true';
      case 'json':
        try {
          return JSON.parse(this.value);
        } catch {
          return this.value;
        }
      default:
        return this.value;
    }
  }

  setTypedValue(value: any): void {
    switch (this.type) {
      case 'number':
        this.value = String(value);
        break;
      case 'boolean':
        this.value = String(value);
        break;
      case 'json':
        this.value = JSON.stringify(value);
        break;
      default:
        this.value = String(value);
    }
  }

  static create(key: string, value: any, type: 'string' | 'number' | 'boolean' | 'json' = 'string', description?: string): Partial<UserPreference> {
    const preference = new UserPreference();
    preference.key = key;
    preference.type = type;
    preference.description = description;
    preference.setTypedValue(value);
    return preference;
  }
}
