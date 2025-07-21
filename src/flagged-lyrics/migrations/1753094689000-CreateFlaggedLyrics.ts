import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFlaggedLyrics1753094689000 implements MigrationInterface {
  name = 'CreateFlaggedLyrics1753094689000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for flag status
    await queryRunner.query(
      `CREATE TYPE "public"."flagged_lyrics_status_enum" AS ENUM('pending', 'resolved', 'rejected')`,
    );

    // Create flagged_lyrics table
    await queryRunner.query(
      `CREATE TABLE "flagged_lyrics" ("id" SERIAL NOT NULL, "lyricsId" integer NOT NULL, "flaggedByUserId" uuid NOT NULL, "reason" text NOT NULL, "status" "public"."flagged_lyrics_status_enum" NOT NULL DEFAULT 'pending', "resolvedByUserId" uuid, "resolutionNotes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee3036978cfa5157d88ba45be0d" PRIMARY KEY ("id"))`,
    );

    // Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "flagged_lyrics" ADD CONSTRAINT "FK_f78306395f839468f40fe44146d" FOREIGN KEY ("lyricsId") REFERENCES "lyrics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flagged_lyrics" ADD CONSTRAINT "FK_308547bca54fab34762df77bcfc" FOREIGN KEY ("flaggedByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flagged_lyrics" ADD CONSTRAINT "FK_aa6ade5dc02cff280dd93cb5ce7" FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "flagged_lyrics" DROP CONSTRAINT "FK_aa6ade5dc02cff280dd93cb5ce7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flagged_lyrics" DROP CONSTRAINT "FK_308547bca54fab34762df77bcfc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flagged_lyrics" DROP CONSTRAINT "FK_f78306395f839468f40fe44146d"`,
    );

    // Drop table and enum type
    await queryRunner.query(`DROP TABLE "flagged_lyrics"`);
    await queryRunner.query(`DROP TYPE "public"."flagged_lyrics_status_enum"`);
  }
}
