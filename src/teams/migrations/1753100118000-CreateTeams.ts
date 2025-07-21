import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeams1753100118000 implements MigrationInterface {
  name = 'CreateTeams1753100118000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teams table
    await queryRunner.query(
      `CREATE TABLE "teams" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text, "createdByUserId" character varying NOT NULL, "totalScore" integer NOT NULL DEFAULT '0', "memberCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_48c0c32e6247a2de155baeaf980" UNIQUE ("name"), CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`,
    );

    // Create enums for user_teams
    await queryRunner.query(
      `CREATE TYPE "public"."user_teams_role_enum" AS ENUM('member', 'captain', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_teams_status_enum" AS ENUM('active', 'left', 'kicked')`,
    );

    // Create user_teams junction table
    await queryRunner.query(
      `CREATE TABLE "user_teams" ("id" SERIAL NOT NULL, "userId" uuid NOT NULL, "teamId" integer NOT NULL, "role" "public"."user_teams_role_enum" NOT NULL DEFAULT 'member', "status" "public"."user_teams_status_enum" NOT NULL DEFAULT 'active', "contributedScore" integer NOT NULL DEFAULT '0', "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), "leftAt" TIMESTAMP, CONSTRAINT "PK_f7e0532d285aa51d49450cf3dc1" PRIMARY KEY ("id"))`,
    );

    // Create team_scores table
    await queryRunner.query(
      `CREATE TYPE "public"."team_scores_period_enum" AS ENUM('daily', 'weekly', 'monthly', 'all_time')`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_scores" ("id" SERIAL NOT NULL, "teamId" integer NOT NULL, "period" "public"."team_scores_period_enum" NOT NULL, "score" integer NOT NULL DEFAULT '0', "totalAttempts" integer NOT NULL DEFAULT '0', "correctAttempts" integer NOT NULL DEFAULT '0', "averageAccuracy" numeric(5,2) NOT NULL DEFAULT '0', "periodStart" date NOT NULL, "periodEnd" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3e0980bf4c1273c210da786ea57" PRIMARY KEY ("id"))`,
    );

    // Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "user_teams" ADD CONSTRAINT "FK_7897cc33fd8068fc74974f3b613" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_teams" ADD CONSTRAINT "FK_a15cb9a872f93e1c2dbf90b9b7f" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_scores" ADD CONSTRAINT "FK_778e34ea060b5c1b6fd9579c20a" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "team_scores" DROP CONSTRAINT "FK_778e34ea060b5c1b6fd9579c20a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_teams" DROP CONSTRAINT "FK_a15cb9a872f93e1c2dbf90b9b7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_teams" DROP CONSTRAINT "FK_7897cc33fd8068fc74974f3b613"`,
    );

    // Drop tables and enums
    await queryRunner.query(`DROP TABLE "team_scores"`);
    await queryRunner.query(`DROP TYPE "public"."team_scores_period_enum"`);
    await queryRunner.query(`DROP TABLE "user_teams"`);
    await queryRunner.query(`DROP TYPE "public"."user_teams_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_teams_role_enum"`);
    await queryRunner.query(`DROP TABLE "teams"`);
  }
}
