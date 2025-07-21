import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateUserStats1751835818000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_stats',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'int',
            isUnique: true,
          },
          {
            name: 'totalAttempts',
            type: 'int',
            default: 0,
          },
          {
            name: 'correctAttempts',
            type: 'int',
            default: 0,
          },
          {
            name: 'score',
            type: 'int',
            default: 0,
          },
          {
            name: 'accuracyRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.query(`CREATE INDEX "idx_user_stats_userId" ON "user_stats" ("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_user_stats_score" ON "user_stats" ("score")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_stats');
  }
}