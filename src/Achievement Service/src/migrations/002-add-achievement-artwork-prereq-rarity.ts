import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAchievementArtworkPrereqRarity1700000000000 implements MigrationInterface {
  name = 'AddAchievementArtworkPrereqRarity1700000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // rarity enum (text check or enum depending on preference). We'll use TEXT with CHECK for simplicity
    await queryRunner.query(`
      ALTER TABLE achievements
      ADD COLUMN IF NOT EXISTS rarity VARCHAR DEFAULT 'common',
      ADD COLUMN IF NOT EXISTS prerequisite_ids JSONB,
      ADD COLUMN IF NOT EXISTS badge_icon_url VARCHAR,
      ADD COLUMN IF NOT EXISTS badge_style JSONB
    `);

    // Optional: add constraint to limit rarity values
    await queryRunner.query(`
      ALTER TABLE achievements
      ADD CONSTRAINT achievements_rarity_check CHECK (rarity IN ('common','uncommon','rare','epic','legendary'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraint if exists, then columns
    await queryRunner.query(`
      ALTER TABLE achievements
      DROP CONSTRAINT IF EXISTS achievements_rarity_check
    `);

    await queryRunner.query(`
      ALTER TABLE achievements
      DROP COLUMN IF EXISTS badge_style,
      DROP COLUMN IF EXISTS badge_icon_url,
      DROP COLUMN IF EXISTS prerequisite_ids,
      DROP COLUMN IF EXISTS rarity
    `);
  }
}


