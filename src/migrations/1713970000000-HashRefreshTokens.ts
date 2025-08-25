import { MigrationInterface, QueryRunner } from "typeorm";
import * as crypto from "crypto";

export class HashRefreshTokens1713970000000 implements MigrationInterface {
  name = 'HashRefreshTokens1713970000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD COLUMN "tokenHash" character varying`);

    // Backfill tokenHash using Node crypto to avoid relying on DB extensions
    const rows: Array<{ id: string; token: string }> = await queryRunner.query(
      `SELECT id, token FROM "refresh_tokens"`
    );

    // Use same pepper as in service; fallback to JWT_REFRESH_SECRET if env not set
    const pepper = process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';

    for (const row of rows) {
      if (!row.token) continue;
      const hash = crypto.createHmac('sha256', pepper).update(row.token).digest('hex');
      await queryRunner.query(
        `UPDATE "refresh_tokens" SET "tokenHash" = $1 WHERE "id" = $2`,
        [hash, row.id]
      );
    }

    await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "tokenHash" SET NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("tokenHash")`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "token"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD COLUMN "token" character varying`);
    // We cannot recover original token from hash; keep nulls
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_token_hash"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "tokenHash"`);
  }
}


