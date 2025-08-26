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
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

function isBcryptHash(value: string): boolean {
  try {
    return typeof bcrypt.getRounds(value) === 'number';
  } catch {
    return false;
  }
}

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
  emailVerificationToken?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  emailVerificationExpires?: Date | null;

  @Column({ nullable: true, select: false })
  @Index()
  @IsString()
  @IsOptional()
  @Exclude()
  passwordResetToken?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  passwordResetExpires?: Date | null;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  lockUntil: Date | null;

  @Column({ default: false })
  @IsBoolean()
  isLocked: boolean;

  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
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

  @BeforeInsert()
  async beforeInsertNormalizeAndHash(): Promise<void> {
    try {
      if (this.email) {
        this.email = this.email.trim().toLowerCase();
      }

      if (this.password) {
        if (!isBcryptHash(this.password)) {
          this.password = await bcrypt.hash(this.password, 12);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  @BeforeUpdate()
  async beforeUpdateNormalizeAndHash(): Promise<void> {
    try {
      if (this.email) {
        this.email = this.email.trim().toLowerCase();
      }

      if (this.password) {
        if (!isBcryptHash(this.password)) {
          this.password = await bcrypt.hash(this.password, 12);
        }
      }
    } catch (error) {
      throw error;
    }
  }


  setEmailVerificationToken(rawToken: string): void {
    const hashed = createHash('sha256').update(rawToken).digest('hex');
    this.emailVerificationToken = hashed;
  }

  setPasswordResetToken(rawToken: string): void {
    const hashed = createHash('sha256').update(rawToken).digest('hex');
    this.passwordResetToken = hashed;
  }

  clearEmailVerificationToken(): void {
    this.emailVerificationToken = null;
    this.emailVerificationExpires = null;
  }

  clearPasswordResetToken(): void {
    this.passwordResetToken = null;
    this.passwordResetExpires = null;
  }
}