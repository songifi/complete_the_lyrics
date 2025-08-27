import { MigrationInterface, QueryRunner } from "typeorm";
import * as crypto from "crypto";

export class HashRefreshTokens1713970000000 implements MigrationInterface {
  name = 'HashRefreshTokens1713970000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD COLUMN "tokenHash" character varying`);

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      UPDATE "refresh_tokens" 
      SET token = 'placeholder_' || id::text || '_' || encode(gen_random_bytes(16), 'hex')
      WHERE token IS NULL OR token = ''
    `);

    const rows: Array<{ id: string; token: string }> = await queryRunner.query(
      `SELECT id, token FROM "refresh_tokens"`
    );

    const pepper = process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_REFRESH_SECRET;
    
    if (!pepper) {
      throw new Error(
        'Migration failed: REFRESH_TOKEN_PEPPER or JWT_REFRESH_SECRET environment variable must be set. ' +
        'Please configure one of these environment variables before running the migration.'
      );
    }

    for (const row of rows) {
      if (row.token === null || row.token === '') {
        continue;
      }
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
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_token_hash"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "tokenHash"`);
  }
}


