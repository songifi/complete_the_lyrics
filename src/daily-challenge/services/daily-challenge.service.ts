import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyChallenge } from '../entities/daily-challenge.entity';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRedis } from '@nestjs/redis';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class DailyChallengeService {
  private readonly logger = new Logger(DailyChallengeService.name);
  private readonly templatesPath = path.join(__dirname, '../templates/daily-challenge-templates.json');

  constructor(
    @InjectRepository(DailyChallenge)
    private readonly dailyChallengeRepo: Repository<DailyChallenge>,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectQueue('challenge-reward')
    private readonly rewardQueue: Queue,
  ) {}

  // Cron job to generate a new daily challenge at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyChallenge(): Promise<void> {
    this.logger.log('Generating new daily challenge...');
    const templates = this.loadTemplates();
    if (!templates.length) {
      this.logger.warn('No challenge templates found.');
      return;
    }
    // Pick a random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    // Example: scale difficulty based on day of week (can be improved)
    const today = new Date();
    const difficulty = 1 + today.getDay() * 0.2;
    const scaledObjectives = this.scaleObjectives(template.objectives, difficulty);
    // Save to DB
    const challenge = this.dailyChallengeRepo.create({
      date: today.toISOString().slice(0, 10),
      objectives: scaledObjectives,
      status: 'active',
      difficulty,
      rewards: template.rewards,
    });
    await this.dailyChallengeRepo.save(challenge);
    this.logger.log(`Daily challenge for ${challenge.date} generated.`);
  }

  private loadTemplates(): any[] {
    try {
      const raw = fs.readFileSync(this.templatesPath, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      this.logger.error('Failed to load challenge templates', e);
      return [];
    }
  }

  private scaleObjectives(objectives: any[], difficulty: number): any[] {
    return objectives.map(obj => ({
      ...obj,
      target: Math.ceil(obj.target * (obj.difficultyWeight || 1) * difficulty),
    }));
  }

  // Atomic progress tracking in Redis
  async trackProgress(userId: string, progress: any): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const progressKey = `challenge:progress:${today}:${userId}`;
    // Use Redis HINCRBY for atomic updates
    for (const [objective, value] of Object.entries(progress)) {
      await this.redis.hincrby(progressKey, objective, value);
    }
    await this.redis.expire(progressKey, 48 * 3600); // Keep for 2 days
    // Check completion
    const challenge = await this.dailyChallengeRepo.findOne({ where: { date: today } });
    if (!challenge) return;
    const userProgress = await this.redis.hgetall(progressKey);
    let completed = true;
    for (const obj of challenge.objectives) {
      if ((parseInt(userProgress[obj.metric] || '0', 10)) < obj.target) {
        completed = false;
        break;
      }
    }
    if (completed) {
      await this.processRewards(userId, challenge);
      await this.incrementStreak(userId);
    }
  }

  // Enqueue reward processing in Bull
  async processRewards(userId: string, challenge?: DailyChallenge): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await this.rewardQueue.add({ userId, date: today, rewards: challenge?.rewards });
    this.logger.log(`Enqueued reward processing for user ${userId} on ${today}`);
    // Check for streak bonus
    if (challenge?.bonus?.streak) {
      const streak = await this.getStreak(userId);
      if (streak && streak % challenge.bonus.streak.days === 0) {
        await this.rewardQueue.add({ userId, date: today, rewards: [challenge.bonus.streak.reward], bonus: true });
        this.logger.log(`Bonus reward for user ${userId} on streak ${streak}`);
      }
    }
  }

  // Streak management
  private async incrementStreak(userId: string): Promise<void> {
    const streakKey = `challenge:streak:${userId}`;
    let streak = await this.redis.get(streakKey);
    streak = streak ? (parseInt(streak, 10) + 1).toString() : '1';
    await this.redis.set(streakKey, streak, 'EX', 60 * 60 * 24 * 30); // 30 days TTL
  }

  private async getStreak(userId: string): Promise<number> {
    const streakKey = `challenge:streak:${userId}`;
    const streak = await this.redis.get(streakKey);
    return streak ? parseInt(streak, 10) : 0;
  }

  async resetStreak(userId: string): Promise<void> {
    const streakKey = `challenge:streak:${userId}`;
    await this.redis.del(streakKey);
  }
} 