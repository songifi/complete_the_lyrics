import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsDate } from 'class-validator';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  @IsEmail()
  email: string;

  @Column({ unique: true })
  @Index()
  @IsString()
  @MinLength(3)
  username: string;

  @Column({ select: false })
  @Exclude()
  @IsString()
  @MinLength(8)
  password: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  firstName?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  lastName?: string;

  @Column({ default: false })
  @IsBoolean()
  isEmailVerified: boolean;

  @Column({ nullable: true, select: false })
  @Index()
  @IsString()
  @IsOptional()
  @Exclude()
  emailVerificationToken?: string;

  @Column({ nullable: true })
  @IsDate()
  @IsOptional()
  emailVerificationExpires?: Date;

  @Column({ nullable: true, select: false })
  @Index()
  @IsString()
  @IsOptional()
  @Exclude()
  passwordResetToken?: string;

  @Column({ nullable: true })
  @IsDate()
  @IsOptional()
  passwordResetExpires?: Date;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ nullable: true })
  @IsDate()
  @IsOptional()
  lockUntil?: Date;

  @Column({ default: false })
  @IsBoolean()
  isLocked: boolean;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @Column({ nullable: true })
  @IsDate()
  @IsOptional()
  lastLoginAt?: Date;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  lastLoginIp?: string;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  oauthProviders?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  preferences?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isLockedOut(): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date());
  }

  incrementLoginAttempts(): void {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours lockout
      this.isLocked = true;
    }
  }

  resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.isLocked = false;
  }

  getFullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || this.username;
  }
}
