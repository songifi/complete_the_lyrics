import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLyrics1751835817458 implements MigrationInterface {
  name = 'CreateLyrics1751835817458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lyrics_category_enum" AS ENUM('pop', 'rock', 'hiphop', 'country', 'rnb', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lyrics_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lyrics" ("id" SERIAL NOT NULL, "snippet" character varying NOT NULL, "correctCompletion" character varying NOT NULL, "artist" character varying NOT NULL, "songTitle" character varying NOT NULL, "category" "public"."lyrics_category_enum" NOT NULL, "difficulty" "public"."lyrics_difficulty_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f7c5de22ef94f309591c5554f0f" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lyrics"`);
    await queryRunner.query(`DROP TYPE "public"."lyrics_difficulty_enum"`);
    await queryRunner.query(`DROP TYPE "public"."lyrics_category_enum"`);
  }
}
