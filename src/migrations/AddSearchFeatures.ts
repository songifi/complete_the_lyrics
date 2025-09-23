import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class AddSearchFeatures1714000000000 implements MigrationInterface {
  name = 'AddSearchFeatures1714000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    // Create search_analytics table
    await queryRunner.createTable(
      new Table({
        name: 'search_analytics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'query',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'resultCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'filters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'sortBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'responseTime',
            type: 'int',
            default: 0,
          },
          {
            name: 'clicked',
            type: 'boolean',
            default: false,
          },
          {
            name: 'clickedSongId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create search_suggestions table
    await queryRunner.createTable(
      new Table({
        name: 'search_suggestions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'query',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'popularity',
            type: 'int',
            default: 0,
          },
          {
            name: 'usageCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastUsed',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Add indexes for search_analytics
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_search_analytics_user_id ON search_analytics(userId)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_search_analytics_created_at ON search_analytics(created_at)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_search_analytics_query ON search_analytics(query)');

    // Add indexes for search_suggestions
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_search_suggestions_query ON search_suggestions(query)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_search_suggestions_popularity ON search_suggestions(popularity)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_search_suggestions_last_used ON search_suggestions(lastUsed)');

    // Add full-text search indexes for songs table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_songs_title_fulltext 
      ON songs USING gin(to_tsvector('english', title));
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_songs_artist_fulltext 
      ON songs USING gin(to_tsvector('english', artist));
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_songs_lyrics_fulltext 
      ON songs USING gin(to_tsvector('english', lyrics));
    `);

    // Add composite index for better search performance
    await queryRunner.query('CREATE INDEX IF NOT EXISTS IDX_songs_title_artist ON songs(title, artist)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query('DROP INDEX IF EXISTS IDX_search_analytics_user_id');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_search_analytics_created_at');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_search_analytics_query');
    
    await queryRunner.query('DROP INDEX IF EXISTS IDX_search_suggestions_query');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_search_suggestions_popularity');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_search_suggestions_last_used');
    
    await queryRunner.query('DROP INDEX IF EXISTS IDX_songs_title_artist');

    // Drop full-text search indexes
    await queryRunner.query('DROP INDEX IF EXISTS IDX_songs_title_fulltext;');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_songs_artist_fulltext;');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_songs_lyrics_fulltext;');

    // Drop tables
    await queryRunner.dropTable('search_analytics');
    await queryRunner.dropTable('search_suggestions');
  }
}
