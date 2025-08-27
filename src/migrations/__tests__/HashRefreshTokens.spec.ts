import { HashRefreshTokens1713970000000 } from '../1713970000000-HashRefreshTokens';
import { QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

jest.mock('crypto', () => ({
  createHmac: jest.fn(),
  randomBytes: jest.fn()
}));

describe('HashRefreshTokens1713970000000', () => {
  let migration: HashRefreshTokens1713970000000;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    migration = new HashRefreshTokens1713970000000();
    mockQueryRunner = {
      query: jest.fn(),
    } as any;

    jest.clearAllMocks();
    
    const mockHmac = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked_hash_value')
    };
    (crypto.createHmac as jest.Mock).mockReturnValue(mockHmac);

    originalEnv = { ...process.env };
    process.env.REFRESH_TOKEN_PEPPER = 'test_pepper';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('up', () => {
    it('should handle migration with no NULL tokens', async () => {
      const mockRows = [
        { id: '1', token: 'token1' },
        { id: '2', token: 'token2' }
      ];

      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(9);
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(1, 
        'ALTER TABLE "refresh_tokens" ADD COLUMN "tokenHash" character varying'
      );
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(3, 
        expect.stringContaining('UPDATE "refresh_tokens"')
      );
    });

    it('should handle migration with NULL tokens', async () => {
      const mockRows = [
        { id: '1', token: 'token1' },
        { id: '2', token: null },
        { id: '3', token: 'token3' }
      ];

      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(9);
      
      const updateCall = mockQueryRunner.query.mock.calls[2][0];
      expect(updateCall).toContain('UPDATE "refresh_tokens"');
      expect(updateCall).toContain("WHERE token IS NULL OR token = ''");
      expect(updateCall).toContain('gen_random_bytes(16)');
    });

    it('should use correct pepper from REFRESH_TOKEN_PEPPER environment variable', async () => {
      process.env.REFRESH_TOKEN_PEPPER = 'test_pepper';
      delete process.env.JWT_REFRESH_SECRET;

      const mockRows = [{ id: '1', token: 'token1' }];
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner);

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'test_pepper');
    });

    it('should fallback to JWT_REFRESH_SECRET if REFRESH_TOKEN_PEPPER not set', async () => {
      delete process.env.REFRESH_TOKEN_PEPPER;
      process.env.JWT_REFRESH_SECRET = 'jwt_secret';

      const mockRows = [{ id: '1', token: 'token1' }];
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await migration.up(mockQueryRunner);

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'jwt_secret');
    });

    it('should throw error if no environment variables are set', async () => {
      delete process.env.REFRESH_TOKEN_PEPPER;
      delete process.env.JWT_REFRESH_SECRET;

      const mockRows = [{ id: '1', token: 'token1' }];
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockRows);

      await expect(migration.up(mockQueryRunner)).rejects.toThrow(
        'Migration failed: REFRESH_TOKEN_PEPPER or JWT_REFRESH_SECRET environment variable must be set. Please configure one of these environment variables before running the migration.'
      );
    });
  });

  describe('down', () => {
    it('should reverse the migration correctly', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await migration.down(mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(1, 
        'ALTER TABLE "refresh_tokens" ADD COLUMN "token" character varying'
      );
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(2, 
        'DROP INDEX IF EXISTS "IDX_refresh_tokens_token_hash"'
      );
      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(3, 
        'ALTER TABLE "refresh_tokens" DROP COLUMN "tokenHash"'
      );
    });
  });
});
