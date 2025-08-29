import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAchievementsTables1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create achievements table
    await queryRunner.query(`
      CREATE TABLE achievements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT NOT NULL,
        image_url VARCHAR,
        category VARCHAR NOT NULL,
        type VARCHAR NOT NULL DEFAULT 'cumulative',
        trigger_action VARCHAR NOT NULL,
        target_value INTEGER NOT NULL,
        points INTEGER DEFAULT 0,
        tier VARCHAR DEFAULT 'bronze',
        metadata JSONB,
        rewards JSONB,
        is_active BOOLEAN DEFAULT true,
        is_hidden BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create user_achievements table
    await queryRunner.query(`
      CREATE TABLE user_achievements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        achievement_id UUID NOT NULL REFERENCES achievements(id),
        status VARCHAR DEFAULT 'locked',
        progress INTEGER DEFAULT 0,
        unlocked_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      )
    `);

    // Create achievement_progress table
    await queryRunner.query(`
      CREATE TABLE achievement_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        achievement_id UUID NOT NULL REFERENCES achievements(id),
        current_value INTEGER DEFAULT 0,
        metadata JSONB,
        last_updated TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      )
    `);

    // Create achievement_rewards table
    await queryRunner.query(`
      CREATE TABLE achievement_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        achievement_id UUID NOT NULL,
        type VARCHAR NOT NULL,
        value INTEGER NOT NULL,
        metadata JSONB,
        claimed BOOLEAN DEFAULT false,
        earned_at TIMESTAMP DEFAULT NOW(),
        claimed_at TIMESTAMP
      )
    `);

    // Create achievement_analytics table
    await queryRunner.query(`
      CREATE TABLE achievement_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        achievement_id UUID NOT NULL,
        event_type VARCHAR NOT NULL,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_achievements_status ON user_achievements(status)`);
    await queryRunner.query(`CREATE INDEX idx_achievement_progress_user_id ON achievement_progress(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_achievement_rewards_user_claimed ON achievement_rewards(user_id, claimed)`);
    await queryRunner.query(`CREATE INDEX idx_achievement_analytics_user_timestamp ON achievement_analytics(user_id, timestamp)`);
    await queryRunner.query(`CREATE INDEX idx_achievement_analytics_achievement_event ON achievement_analytics(achievement_id, event_type)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE achievement_analytics`);
    await queryRunner.query(`DROP TABLE achievement_rewards`);
    await queryRunner.query(`DROP TABLE achievement_progress`);
    await queryRunner.query(`DROP TABLE user_achievements`);
    await queryRunner.query(`DROP TABLE achievements`);
  }
}
